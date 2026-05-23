# GameMacro 阶段 2：Per-Hotkey 循环架构（Core schema + Daemon 重写）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让每条热键独立控制「是否循环」+「循环间隔」。

**Architecture:** 在 `gamemacro-core::HotkeyConfig` 上新增两个 `#[serde(default)]` 字段（`repeat: bool` / `interval_secs_override: Option<u64>`），保持向后兼容。在 daemon 里把现有"一条 auto_input 线程 + 全局 Vec<String>"模型替换为 **per-hotkey tokio task + mpsc → 单 input worker** 架构：每条 `repeat=true` 的热键起一个 tokio task，按其 effective_interval 周期 tick，通过 `tokio::sync::mpsc` 把要输入的文本投递给一个普通 std thread 上的 Enigo input worker（保证输入串行化）。配置 reload / 热键删除靠 `CancellationToken` + 重建 task 集。`repeat=false` 的热键直接同步发一次到 worker，不入循环。

**Tech Stack:** Rust 2024 · tokio 1.x（rt-multi-thread + sync + time + macros）· enigo · rdev · 现有 lazy_static / notify

**前置约束：**
- 阶段 1 已完成（GameMacro 改名 + 旧迁移代码已移除）
- 不动 GUI（GUI 重构归阶段 3）
- 不改 Tauri 命令面（命令名归阶段 3）
- `Profile::auto_input_interval_secs` 字段保留，作为 fallback 的"profile 默认间隔"
- 一切行为变化必须由测试驱动（TDD）

---

## Task 1：基线状态与分支

**Files:** 无文件改动，仅状态确认

**Step 1: 确认 git 干净**

Run: `git status`
Expected: `nothing to commit, working tree clean`，分支 `dev`

**Step 2: 确认 HEAD 是阶段 1 的最后一个 commit**

Run: `git log --oneline -2`
Expected: 看到 `c0f2cf9 chore(daemon): drop one-off hotkeys.toml migration shim`

**Step 3: 确认基线构建/测试通过**

Run: `cargo build` → exit 0  
Run: `cargo test -p gamemacro-core` → 6 passed

---

## Task 2：Core schema 增加 repeat 字段（TDD）

**Files:**
- Modify: `crates/gamemacro-core/src/config.rs`
- Test: 同文件 `mod tests`

**Step 1: 写失败测试**

在 `crates/gamemacro-core/src/config.rs::tests` 末尾追加：

```rust
#[test]
fn hotkey_repeat_defaults_to_true_for_legacy_toml() {
    // 模拟阶段 1 之前的 toml（无 repeat 字段）
    let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "-ss"
"#;
    let cfg: Config = toml::from_str(toml_str).expect("parse");
    let hk = &cfg.profiles[0].hotkeys[0];
    assert!(hk.repeat, "repeat should default to true for legacy configs");
}

#[test]
fn hotkey_repeat_can_be_false_explicitly() {
    let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "-ss"
repeat = false
"#;
    let cfg: Config = toml::from_str(toml_str).expect("parse");
    assert!(!cfg.profiles[0].hotkeys[0].repeat);
}
```

**Step 2: 跑测试验证失败**

Run: `cargo test -p gamemacro-core hotkey_repeat`
Expected: FAIL with "no field `repeat` on type `HotkeyConfig`"

**Step 3: 加字段（最小实现）**

修改 `HotkeyConfig`：

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub modifier_key: String,
    pub trigger_key: String,
    pub input_string: String,
    pub description: Option<String>,
    /// 按一次开始循环输入、再按一次停止；缺省 true（与历史行为一致）。
    /// 若为 false，按一次只输入一次，不入循环。
    #[serde(default = "default_true")]
    pub repeat: bool,
}

