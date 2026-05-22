# GameMacro

> 给游戏加一组宏热键，按一次循环执行  
> 自定义快捷键 · 一键连发 · 专为游戏打造

GameMacro 让你为任意 Windows 游戏挂上**自定义组合键 → 自动输入指令**的宏。按一次开始循环输入，再按一次停止。配置一次，整盘游戏不用再手敲。

> 旧用户：之前的 `hotkeys.toml` 在首次启动 daemon 时会被自动迁移为 `gamemacro.toml`，无需手动操作。

## 功能特性

- **全局热键监听** — 在任何窗口都能响应热键
- **智能窗口检测** — 只在目标游戏窗口激活时工作
- **一键循环 / 一次输入** — 每条热键独立配置（V0.2 起；当前默认全部循环）
- **多游戏 Profile** — 一份配置文件管理多款游戏
- **配置热重载** — 修改后无需重启 daemon
- **图形配置工具** — 独立 GUI 编辑配置（Tauri + React + Fluent UI v9）
- **自动管理员权限** — daemon 自动请求管理员权限

## 系统要求

- Windows 10 / 11
- 管理员权限（daemon 自动请求；GUI 不需要）

## 快速开始

```cmd
# 1. 构建（同时产出 daemon 与 GUI）
cargo build --release

# 2. 启动 daemon（会自动请求管理员权限）
target\release\gamemacro-daemon.exe

# 3. 启动 GUI 编辑配置
target\release\gamemacro.exe
```

GUI 修改保存后，daemon 通过文件监听自动 reload，**无需重启**。

## 项目分发

| 可执行文件 | 用途 | 是否需要管理员 |
|---|---|---|
| `gamemacro-daemon.exe` | 后台监听全局热键 + 自动输入 | ✅ 自动请求 |
| `gamemacro.exe` | 图形化配置编辑器 | ❌ 不需要 |

## 配置

首次运行 daemon 会在同目录下创建 `gamemacro.toml`。

### 通过 GUI 编辑（推荐）

启动 `gamemacro.exe`：

- **顶栏**：Profile 切换 / 新游戏 / 状态指示 / 设置
- **热键卡片**：每条热键一张卡片，点击展开内联编辑；徽章可直接录制组合键
- **设置弹窗**：循环间隔、按键延迟、窗口匹配关键词等

### 直接编辑 TOML

```toml
[[profiles]]
name = "魔兽争霸"
window_keywords = ["warcraft iii"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"        # Alt / Ctrl / Shift / Meta
trigger_key  = "X"           # BackQuote / Num0-9 / F1-F12 / A-Z
input_string = "-ss"
description  = "召唤刑天"
```

模糊匹配窗口标题用 `%xxx%` 写法（例：`["%dota%"]`）。

### 支持的按键

- **修饰键**：`Alt` · `Ctrl` · `Shift` · `Meta`
- **触发键**：`BackQuote`（反引号）/ `Num0`-`Num9` / `F1`-`F12` / `A`-`Z`

## 使用流程

1. **启动 daemon** — 自动请求管理员权限并加载 `gamemacro.toml`
2. **（可选）启动 GUI** — 编辑配置，保存后 daemon 自动 reload
3. **激活游戏窗口** — daemon 检测窗口激活后启用热键
4. **按下热键** — 触发自动输入；再次按下相同热键停止该项循环

### daemon 控制台状态

- `window is active` — 目标窗口已激活，热键可用
- `window is inactive` — 目标窗口未激活，热键暂停
- `Configuration changed, reloading...` — 检测到 `gamemacro.toml` 修改并已重载
- `Migrated config: hotkeys.toml -> gamemacro.toml` — 自动迁移旧配置

## 开发

### 构建

```cmd
# 调试版本（同时构建 daemon + GUI）
cargo build

# 发布版本
cargo build --release

# 单独构建
cargo build -p gamemacro-daemon
cargo build -p gamemacro-gui

# 单元测试
cargo test -p gamemacro-core
```

### 项目结构（Cargo workspace）

```
gamemacro/
├── Cargo.toml                    # workspace 根 + release profile
├── gamemacro.toml                # 用户配置（运行时）
├── crates/
│   ├── gamemacro-core/           # 共享库：Config / 按键映射
│   │   ├── default_config.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── config.rs
│   │       └── keys.rs
│   ├── gamemacro-daemon/         # 后台监听器
│   │   ├── app.manifest
│   │   ├── build.rs
│   │   └── src/
│   │       ├── main.rs
│   │       ├── auto_input.rs
│   │       ├── elevation.rs
│   │       ├── hotkey.rs
│   │       ├── input.rs
│   │       ├── state.rs
│   │       └── window.rs
│   └── gamemacro-gui/            # 图形配置工具（Tauri v2 + React 19 + Fluent UI v9）
│       ├── src/                  # 前端
│       └── src-tauri/            # Tauri 后端
└── docs/
    └── plans/
        ├── 2026-05-23-gamemacro-redesign-design.md   # 当前设计方案
        ├── 2026-05-23-gamemacro-rename.md            # 阶段 1（改名）实施计划
        └── 2026-05-22-gui-design.md                  # ⚠️ 旧设计稿，已废弃
```

## 常见问题

### Q: 为什么 daemon 需要管理员权限？
A: 全局热键监听需要底层系统访问权限，这是 Windows 的安全限制。

### Q: GUI 也需要管理员权限吗？
A: 不需要。GUI 只读写 `gamemacro.toml` 配置文件，daemon 通过文件监听自动应用变更。

### Q: 录制热键时按下组合键不响应？
A: 让 GUI 窗口保持聚焦再按下组合键。GUI 仅监听本窗口的键盘事件，不开全局键盘 hook，因此不会与 daemon 抢事件，也不需要管理员权限。

### Q: 我的旧 `hotkeys.toml` 怎么办？
A: 把它放在新的 `gamemacro-daemon.exe` 同目录下，daemon 启动时会自动 rename 为 `gamemacro.toml`。控制台会输出一行迁移日志。

### Q: 修改配置后 daemon 没自动加载？
A: 检查 daemon 控制台是否输出 `Configuration changed, reloading...`。如果 GUI 还没保存，配置不会变更（V0.2 起改为自动保存）。

### Q: 程序无法启动？
A: 1) 确认 Rust 工具链（项目使用 nightly，详见 `rust-toolchain.toml`）；2) daemon 需要管理员权限；3) 检查杀毒软件是否拦截。

### Q: 热键不响应？
A: 1) 目标窗口是否激活（daemon 控制台显示 `window is active`）；2) 配置中的按键名称是否正确；3) 是否有其他程序占用相同热键。

### Q: 如何添加新热键？
A: 推荐用 GUI 的「+ 新增」按钮；也可以直接编辑 `gamemacro.toml` 增加 `[[profiles.hotkeys]]` 段。

## 路线图

- [x] 阶段 1：项目改名为 GameMacro（机械性，零行为变化）
- [ ] 阶段 2：HotkeyConfig 增加 `repeat` / `interval_secs_override` 字段
- [ ] 阶段 3：GUI 重构（Fluent UI 卡片化 + 组合键徽章 + 自动保存）
- [ ] 阶段 4：daemon 静默化（无控制台窗口 + 命名管道）

详见 `docs/plans/2026-05-23-gamemacro-redesign-design.md`。

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests。
