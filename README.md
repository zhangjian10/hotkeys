# GameMacro

> 给游戏加一组宏热键，按一次循环执行  
> 自定义快捷键 · 一键连发 · 专为游戏打造

GameMacro 让你为任意 Windows 游戏挂上**自定义组合键 → 自动输入指令**的宏。按一次开始循环输入，再按一次停止。配置一次，整盘游戏不用再手敲。

## 功能特性

- **全局热键监听** — 在任何窗口都能响应热键
- **智能窗口检测** — 只在目标游戏窗口激活时工作
- **一键循环 / 一次输入** — 每条热键独立配置 `repeat`
- **多游戏 Profile** — 一份配置文件管理多款游戏
- **配置热重载** — 改完即生效，无需重启
- **单一可执行文件** — 引擎内嵌进 GUI，启动一次 UAC，进 / 退一次完成

## 系统要求

- Windows 10 / 11
- 管理员权限（首次启动会弹一次 UAC）

## 快速开始

```cmd
# 构建
cargo build --release

# 启动（弹 UAC 后即可使用）
target\release\gamemacro.exe
```

进 GUI 后：

1. 顶栏「+ 新游戏」创建 Profile，选目标窗口
2. 主区「+ 新增热键」，点徽章录制组合键，填入要发的文本
3. 切到目标游戏窗口，按下组合键即开始循环输入；再按一次停止

配置文件 `gamemacro.toml` 自动写到 `gamemacro.exe` 同目录，改完即时生效（GUI 自动保存 + 引擎自动 reload）。

## 项目分发

| 可执行文件 | 用途 | 是否需要管理员 |
|---|---|---|
| `gamemacro.exe` | 配置编辑 + 后台引擎（一体） | ✅ 自动请求一次 |

## 配置

首次运行会在 `gamemacro.exe` 同目录创建 `gamemacro.toml`。

### 通过 GUI 编辑（推荐）

- **顶栏**：Profile 切换 / 新游戏 / 引擎状态灯（点击可启停热键监听 / 打开日志）/ 设置
- **热键卡片**：每条热键一张卡片，点击展开内联编辑；徽章可直接录制组合键
- **设置弹窗**：循环间隔、按键延迟、目标窗口、启用热键监听开关、打开日志文件

### 直接编辑 TOML

```toml
[[profiles]]
name = "魔兽争霸"
window_keywords = ["%warcraft iii%"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifiers   = ["Ctrl"]      # 多个修饰键写数组：["Ctrl", "Shift"]
trigger_key = "X"           # BackQuote / Num0-9 / F1-F12 / A-Z
input_string = "-ss"
description  = "召唤刑天"
repeat       = true         # 缺省 true
# interval_secs_override = 5  # 可选：覆盖此条热键的循环间隔
```

模糊匹配窗口标题用 `%xxx%` 写法。

### 支持的按键

- **修饰键**：`Alt` · `Ctrl` · `Shift` · `Meta`
- **触发键**：`BackQuote`（反引号）/ `Num0`-`Num9` / `F1`-`F12` / `A`-`Z`

## 日志

引擎日志写到 `%LOCALAPPDATA%\GameMacro\gamemacro.log`，1 MiB 滚动到 `.log.1`。

GUI 设置弹窗 → 全局 → 「打开日志文件」可在资源管理器中定位。

常见日志条目：

- `engine ready` — 引擎已启动，监听热键
- `window is active` / `window is inactive` — 目标窗口聚焦/失焦
- `start <text> (every Ns)` / `stop <text>` — 循环开始/结束
- `Configuration changed, reloading...` — 配置文件被改并已重载
- `engine enabled = true/false` — 用户切换"启用热键监听"开关

## 开发

### 构建

```cmd
# 调试版本（不挂 manifest，普通权限即可跑；hotkey 在 debug 下静默失效）
cargo build

# 发布版本（挂 requireAdministrator manifest）
cargo build --release

# 单独构建
cargo build -p gamemacro-engine
cargo build -p gamemacro-gui

# 单元测试
cargo test -p gamemacro-core
```

调试 hotkey 行为时请用「以管理员身份运行」启动 PowerShell 后再 `cargo run`，否则 rdev 全局 hook 装不上。

### 项目结构（Cargo workspace）

```
gamemacro/
├── Cargo.toml                    # workspace 根
├── gamemacro.toml                # 用户配置（运行时）
├── crates/
│   ├── gamemacro-core/           # 共享库：Config / 按键映射 / 单元测试
│   ├── gamemacro-engine/         # 后台引擎（lib）：rdev hook + 循环输入 + 窗口检测
│   │                             # 无 binary，由 GUI 直接 link
│   └── gamemacro-gui/            # 唯一 binary：Tauri v2 + React 19 + Fluent UI v9
│       ├── src/                  # 前端
│       └── src-tauri/            # Tauri 后端 + manifest（release 挂 requireAdministrator）
└── docs/plans/                   # 设计与实施记录
```

## 常见问题

### Q: 为什么需要管理员权限？
A: Windows 全局键盘 hook 需要底层访问权限。整合后只需开启时弹一次 UAC，之后整个会话都是管理员。

### Q: 录制热键时按下组合键不响应？
A: 让 GUI 窗口保持聚焦再按下组合键。GUI 只监听本窗口键盘事件，不与全局 hook 抢事件。

### Q: 改完配置后没生效？
A: GUI 500ms 防抖自动保存；保存后引擎再 500ms 防抖 reload，整体最多 1s 反映。检查 `gamemacro.log` 中是否出现 `Configuration changed, reloading...`。

### Q: 不想热键意外触发（开会 / 录屏）怎么办？
A: 顶栏点状态灯，关闭「启用热键监听」开关；或在设置弹窗 → 全局 tab 操作。引擎仍在跑但所有热键短路，重新打开开关即恢复。

### Q: 程序无法启动？
A: 1) 确认 Rust 工具链（项目使用 nightly，详见 `rust-toolchain.toml`）；2) UAC 必须允许；3) 检查杀毒软件是否拦截。

### Q: 热键不响应？
A: 1) 目标窗口是否聚焦（顶栏状态灯应为绿色）；2) 「启用热键监听」是否打开（不要是灰色 ⚪）；3) 看日志 `gamemacro.log`。

### Q: 如何添加新热键？
A: 推荐用 GUI 的「+ 新增」按钮；也可直接编辑 `gamemacro.toml` 增加 `[[profiles.hotkeys]]`。

## 路线图

- [x] 阶段 1：项目改名为 GameMacro
- [x] 阶段 2：HotkeyConfig 增加 `repeat` / `interval_secs_override` 字段
- [ ] 阶段 3：GUI 重构（Fluent UI 卡片化 + 组合键徽章 + 自动保存）— 进行中
- [x] 阶段 4：引擎合并入 GUI（单 binary + 应用内日志入口）— 取代原"daemon 静默化"

详见 `docs/plans/2026-05-23-engine-merge-design.md`。

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests。
