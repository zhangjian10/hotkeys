# Engine 整合方案：daemon 进程并入 GUI

> 状态：已与用户确认，进入实现
> 日期：2026-05-23
> 取代：原设计 §11「阶段 4：Daemon 静默化」（不再做命名管道方案，直接整合进同一进程）

---

## 0. 背景

现状是两个 binary：
- `gamemacro-daemon.exe`（admin，全局热键 + 自动输入）
- `gamemacro.exe`（user，配置编辑 GUI）

通过共享 `gamemacro.toml` + 命名管道 `\\.\pipe\gamemacro-daemon` 通信。问题：
1. 用户必须显式启动两个进程，认知成本高
2. 权限不对等（一个 admin、一个 user），加重边界处理代码（IPC 客户端、自提权、状态轮询）
3. 命名管道协议是手写 JSON 拼装 / 解析（~250 行 lib.rs + 200 行 ipc.rs）

整合后只剩单一 `gamemacro.exe`，启动一次 UAC，UI 上一个入口可看日志。

---

## 1. 决策记录

| # | 决策点 | 选择 | 理由 |
|---|---|---|---|
| 1 | 权限模型 | manifest `requireAdministrator` | 与现 daemon 一致，用户已习惯 |
| 2 | rdev 监听位置 | 独立 std 线程 spawn `rdev::listen` | rdev 内部跑 GetMessage，跟主线程脱钩 |
| 3 | crate 物理结构 | `gamemacro-daemon` 改名 `gamemacro-engine`，转 lib，GUI 依赖 | 关注点分离，rdev/winapi 重依赖留在自己 crate |
| 4 | 日志查看入口 | 设置弹窗加按钮 → 资源管理器定位日志 | "即可"暗示最简实现 |
| 5 | IPC（命名管道） | 全删 | 同进程进程内调用更直接、类型安全 |
| 6 | "热键监听"开关 | 保留，运行时 toggle | 用户场景：开会/录屏临时禁用而不必关 GUI |
| 7 | 开发期权限 | debug build 不挂 manifest，release 挂 | 日常调 UI 不必每次 UAC |
| - | 日志文件名 | `daemon.log` → `gamemacro.log` | 不再有 daemon 概念 |

---

## 2. 架构

### 整合前
```
gamemacro-daemon.exe (admin) ──pipe──┐
                                     ├─ 共享 gamemacro.toml（文件 + notify watcher）
gamemacro.exe         (user) ────────┘
```

### 整合后
```
gamemacro.exe (admin, single process)
├─ Tauri main loop（主线程，webview & invoke）
└─ 后台线程（engine::start 中 spawn）
   ├─ rdev hook thread       ── listen() 阻塞 + GetMessage 泵
   ├─ tokio runtime          ── per-hotkey 循环 task
   ├─ enigo input worker     ── std::sync::mpsc 串行化
   └─ notify watcher thread  ── 配置文件变更 → reload

注：SetWinEventHook(WINEVENT_OUTOFCONTEXT) 由系统线程驱动，不占应用线程。
```

进程退出 = 所有线程随之退出（普通 thread / OS 自动清理）。

---

## 3. Crate 改动

### `gamemacro-daemon` → `gamemacro-engine`

操作：
- `mv crates/gamemacro-daemon crates/gamemacro-engine`
- `rm crates/gamemacro-engine/{app.manifest,build.rs,src/elevation.rs,src/ipc.rs}`
- `mv crates/gamemacro-engine/src/main.rs crates/gamemacro-engine/src/lib.rs`
- 改造 `lib.rs`：暴露 `pub fn start(config_path: PathBuf)` + `set_enabled(bool)` + `is_enabled() -> bool`

`Cargo.toml`：
- 删 `[[bin]]` / `[build-dependencies]` / `[package.metadata.winres]`
- winapi feature 收窄（删 `securitybaseapi` / `namedpipeapi` / `fileapi` / `winbase` / `winerror` / `errhandlingapi`）
- 新增 `[lib]` 默认 rlib

### `gamemacro-engine::AppState` 新增

```rust
pub static ref ENABLED: AtomicBool = AtomicBool::new(true);
// 配套方法
AppState::is_enabled() -> bool
AppState::set_enabled(bool)
// snapshot 增字段：enabled
```

`hotkey.rs::handle_key_event` 入口最前增加：
```rust
if !AppState::is_enabled() { return; }
```

`set_enabled(false)` 时调用 `HotkeyManager::cancel_all()` 收尾正在跑的循环。

### `gamemacro-gui/src-tauri`

新增依赖：`gamemacro-engine = { path = "../../gamemacro-engine" }`

