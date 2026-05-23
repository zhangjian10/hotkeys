# GameMacro 阶段 4：Daemon 静默化（无黑框 + 文件日志）

> 状态：待实施
> 日期：2026-05-23
> 前置：阶段 1 / 2 / 3 已完成（rebrand + LoopRuntime + Fluent v9 GUI）

**Goal:** 让普通用户双击 `gamemacro.exe` 启动后端时不再出现黑色控制台窗口，所有原本写到 stdout/stderr 的运行信息改为追加到 `%LOCALAPPDATA%\GameMacro\daemon.log`，方便排查问题但不打扰使用。

**Architecture:** 拆成独立、可单独 commit 的 sub-PR：
- **Sub-PR 4-A（本文件）**：daemon 进程静默 + 简易文件日志
  - `#![windows_subsystem = "windows"]`（仅 release）
  - 引入零依赖的 `logging` 模块（`log_info!` / `log_warn!` / `log_error!`），日志追加到 `%LOCALAPPDATA%\GameMacro\daemon.log`，超过 1 MiB 时滚动一次到 `daemon.log.1`
  - 把现有 `println!` / `eprintln!` 全部替换为新宏；启动横幅压缩成单行 INFO
  - debug build 仍同时打到 stdout/stderr，方便开发
- **Sub-PR 4-B（不在本文件，后续视需要再写）**：daemon 命名管道暴露 `status` / `stop`，GUI 顶栏接入实时状态灯
- **Sub-PR 4-C（不在本文件）**：GUI 启动时若发现 daemon 未运行，自动 `ShellExecute runas` 拉起

**Tech Stack:** Rust 2024 · 仅依赖 `std`（`std::env`、`std::fs::OpenOptions`、`std::sync::OnceLock`、`std::sync::Mutex`）

---

## 前置约束 / 不做

- ❌ 不引入 `log` / `tracing` / `env_logger` / `simplelog` 等任何 crate（当前约 27 处日志调用，自家宏足够）
- ❌ 不做 IPC（status / stop pipe 留给 4-B）
- ❌ 不动提权流程（仍走 ShellExecute runas）
- ❌ 不动配置 watcher / LoopRuntime / window manager 的逻辑，**只换输出通道**
- ❌ 不引入异步日志（同步 append + flush；写入频率本就低）
- ✅ 保留所有现有信息密度——失活/激活/profile 切换/reload/启动横幅都还在，只是落到文件

---

## Task 1：新建 logging 模块

**Files:**
- Create: `crates/gamemacro-daemon/src/logging.rs`

**Step 1: 实现 `init()` + 三个宏**