fn default_true() -> bool {
    true
}
```

**注意**：现有所有测试里手动构造的 `HotkeyConfig` 字面量需要同步加 `repeat: true,`。先 grep 一下 `HotkeyConfig {` 看哪里需要补：

Run: `Get-ChildItem crates -Recurse -Include *.rs | Select-String 'HotkeyConfig\s*\{'`

修复每处构造点（应只在测试里）。

**Step 4: 跑测试验证通过**

Run: `cargo test -p gamemacro-core`
Expected: 8 passed (原 6 + 新增 2)

**Step 5: Commit**

```
git add crates/gamemacro-core
git commit -m "feat(core): add HotkeyConfig.repeat (default true) for per-hotkey loop control"
```

---

## Task 3：Core schema 增加 interval_secs_override 字段（TDD）

**Files:** 同 Task 2

**Step 1: 写失败测试**

在 `mod tests` 末尾追加：

```rust
#[test]
fn hotkey_interval_override_defaults_to_none() {
    let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "-ss"
"#;
    let cfg: Config = toml::from_str(toml_str).expect("parse");
    assert_eq!(cfg.profiles[0].hotkeys[0].interval_secs_override, None);
}

#[test]
fn hotkey_interval_override_can_be_set() {
    let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "-ss"
interval_secs_override = 10
"#;
    let cfg: Config = toml::from_str(toml_str).expect("parse");
    assert_eq!(cfg.profiles[0].hotkeys[0].interval_secs_override, Some(10));
}

#[test]
fn hotkey_effective_interval_falls_back_to_profile() {
    let p = Profile {
        name: "T".into(),
        window_keywords: vec!["x".into()],
        hotkeys: vec![HotkeyConfig {
            modifier_key: "Ctrl".into(),
            trigger_key: "X".into(),
            input_string: "-ss".into(),
            description: None,
            repeat: true,
            interval_secs_override: None,
        }],
        auto_input_interval_secs: 7,
        input_delay_millis: 50,
    };
    assert_eq!(p.hotkeys[0].effective_interval_secs(&p), 7);
}

#[test]
fn hotkey_effective_interval_uses_override_when_present() {
    let p = Profile {
        name: "T".into(),
        window_keywords: vec!["x".into()],
        hotkeys: vec![HotkeyConfig {
            modifier_key: "Ctrl".into(),
            trigger_key: "X".into(),
            input_string: "-ss".into(),
            description: None,
            repeat: true,
            interval_secs_override: Some(2),
        }],
        auto_input_interval_secs: 7,
        input_delay_millis: 50,
    };
    assert_eq!(p.hotkeys[0].effective_interval_secs(&p), 2);
}
```

**Step 2: 跑测试验证失败**

Run: `cargo test -p gamemacro-core hotkey_interval`
Expected: FAIL with `no field interval_secs_override` 和 `no method effective_interval_secs`

**Step 3: 加字段 + 方法（最小实现）**

```rust
pub struct HotkeyConfig {
    // ... 现有字段
    pub repeat: bool,

    /// 覆盖此条热键专属的循环间隔（秒）。None 时使用 profile 的 auto_input_interval_secs。
    #[serde(default)]
    pub interval_secs_override: Option<u64>,
}

impl HotkeyConfig {
    /// 计算本条热键真实生效的循环间隔（秒）。下限 1 秒。
    pub fn effective_interval_secs(&self, profile: &Profile) -> u64 {
        self.interval_secs_override
            .unwrap_or(profile.auto_input_interval_secs)
            .max(1)
    }
}
```

同步给所有手工构造 `HotkeyConfig` 的测试加 `interval_secs_override: None,`。

**Step 4: 跑测试验证通过**

Run: `cargo test -p gamemacro-core`
Expected: 12 passed (原 8 + 新增 4)

**Step 5: Commit**

```
git add crates/gamemacro-core
git commit -m "feat(core): add HotkeyConfig.interval_secs_override + effective_interval_secs()"
```

---

## Task 4：daemon 加 tokio 依赖

**Files:**
- Modify: `crates/gamemacro-daemon/Cargo.toml`

**Step 1: 加依赖**

```toml
[dependencies]
gamemacro-core = { path = "../gamemacro-core" }
enigo = { version = "0.6.1", default-features = false }
lazy_static = { version = "1.5.0", default-features = false }
notify = "8.2.0"
rdev = { version = "0.5.2", default-features = false }
tokio = { version = "1", default-features = false, features = ["rt-multi-thread", "sync", "time", "macros"] }
winapi = { version = "0.3.9", features = [
    "handleapi",
    "securitybaseapi",
    "processthreadsapi",
    "winnt",
] }
```

**Step 2: 构建验证（此时 tokio 仅引入，未使用，应有 unused warning，无 error）**

Run: `cargo build -p gamemacro-daemon`
Expected: exit 0（可能有 unused dep warning，可接受）

**Step 3: Commit**

```
git add crates/gamemacro-daemon/Cargo.toml Cargo.lock
git commit -m "build(daemon): add tokio dep for per-hotkey loop tasks"
```

---

## Task 5：新建 `loop_runtime` 模块（per-hotkey task + input worker）

**Files:**
- Create: `crates/gamemacro-daemon/src/loop_runtime.rs`
- Modify: `crates/gamemacro-daemon/src/main.rs`（声明 mod）

**目标设计**：

```
                       set_loops(profile)
                              │
                              ▼
           ┌───────────────────────────────────────┐
           │  LoopRuntime                          │
           │  ┌──────────────────────────────────┐ │
           │  │ tokio runtime (multi-thread)     │ │
           │  │   ─ task A (Ctrl+X, 3s)          │ │
           │  │   ─ task B (Ctrl+W, 5s)          │ │  ←── all push via tokio mpsc
           │  │   ─ task C (Ctrl+D, 2s)          │ │
           │  └──────────────────────────────────┘ │
           │  ┌──────────────────────────────────┐ │
           │  │ std::thread input worker         │ │  ←── single Enigo, serializes
           │  │   reads from std mpsc rx         │ │
           │  └──────────────────────────────────┘ │
           └───────────────────────────────────────┘
```

**Step 1: 写 loop_runtime.rs**

完整内容：

```rust
//! Per-hotkey 循环输入运行时。
//!
//! 职责：
//! - 运行一个 tokio multi-thread runtime，每条 `repeat=true` 的热键起一个 task
//! - task 按 `effective_interval_secs` 周期 tick，把要输入的文本通过 mpsc 投递给 input worker
//! - 唯一的 input worker 是普通 std::thread，持有 Enigo（输入 API 必须串行化）
//! - 配置切换 / 停止单条热键：通过 `CancellationToken` 取消对应 task
//! - 单次输入（repeat=false）：由 `submit_once()` 直接发一条到 input worker，不起 task

use crate::input::InputManager;
use gamemacro_core::{HotkeyConfig, Profile};
use std::sync::{Arc, mpsc as std_mpsc};
use std::thread;
use std::time::Duration;
use tokio::runtime::Runtime;
use tokio::sync::mpsc as tokio_mpsc;
use tokio_util::sync::CancellationToken;

/// 一条要发送给 input worker 的命令。
#[derive(Debug)]
struct InputJob {
    text: String,
    /// 输入完一次后再睡的延迟（毫秒），用于压制游戏丢字。
    post_delay_ms: u64,
}

pub struct LoopRuntime {
    rt: Runtime,
    /// 通向 input worker 的发送端。无界通道：循环热键的 tick 速率受 interval 控制，
    /// 不会出现暴涨；用无界通道可避免 task 因背压被阻塞。
    job_tx: std_mpsc::Sender<InputJob>,
    /// 当前所有循环 task 的取消 token（按 hotkey 索引顺序）。重新加载配置时整体取消重建。
    loop_tokens: Vec<CancellationToken>,
}

impl LoopRuntime {
    /// 创建运行时：spawn input worker thread（持有 Enigo），创建 tokio runtime，
    /// 但不 spawn 任何循环 task —— 调用方需调用 `apply_profile` 注入热键。
    pub fn new() -> std::io::Result<Self> {
        let (job_tx, job_rx) = std_mpsc::channel::<InputJob>();

        // 输入 worker：单线程持有 Enigo，串行处理 InputJob
        thread::Builder::new()
            .name("gamemacro-input-worker".into())
            .spawn(move || {
                input_worker_loop(job_rx);
            })?;

        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_time()
            .thread_name("gamemacro-loop")
            .build()?;

        Ok(Self {
            rt,
            job_tx,
            loop_tokens: Vec::new(),
        })
    }

    /// 用新 profile 的热键集合替换当前所有循环 task。
    /// - 取消并丢弃旧 token
    /// - 对每条 `repeat=true` 的热键 spawn 一个新 task
    /// - `repeat=false` 的热键不在这里处理（它们走 `submit_once`）
    pub fn apply_profile(&mut self, profile: &Profile) {
        // 1. 取消所有旧 task
        for tok in &self.loop_tokens {
            tok.cancel();
        }
        self.loop_tokens.clear();

        // 2. 不在这里 spawn —— 而是按需（用户按下热键时）激活，参见 start_loop
        // （V0.2 行为：apply_profile 不主动 spawn；只清栈）
    }

    /// 用户按下了一条 `repeat=true` 的热键 -> 启动它的循环。
    /// 返回该热键在内部 token 表中的索引（调用方可保存以便后续停止）。
    pub fn start_loop(&mut self, hotkey: HotkeyConfig, interval_secs: u64, delay_ms: u64) -> usize {
        let token = CancellationToken::new();
        let token_for_task = token.clone();
        let tx = self.job_tx.clone();
        let interval = Duration::from_secs(interval_secs.max(1));

        self.rt.spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            // 第一次 tick 立即 fire（等同"按下立刻输入一次"），符合用户预期
            loop {
                tokio::select! {
                    _ = token_for_task.cancelled() => break,
                    _ = ticker.tick() => {
                        let job = InputJob {
                            text: hotkey.input_string.clone(),
                            post_delay_ms: delay_ms,
                        };
                        // 发送失败说明 input worker 已退出：直接结束 task
                        if tx.send(job).is_err() {
                            break;
                        }
                    }
                }
            }
        });

        self.loop_tokens.push(token);
        self.loop_tokens.len() - 1
    }

    /// 停止指定索引位置的循环（如果索引仍有效）。
    pub fn stop_loop(&mut self, idx: usize) {
        if let Some(tok) = self.loop_tokens.get(idx) {
            tok.cancel();
        }
    }

    /// 一次性提交一条输入（用于 repeat=false 的热键）。
    pub fn submit_once(&self, text: String, delay_ms: u64) {
        let _ = self.job_tx.send(InputJob {
            text,
            post_delay_ms: delay_ms,
        });
    }

    /// 取消所有循环（窗口失活时调用）。
    pub fn cancel_all_loops(&mut self) {
        for tok in &self.loop_tokens {
            tok.cancel();
        }
        self.loop_tokens.clear();
    }
}