winapi feature 收窄（删 `namedpipeapi` / `fileapi` / `winbase` / `handleapi` / `winnt` / `winerror` / `errhandlingapi` / `shellapi`）

`build.rs` 区分 build profile：debug 不挂 manifest，release 挂 `requireAdministrator`（manifest 从 daemon 搬过来）。

`lib.rs` 改动：
- 删 ~250 行 IPC 客户端（`ipc_round_trip` / `parse_status_json` / `json_*` / `spawn_elevated`）
- `daemon_status` 命令 → 直接调 `gamemacro_engine::AppState::snapshot()` 返回 `EngineStatus`
- 删 `daemon_stop` / `daemon_spawn` 命令
- `reveal_log` 中文件名改 `gamemacro.log`
- 新增命令 `set_engine_enabled(enabled: bool)` / `engine_enabled() -> bool`
- `setup` 闭包：`gamemacro_engine::start(resolve_config_path())?`

`EngineStatus`（取代 `DaemonStatus`）：
```rust
pub struct EngineStatus {
    pub active: bool,                  // 命中 profile（窗口聚焦）
    pub enabled: bool,                 // 用户开关
    pub profile: Option<String>,
    pub profile_index: Option<usize>,
}
```

---

## 4. 前端改动

### `lib/api.ts`
- `DaemonStatus` → `EngineStatus`，删 `running` / `pid`，增 `enabled` / `profile_index`
- `daemonStatus` → `engineStatus`
- 删 `daemonStop` / `daemonSpawn`
- 新增 `setEngineEnabled` / `engineEnabled`

### `hooks/useDaemonStatus.ts` → `useEngineStatus.ts`
2s 轮询不变，类型改 `EngineStatus`。

### `components/TopBar.tsx` 状态灯
三态映射改为：

| `enabled` | `active` | 视觉 | Label |
|---|---|---|---|
| false | * | ⚪ | 已禁用 |
| true | false | 🟡 | 等待目标窗口 |
| true | true | 🟢 | 运行中 · {profile} |

下拉菜单删除「启动后端 / 停止后端」，只留「打开日志位置」。

### `components/SettingsDialog.tsx` 全局 tab
```
[Switch] 启用热键监听            ← 新，绑 engineEnabled
[Button] 打开日志文件            ← 新，调 reveal_log
```

---

## 5. 实施步骤

1. crate 改名 + workspace `members` 调整 + 全仓 grep 替换 `gamemacro_daemon` / `gamemacro-daemon`
2. engine crate 转 lib：`main.rs` → `lib.rs`，删 ipc/elevation/manifest/build.rs，加 `start` / `set_enabled` / `is_enabled`，logging 文件名改 `gamemacro.log`
3. `state.rs` 加 `ENABLED` + getter/setter；`hotkey.rs` 加短路；`snapshot` 加 enabled
4. GUI src-tauri：加依赖、加 build.rs、复制 manifest、setup 调 start、命令重写、winapi feature 收窄
5. 前端 api/hooks/components 适配
6. README 更新（单 binary、移除"daemon 控制台状态"段、改"项目分发"表）

每步 `cargo build` 通过再下一步。

---

## 6. 手测验收

release build 跑：

1. 双击 `gamemacro.exe` → UAC 弹一次 → 主窗口出现 → `gamemacro.log` 出现 `engine ready`
2. 状态灯：未聚焦目标窗口 🟡 → 聚焦 🟢
3. 触发热键：`Ctrl+X` → 目标窗口循环输入，再按一次停止
4. 关「启用热键监听」→ 状态灯变 ⚪ → 按 `Ctrl+X` 不响应；重新打开 → 恢复
5. 「打开日志文件」→ 资源管理器选中 `%LOCALAPPDATA%\GameMacro\gamemacro.log`
6. GUI 改 input_string → 500ms 后 `gamemacro.log` 出现 `Configuration changed, reloading...`
7. 关闭 GUI → 进程列表无残留

---

## 7. 风险

| 风险 | 对策 |
|---|---|
| rdev 在非主线程的 LL hook 不稳 | rdev 内部 `GetMessage` 跑在 spawn 出的线程，Windows 7+ 公认可行；真出问题回滚到双进程 |
| GUI 永远要 admin 才能跑 | A 方案接受成本；想单独编辑配置可走「以普通账户启动」时仅 hotkey 静默失效（rdev listen 报错但 UI 仍工作）—— 但本次实施不引入此分支 |
| Tauri panic 拖死 engine | 单进程一致退出，比双进程"daemon 还在但 UI 死"反而更可预测 |
| 旧 `daemon.log` 文件残留 | 留着不动；用户想清理自己删 |