```rust
//! 极简文件日志：%LOCALAPPDATA%\GameMacro\daemon.log
//!
//! 设计要点：
//! - 零外部依赖，仅 std
//! - OnceLock<Mutex<File>>：进程内全局单例，所有调用串行追加
//! - 1 MiB 大小阈值滚动一次到 daemon.log.1（旧 .1 被覆盖）
//! - debug build 同时镜像到 stdout/stderr，方便 cargo run 时看
//! - init 失败时不 panic：日志写入会变成 no-op，daemon 继续工作

use std::fs::{File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG_BYTES: u64 = 1 * 1024 * 1024;

static LOG_FILE: OnceLock<Mutex<File>> = OnceLock::new();
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn init() {
    if let Some(path) = resolve_log_path() {
        let _ = std::fs::create_dir_all(path.parent().unwrap_or(&path));
        // 滚动检查
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.len() > MAX_LOG_BYTES {
                let rotated = path.with_extension("log.1");
                let _ = std::fs::rename(&path, &rotated);
            }
        }
        if let Ok(file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = LOG_FILE.set(Mutex::new(file));
            let _ = LOG_PATH.set(path);
        }
    }
}

pub fn log_path() -> Option<&'static PathBuf> {
    LOG_PATH.get()
}

fn resolve_log_path() -> Option<PathBuf> {
    // %LOCALAPPDATA%\GameMacro\daemon.log
    let base = std::env::var_os("LOCALAPPDATA")?;
    let mut p = PathBuf::from(base);
    p.push("GameMacro");
    p.push("daemon.log");
    Some(p)
}

/// 给宏调用：拼时间戳 + level + 消息后写文件 + 镜像 stdout/stderr。
pub fn write(level: &str, args: std::fmt::Arguments<'_>) {
    let ts = format_timestamp();
    let line = format!("{ts} [{level}] {args}\n");

    if let Some(lock) = LOG_FILE.get() {
        if let Ok(mut f) = lock.lock() {
            let _ = f.write_all(line.as_bytes());
            let _ = f.flush();
        }
    }

    // debug build：镜像到控制台；release：windows_subsystem=windows 下 stdout 是 NUL，
    // 多写一次也无害（且 release cargo run 时仍能看到）
    #[cfg(debug_assertions)]
    {
        if level == "ERROR" || level == "WARN" {
            eprint!("{line}");
        } else {
            print!("{line}");
        }
    }
}

fn format_timestamp() -> String {
    // 简单 ISO8601-ish；不引 chrono
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, mi, s) = breakdown_utc(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

// 简版日历换算（够用）
fn breakdown_utc(mut secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    let s = (secs % 60) as u32;
    secs /= 60;
    let mi = (secs % 60) as u32;
    secs /= 60;
    let h = (secs % 24) as u32;
    let mut days = (secs / 24) as i64;

    let mut y: i32 = 1970;
    loop {
        let leap = is_leap(y);
        let yd = if leap { 366 } else { 365 };
        if days >= yd {
            days -= yd;
            y += 1;
        } else {
            break;
        }
    }
    let months = [31, 28 + if is_leap(y) { 1 } else { 0 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut mo: u32 = 1;
    for &md in &months {
        if days >= md {
            days -= md;
            mo += 1;
        } else {
            break;
        }
    }
    let d = (days as u32) + 1;
    (y, mo, d, h, mi, s)
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

#[macro_export]
macro_rules! log_info {
    ($($t:tt)*) => { $crate::logging::write("INFO",  format_args!($($t)*)); };
}
#[macro_export]
macro_rules! log_warn {
    ($($t:tt)*) => { $crate::logging::write("WARN",  format_args!($($t)*)); };
}
#[macro_export]
macro_rules! log_error {
    ($($t:tt)*) => { $crate::logging::write("ERROR", format_args!($($t)*)); };
}
```

**Step 2: 在 main.rs 顶部 `mod logging;`，并 `logging::init()`**

放在 `ensure_elevated()` 之前——日志在权限弹窗前就该可用。

**验收**：`cargo build -p gamemacro-daemon` 通过；不调用任何宏时仍能跑。

---

## Task 2：替换全部 println! / eprintln!

**Files:** Modify
- `crates/gamemacro-daemon/src/main.rs`
- `crates/gamemacro-daemon/src/state.rs`
- `crates/gamemacro-daemon/src/hotkey.rs`
- `crates/gamemacro-daemon/src/input.rs`
- `crates/gamemacro-daemon/src/loop_runtime.rs`
- `crates/gamemacro-daemon/src/elevation.rs`

**映射规则**（保持语义，不增不减）：
- 普通进度信息（"window is active" / "Profile activated" / "Hotkey (once)" / "start ..." / "stop ..." / "Configuration changed, reloading...") → `log_info!`
- 启动横幅 5 行 println → 压缩成 1 行 `log_info!("GameMacro Daemon v{} starting", env!("CARGO_PKG_VERSION"))`
- "Program is running..." 横幅 4 行 → 压缩成 1 行 `log_info!("Listening for hotkeys; waiting for window activation")`
- 错误路径 `eprintln!` → `log_error!`
- 提权过程的 println → `log_info!`，eprintln → `log_error!`
- `hotkey.rs::print_hotkey_configs` 的多行 → 保留逐行格式但走 `log_info!`（每行一条）；这函数仅启动时调用一次，可接受

**搜索基准**：
```powershell
Get-ChildItem crates\gamemacro-daemon\src -Recurse -Include *.rs |
  Select-String -Pattern '^\s*(println!|eprintln!)' -CaseSensitive
```
应当 0 命中（除 logging.rs 内部的 print!/eprint! 镜像之外）。

**注意**：宏定义在 crate root，子模块直接 `crate::log_info!` 调用即可，**不需要** `use`（`#[macro_export]` 已让宏在 crate 根可见）。模块内若觉得调用啰嗦，可在文件顶部 `use crate::{log_info, log_warn, log_error};`。

---

## Task 3：windows_subsystem 切换

**Files:** Modify
- `crates/gamemacro-daemon/src/main.rs`

**Step 1: 顶部加属性**

```rust
// release build 走 windows 子系统：双击 exe 无控制台窗口；
// debug build 仍带控制台，便于 cargo run。
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]
```

