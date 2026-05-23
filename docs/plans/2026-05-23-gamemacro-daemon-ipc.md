# GameMacro 阶段 4 Sub-PR 4-B / 4-C：daemon IPC + GUI 状态灯 + 自动拉起

> 状态：实施中（接续 4-A 静默化）
> 日期：2026-05-23
> 前置：4-A（windows subsystem + 文件日志）已完成，commit 420fc62

**Goal:** 让 GUI 顶栏出现一个实时状态灯（gray/yellow/green），并能从下拉菜单里启动/停止 daemon、查看日志路径。所有跨进程通讯走单一命名管道 `\\.\pipe\gamemacro-daemon`。

---

## 4-B：daemon 命名管道（zero-deps，winapi only）

### 协议

每次连接 = 单轮请求/应答，连接随后关闭。daemon 端循环 accept。

| 请求行 | 响应行 |
|---|---|
| `STATUS\n` | JSON `{"running":true,"active":<bool>,"profile":<string\|null>,"profile_index":<int>,"pid":<u32>}\n` |
| `STOP\n` | `OK\n` 然后 daemon 主进程退出 |
| 其它 | `ERR unknown\n` |

JSON 用手拼字符串避免引 serde_json（daemon 这边只有这一处需要序列化）。

### 实现拆分

**Files:**
- Create: `crates/gamemacro-daemon/src/ipc.rs`
- Modify: `crates/gamemacro-daemon/Cargo.toml`（winapi feature 增加 `namedpipeapi` / `fileapi` / `synchapi`）
- Modify: `crates/gamemacro-daemon/src/main.rs`（spawn ipc::serve；准备一个 shutdown 通道驱动 STOP）
- Modify: `crates/gamemacro-daemon/src/state.rs`（新增 `snapshot() -> StateSnapshot` 暴露给 ipc 用）

**Step 1: ipc.rs 实现要点**
- 单线程同步 server：`CreateNamedPipeW` + `ConnectNamedPipe` + `ReadFile`/`WriteFile` + `DisconnectNamedPipe`，循环 reuse 同一实例
- 收到 STOP 时通过 `std::sync::mpsc::Sender<()>` 通知 main 主动退出（main 在 listen 之前 `block_on`-ish 等不到，直接 `std::process::exit(0)` 也可以）
- 命名管道 ACL：用 `PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED=0`（同步即可）；安全描述符传 NULL（默认 = 创建者+管理员可访问；GUI 此时也是 elevated 因为 daemon 是 elevated 的，不会出现 GUI 普通权限连不上的问题——4-C 验证）
- 单连接超时：`ReadFile` 直接阻塞读到 `\n`；恶意客户端不发数据时单实例阻塞——可接受（GUI 是唯一客户端）

**Step 2: main.rs 集成**
- `logging::init()` 后、`AppState::init_loop_runtime()` 前 spawn ipc 线程
- ipc 线程参数：`shutdown_tx: std::sync::mpsc::Sender<()>`
- main 末尾在 listen 之前不能阻塞收 shutdown（rdev::listen 自身阻塞），所以 STOP 直接 `std::process::exit(0)`，简单利落
  - 让 ipc 在响应 OK + flush 后再 exit，避免客户端读不到响应

**Step 3: state 暴露 snapshot**
```rust
pub struct StateSnapshot {
    pub active: bool,
    pub profile_name: Option<String>,
    pub profile_index: Option<usize>,
}
impl AppState {
    pub fn snapshot() -> StateSnapshot { ... }
}
```

**验收：**
- `cargo build -p gamemacro-daemon --release` 通过
- 跑起来后 `(echo STATUS) | ncat -U //./pipe/gamemacro-daemon`（PowerShell 用 `[System.IO.Pipes.NamedPipeClientStream]`）能看到 JSON
- 发 STOP 进程退出，日志最后一行 `Stop requested via IPC`

---

## 4-C：GUI 接入

### Tauri 端命令

**Files:**
- Modify: `crates/gamemacro-gui/src-tauri/Cargo.toml`（winapi feature 同上）
- Modify: `crates/gamemacro-gui/src-tauri/src/lib.rs`

新增三个 `#[tauri::command]`：
- `daemon_status() -> Result<DaemonStatus, String>`：连 pipe / 失败=down
- `daemon_stop() -> Result<(), String>`：连 pipe 发 STOP
- `daemon_spawn() -> Result<(), String>`：`ShellExecute runas` 起同目录的 `gamemacro-daemon.exe`（用 `Verb=runas` 触发 UAC 一次）

`DaemonStatus`：
```rust
#[derive(Serialize)]
pub struct DaemonStatus {
    pub running: bool,
    pub active: bool,
    pub profile: Option<String>,
}
```
失败时返回 `Ok(DaemonStatus{ running:false, .. })` 而不是 Err，方便前端轮询不报红。

### Frontend

**Files:**
- Modify: `crates/gamemacro-gui/src/lib/api.ts`：新增 `daemonStatus / daemonStop / daemonSpawn`，类型 `DaemonStatus`
- Create: `crates/gamemacro-gui/src/hooks/useDaemonStatus.ts`：每 2s 轮询；窗口失焦时不轮询（性能）
- Modify: `crates/gamemacro-gui/src/components/TopBar.tsx`：在齿轮按钮左侧加状态灯按钮
  - icon：圆点（CSS 实现）+ 文案
  - 颜色：green=running+active / yellow=running+inactive / gray=down
  - 点击弹 Menu：当前状态文字、`启动后端`（仅 down 时）、`停止后端`（仅 running 时）、`打开日志位置`（reveal `%LOCALAPPDATA%\GameMacro\daemon.log`）
  - 新增 `onSpawnDaemon` / `onStopDaemon` / `onRevealLog` 三个 props，由 App.tsx 注入
- Modify: `crates/gamemacro-gui/src-tauri/src/lib.rs`：新增 `reveal_log` 命令，定位 `%LOCALAPPDATA%\GameMacro\daemon.log`
- Modify: `crates/gamemacro-gui/src/App.tsx`：调用 hook，给 TopBar 注入 status 与三个 handler

### styles 增项

`useStyles.ts`：加 `statusDot` / `statusDotRunning` / `statusDotInactive` / `statusDotDown` 三态颜色（用 fluent `tokens.colorPaletteGreenForeground1` / `tokens.colorPaletteYellowForeground1` / `tokens.colorNeutralForeground3`）。

### 清理

- `git rm` 空目录 `crates/gamemacro-gui/src/components/Sidebar/`（在 4-A 之前的某次重构遗留）

---

## 完成标准

- [ ] daemon release build 暴露 `\\.\pipe\gamemacro-daemon`，STATUS / STOP 都正确响应
- [ ] GUI 顶栏右上有圆点状态灯，每 2 秒刷新
- [ ] daemon 不在跑时灯=灰，菜单里有「启动后端」可以一键 spawn（UAC 一次）
- [ ] daemon 在跑时菜单里有「停止后端」（一键退出 daemon 进程）
- [ ] 「打开日志位置」打开 `%LOCALAPPDATA%\GameMacro\` 文件夹
- [ ] 0 新增依赖；只新增一个 winapi feature flag

---

## 不做（明确 YAGNI）

- ❌ daemon 推送（pub/sub）→ 仍走 GUI 主动轮询，足够
- ❌ overlapped IO / async pipe → 单线程同步够用
- ❌ pipe 鉴权 / token impersonation → daemon/GUI 都是 elevated 同进程组，默认 ACL OK
- ❌ 多 daemon 实例检测 → CreateNamedPipe 在已存在时返回 ERROR_PIPE_BUSY，简单 log_error 后退出即可