fn input_worker_loop(rx: std_mpsc::Receiver<InputJob>) {
    let mut input = match InputManager::new() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("input worker: failed to init Enigo: {}", e);
            return;
        }
    };
    while let Ok(job) = rx.recv() {
        input.input_text(&job.text);
        if job.post_delay_ms > 0 {
            thread::sleep(Duration::from_millis(job.post_delay_ms));
        }
    }
}
```

**关键设计取舍**：
- **「按一次开始循环、再按一次停止」的索引怎么持久化**？plan 在 Task 6 里给出"hotkey identity 用 (modifier, trigger) 二元组在内存里映射 token 索引"
- `apply_profile` 只清旧 token，不主动 spawn——因为循环只在用户按下热键时才该启动；启动时机在 hotkey 事件处理里
- tokio runtime 的 worker_threads = 2 已足够：所有阻塞工作在 input worker 里，task 只是 sleep + 发消息
- 取消用 `CancellationToken`（来自 `tokio-util`），plan Task 4 里同步加这个依赖

**修正 Task 4 依赖**：tokio-util 也得加。请回到 Task 4 把依赖改成：

```toml
tokio = { version = "1", default-features = false, features = ["rt-multi-thread", "sync", "time", "macros"] }
tokio-util = { version = "0.7", default-features = false }
```

（如果 Task 4 已 commit，这里单独再加一个 commit 即可。）

**Step 2: 在 main.rs 里声明 mod 但暂不使用**

`crates/gamemacro-daemon/src/main.rs` 顶部 `mod` 列表加：

```rust
mod loop_runtime;
```

**Step 3: 构建验证**

Run: `cargo build -p gamemacro-daemon`
Expected: exit 0（可能有 unused warning）

**Step 4: Commit**

```
git add crates/gamemacro-daemon/src/loop_runtime.rs crates/gamemacro-daemon/src/main.rs crates/gamemacro-daemon/Cargo.toml Cargo.lock
git commit -m "feat(daemon): introduce LoopRuntime (tokio task + input worker thread)"
```

---

## Task 6：替换 hotkey.rs 的循环逻辑

**Files:**
- Modify: `crates/gamemacro-daemon/src/hotkey.rs`
- Modify: `crates/gamemacro-daemon/src/state.rs`

**当前问题**：`hotkey.rs::handle_key_event` 直接操作 `AppState::add_auto_input` / `remove_auto_input`，这是为旧"全局共享 list"模型设计的。新模型下要：
- 找到匹配的 `HotkeyConfig`（不只是 input_string）
- `repeat=false` → 调 `LoopRuntime::submit_once`
- `repeat=true` → 维护 `HashMap<(modifier, trigger), token_idx>`，按下时若不在 → start_loop + 记 idx；若已在 → stop_loop + 移除

**Step 1: state.rs 加 LoopRuntime 引用**

`state.rs` 顶部：

```rust
use crate::loop_runtime::LoopRuntime;
use std::sync::OnceLock;