**Step 2: 验证 elevation 流程仍然 OK**

`elevation::request_elevation` 调用 `powershell -Command "Start-Process ... -Verb RunAs"`：
- 即使父进程是 windows 子系统也能正常 spawn powershell（powershell 自身有 console，弹出后 RunAs 起子进程，UAC 弹窗符合预期）
- 父进程随后 `exit(0)` 退出，子进程作为 elevated daemon 运行（同样 windows 子系统，无黑框）

debug build 不走 windows 子系统，黑框照常出现，提权也正常——开发体验不变。

---

## Task 4：build & smoke

**Step 1: 构建**

```powershell
cargo build -p gamemacro-daemon
cargo build -p gamemacro-daemon --release
```
都需 exit 0，且 release 下不应有 warning。

**Step 2: 手动验收**

debug：
- `cargo run -p gamemacro-daemon` 应仍打印日志到控制台（镜像）
- 同时 `%LOCALAPPDATA%\GameMacro\daemon.log` 也累积同样内容（打开应能看到 `[INFO] window is active` 等）

release：
- 双击 `target\release\gamemacro-daemon.exe` 后 UAC 弹窗，同意后**没有任何控制台窗口**
- 任务管理器能看到进程在跑
- `%LOCALAPPDATA%\GameMacro\daemon.log` 有启动行
- 编辑 `gamemacro.toml` 任意字段保存 → 日志立即追加 `Configuration changed, reloading...`
- 切到目标窗口前台 → 追加 `window is active` / `Profile activated`
- 退出方式：暂时只能任务管理器结束（4-B 之后才有 stop pipe）

**Step 3: 滚动测试（可选）**

把 `MAX_LOG_BYTES` 临时改为 4096 跑两轮 reload，确认 `daemon.log.1` 被生成且 `daemon.log` 重置后再追加。验证完恢复到 1 MiB。

---

## Task 5：commit

```
git add -A
git commit -m "feat(daemon): silence release build, write to %LOCALAPPDATA%\\GameMacro\\daemon.log

The daemon now compiles with windows_subsystem = \"windows\" in release,
so double-clicking gamemacro-daemon.exe no longer flashes a black
console. All previous println!/eprintln! call sites are routed
through three crate-local macros (log_info!/log_warn!/log_error!)
that append to %LOCALAPPDATA%\\GameMacro\\daemon.log with a 1 MiB
size-rotation to daemon.log.1.

Debug builds keep the console subsystem and additionally mirror every
log line to stdout/stderr, so 'cargo run' still works the same.

No new dependencies. The logging module is ~120 LoC of std-only code:
OnceLock<Mutex<File>> for the writer, manual UTC breakdown for the
ISO8601 timestamp, and #[macro_export] macros for ergonomics.

Stop / status IPC is intentionally not part of this change; it lives
in Sub-PR 4-B alongside the GUI status indicator.

Plan: docs/plans/2026-05-23-gamemacro-daemon-silence.md"
```

---

## 完成标准

- [ ] `cargo build -p gamemacro-daemon --release` 0 warning, 0 error
- [ ] release 双击 exe → UAC → 无黑框，进程在跑
- [ ] `%LOCALAPPDATA%\GameMacro\daemon.log` 持续累积有效信息
- [ ] debug `cargo run` 行为与之前几乎一致（多了文件镜像）
- [ ] 整 crate 内（除 `logging.rs`）`println!` / `eprintln!` 出现次数 = 0
- [ ] 所有现有功能（reload / activation / per-hotkey loop）行为不变

---

## 风险与对策

| 风险 | 对策 |
|---|---|
| `LOCALAPPDATA` 在某些权限提升场景为空 | `resolve_log_path` 返回 None 时跳过文件初始化；写入变 no-op，daemon 继续 |
| 文件锁阻塞日志调用 | 锁粒度 = 一次 `write_all+flush`，毫秒级；27 处调用频率极低 |
| windows_subsystem 后看不到 panic | 现有 `Result<(), Box<dyn Error>>` 路径都走 log_error! 后正常 return；剩下的真 panic 在 release 也不会让普通用户看见，但日志里会有崩溃前最后一条 INFO，足够定位 |
| `windows_subsystem = "windows"` 后 stdout 被重定向到 NUL，影响 `cargo run --release` 时调试 | 已用 debug_assertions 守门：`cargo run`（默认 debug）不会触发，只有真正 release build 才静默 |