static LOOP_RUNTIME: OnceLock<Mutex<LoopRuntime>> = OnceLock::new();

impl AppState {
    pub fn init_loop_runtime() -> std::io::Result<()> {
        let rt = LoopRuntime::new()?;
        LOOP_RUNTIME
            .set(Mutex::new(rt))
            .map_err(|_| std::io::Error::other("LoopRuntime already initialized"))?;
        Ok(())
    }

    pub fn with_loop_runtime<R>(f: impl FnOnce(&mut LoopRuntime) -> R) -> Option<R> {
        LOOP_RUNTIME.get().map(|m| f(&mut m.lock().unwrap()))
    }
}
```

**Step 2: 删除老的 AUTO_INPUT 全局 + add/remove/clear/contains/get_auto_input_list 方法**

这些方法在新模型下不再需要（循环状态归 LoopRuntime 管，不再共享 Vec<String>）。删除 state.rs 中：
- `AUTO_INPUT` lazy_static
- `add_auto_input` / `remove_auto_input` / `clear_auto_input` / `contains_auto_input` / `get_auto_input_list`

**Step 3: 改写 hotkey.rs**

`find_matching_hotkey` 返回 `Option<HotkeyConfig>`（不再是字符串）；`handle_key_event` 用新逻辑：

```rust
use crate::state::AppState;
use gamemacro_core::{HotkeyConfig, string_to_rdev_key};
use rdev::{Event, EventType, Key as RdevKey};
use std::collections::HashMap;
use std::sync::Mutex;

/// 已激活循环的热键 -> 它在 LoopRuntime token 表中的索引
static ACTIVE_LOOPS: Mutex<Option<HashMap<(String, String), usize>>> = Mutex::new(None);

fn active_loops() -> std::sync::MutexGuard<'static, Option<HashMap<(String, String), usize>>> {
    let mut g = ACTIVE_LOOPS.lock().unwrap();
    if g.is_none() {
        *g = Some(HashMap::new());
    }
    g
}

pub struct HotkeyManager;

impl HotkeyManager {
    pub fn handle_key_event(event: Event) {
        if !AppState::is_active() {
            return;
        }

        match event.event_type {
            EventType::KeyPress(key) => {
                AppState::update_modifier_key_state(key, true);
                if let Some((hotkey, profile_interval, delay_ms)) = Self::find_match_with_context(key) {
                    Self::trigger_hotkey(hotkey, profile_interval, delay_ms);
                }
            }
            EventType::KeyRelease(key) => {
                AppState::update_modifier_key_state(key, false);
            }
            _ => {}
        }
    }

    fn find_match_with_context(trigger_key: RdevKey) -> Option<(HotkeyConfig, u64, u64)> {
        let profile = AppState::get_active_profile()?;
        let modifier_keys = AppState::get_modifier_keys_state();

        for hk in &profile.hotkeys {
            if let (Some(cm), Some(ct)) =
                (string_to_rdev_key(&hk.modifier_key), string_to_rdev_key(&hk.trigger_key))
            {
                if ct == trigger_key {
                    if matches!(modifier_keys.get(&cm), Some(true)) {
                        return Some((
                            hk.clone(),
                            hk.effective_interval_secs(&profile),
                            profile.input_delay_millis,
                        ));
                    }
                }
            }
        }
        None
    }

    fn trigger_hotkey(hotkey: HotkeyConfig, interval_secs: u64, delay_ms: u64) {
        let key = (hotkey.modifier_key.clone(), hotkey.trigger_key.clone());
        let label = hotkey.input_string.replace('\n', " ");

        if !hotkey.repeat {
            println!("Hotkey (once): {}", label);
            AppState::with_loop_runtime(|rt| rt.submit_once(hotkey.input_string.clone(), delay_ms));
            return;
        }

        let mut loops = active_loops();
        let map = loops.as_mut().unwrap();
        if let Some(idx) = map.remove(&key) {
            println!("stop {}", label);
            AppState::with_loop_runtime(|rt| rt.stop_loop(idx));
        } else {
            println!("start {} (every {}s)", label, interval_secs);
            let idx = AppState::with_loop_runtime(|rt| rt.start_loop(hotkey, interval_secs, delay_ms))
                .unwrap_or(usize::MAX);
            if idx != usize::MAX {
                map.insert(key, idx);
            }
        }
    }

    /// 配置 reload / 窗口失活时调用：清空所有进行中循环和映射
    pub fn cancel_all() {
        active_loops().as_mut().unwrap().clear();
        AppState::with_loop_runtime(|rt| rt.cancel_all_loops());
    }

    pub fn print_hotkey_configs() {
        let config = AppState::get_config();
        println!("loaded {} profile(s):", config.profiles.len());
        for (pi, profile) in config.profiles.iter().enumerate() {
            println!();
            println!("  [{}] {}  (keywords: {:?})", pi, profile.name, profile.window_keywords);
            println!(
                "      profile interval: {}s, key delay: {}ms",
                profile.auto_input_interval_secs, profile.input_delay_millis
            );
            for (i, hk) in profile.hotkeys.iter().enumerate() {
                let desc = hk.description.as_deref().unwrap_or("no description");
                let mode = if hk.repeat {
                    format!("loop {}s", hk.effective_interval_secs(profile))
                } else {
                    "once".into()
                };
                println!(
                    "      {}. {} + {} -> {} ({}, {})",
                    i + 1,
                    hk.modifier_key,
                    hk.trigger_key,
                    hk.input_string.replace('\n', " "),
                    mode,
                    desc
                );
            }
        }
        println!();
    }
}
```

**Step 4: 处理窗口失活 / reload 时的清理**

在 daemon 现有逻辑里，窗口失活时旧代码会 `AppState::clear_auto_input()`（在 auto_input.rs 里）；新模型下要替换为 `HotkeyManager::cancel_all()`。

搜索其他调用：
Run: `Get-ChildItem crates/gamemacro-daemon/src -Recurse -Include *.rs | Select-String 'auto_input|AUTO_INPUT'`

每处需要审视并改写：
- `auto_input.rs` 整个文件 -> 删除（功能被 LoopRuntime 取代）
- `state.rs` 的 `clear_auto_input` -> 删除
- 任何 `clear_auto_input` 调用 -> 替换为 `HotkeyManager::cancel_all()` 或类似

**Step 5: 构建验证**

Run: `cargo build -p gamemacro-daemon`
Expected: exit 0

**Step 6: 跑 core 测试确保未破坏 schema**

Run: `cargo test -p gamemacro-core`
Expected: 12 passed

**Step 7: Commit**

```
git add crates/gamemacro-daemon/src
git commit -m "refactor(daemon): drive loops through LoopRuntime, support per-hotkey repeat/interval"
```

---

## Task 7：删除 auto_input.rs 与相关 plumbing

**Files:**
- Delete: `crates/gamemacro-daemon/src/auto_input.rs`
- Modify: `crates/gamemacro-daemon/src/main.rs`（删 mod 声明 + AutoInputManager::start 调用 + 初始化 LoopRuntime + 把窗口失活/reload 钩到 HotkeyManager::cancel_all）

**Step 1: 删 auto_input.rs**

Run: `git rm crates/gamemacro-daemon/src/auto_input.rs`

**Step 2: 改 main.rs**

- 删除 `mod auto_input;`
- 删除 `use auto_input::AutoInputManager;`
- 删除 `AutoInputManager::start();` 调用
- 在 `WindowManager::init_window_hook()?;` 之前加 `AppState::init_loop_runtime()?;`
- watcher 收到 modify 事件做 reload 时，**额外调用** `HotkeyManager::cancel_all()` 再 `load_config(...)`。这样配置切换时进行中的循环立即停下，不会用旧间隔继续 fire

```rust
*last = Instant::now();
HotkeyManager::cancel_all();
load_config(&config_path_clone, true);
```

**Step 3: 检查 window.rs 是否有 clear_auto_input 调用**

Run: `Get-ChildItem crates/gamemacro-daemon/src -Recurse -Include *.rs | Select-String 'clear_auto_input|add_auto_input|remove_auto_input|contains_auto_input'`

应该全部命中已被 Task 6 移除；如果还有命中，按"窗口失活 → HotkeyManager::cancel_all()"的方式改写。

**Step 4: 构建 + 启动验证**

Run: `cargo build -p gamemacro-daemon`
Expected: exit 0，无 unused warning

**Step 5: 单元测试再过一遍**

Run: `cargo test -p gamemacro-core`
Expected: 12 passed

**Step 6: Commit**

```
git add -A
git commit -m "refactor(daemon): remove auto_input.rs, wire LoopRuntime into main loop"
```

---

## Task 8：手动烟雾测试（必做，机器测不了）

**Files:** 无文件改动

**Step 1: release 构建**

Run: `cargo build --release`
Expected: 三 crate 全部成功

**Step 2: 准备测试配置**

把仓库根的 `gamemacro.toml` 临时换成多 profile / 多模式配置：

```toml
[[profiles]]
name = "记事本"
window_keywords = ["%记事本%", "%notepad%"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "loop-default-3s"
description = "默认 3 秒循环"
# repeat / interval_secs_override 缺省

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "Z"
input_string = "loop-fast-1s"
description = "覆盖 1 秒循环"
interval_secs_override = 1

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "W"
input_string = "once-only"
description = "单次输入"
repeat = false
```

**Step 3: 复制 release 产物到仓库根，跑 daemon**

```powershell
Copy-Item target\release\gamemacro-daemon.exe . -Force
.\gamemacro-daemon.exe
```

打开记事本，激活窗口，执行：
- 按 `Ctrl+X` → 控制台 `start loop-default-3s (every 3s)`，记事本里每 3 秒出现一次 `loop-default-3s`；再按一次 → 控制台 `stop`，停止
- 按 `Ctrl+Z` → 每 1 秒一次（验证 interval_secs_override 生效）
- `Ctrl+X` 和 `Ctrl+Z` 同时启动 → 验证两条循环**真的独立**（互不阻塞、各自的间隔正确）
- 按 `Ctrl+W` → 控制台 `Hotkeys (once): once-only`，记事本只出现一次，再按又输出一次（不入循环）

**验收**：
- [ ] repeat=true 默认热键能循环
- [ ] interval_secs_override 真生效（不是用 profile 的 3 秒）
- [ ] repeat=false 真的只输入一次
- [ ] 多条循环并行，间隔互不影响
- [ ] 失活记事本（切到别的窗口）→ 所有循环立刻停
- [ ] 重激活 → 之前的循环不会自动恢复（用户重新按才启动；这是预期行为）
- [ ] GUI 保存 toml 后 daemon 重新加载，循环全部停止再按生效

**Step 4: 还原 gamemacro.toml 到提交版**

```
git checkout -- gamemacro.toml
```

（除非你想把这个测试配置也保留）

---

## Task 9：最终验证与设计文档同步

**Files:**
- Modify: `docs/plans/2026-05-23-gamemacro-redesign-design.md`（在 §11 把阶段 2 状态从「计划中」改为「已完成 ✓」并补一句 LoopRuntime 简介）
- 不改 README（用户层无新增可见行为；GUI 重构后再宣传）

**Step 1: 全工作区构建**

Run: `cargo build --release`
Expected: 三 crate 全部成功，无 error

**Step 2: 全工作区测试**

Run: `cargo test`
Expected: 全部通过

**Step 3: clippy 自检（推荐）**

Run: `cargo clippy --all-targets -- -D warnings`
Expected: 无 error；如有 warning 视情况修

**Step 4: 同步设计文档**

打开 `docs/plans/2026-05-23-gamemacro-redesign-design.md`，找到 §11 阶段 2 段落，把内容替换为：

```markdown
### 阶段 2：Per-hotkey 循环架构 ✓

`HotkeyConfig` 增加 `repeat`（默认 true）/ `interval_secs_override`（Option<u64>）字段，向后兼容旧 toml。daemon 引入 `LoopRuntime`：tokio multi-thread runtime + per-hotkey task + 一个 std thread 上的 Enigo input worker，所有 task 通过 mpsc 把待输入文本投递给 worker 串行化执行。每条热键独立循环、独立间隔；窗口失活 / 配置 reload 时 `CancellationToken` 整体清理。`auto_input.rs` 已删除。
```

**Step 5: Commit**

```
git add docs/plans/2026-05-23-gamemacro-redesign-design.md
git commit -m "docs: mark phase 2 (per-hotkey LoopRuntime) as completed"
```

---

## 完成标准

- [x] `cargo build --release` 三 crate 全部通过
- [x] `cargo test` 全部通过（core 至少 12 个）
- [x] daemon 启动后 `gamemacro-daemon.exe` 单窗口可见，banner 仍是 GameMacro
- [x] 旧 toml（无 repeat / 无 interval_secs_override）能正常加载、所有热键默认循环
- [x] 新 toml 可以指定 `repeat = false` 或 `interval_secs_override = N`
- [x] 多条 repeat=true 热键真正并行循环、间隔独立
- [x] 窗口失活立即停所有循环；配置 reload 立即停
- [x] `auto_input.rs` 已删除，`AUTO_INPUT` 全局已删除

---

## 不做（明确 YAGNI）

- ❌ 把循环状态在 GUI 显示出来（"哪些循环正在跑"）→ 阶段 3 的 GUI 重构再做
- ❌ 启动时自动开始上次未停止的循环 → 不做（电脑重启 / daemon 重启都应该是干净状态）
- ❌ Per-hotkey 的 input_delay_millis 覆盖 → 暂不做（profile 级足够），未来可加
- ❌ Tauri 命令面调整 → 阶段 3
