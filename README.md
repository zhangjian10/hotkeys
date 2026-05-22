# Warcraft Hotkeys Helper

一个专为魔兽争霸III设计的全局热键助手，支持自动输入和热键管理。

## 🚀 功能特性

- ✅ **全局热键监听** - 在任何窗口都能响应热键
- ✅ **自动管理员权限** - 程序会自动请求管理员权限
- ✅ **智能窗口检测** - 只在魔兽争霸窗口激活时工作
- ✅ **可配置热键** - 通过配置文件或图形界面自定义热键
- ✅ **配置热重载** - 修改配置后无需重启 daemon
- ✅ **图形配置工具** - 独立的 GUI 用于编辑配置
- ✅ **自动输入循环** - 支持定时自动输入命令

## 🔧 系统要求

- Windows 10/11
- 管理员权限（daemon 会自动请求；GUI 配置工具不需要）

## 📦 安装和运行

项目分为两个可执行文件：

| 可执行文件 | 用途 | 是否需要管理员权限 |
|---|---|---|
| `hotkeys-daemon.exe` | 后台监听全局热键并执行自动输入 | ✅ 需要（自动请求） |
| `hotkeys-gui.exe` | 图形化的配置编辑器 | ❌ 不需要 |

### 快速开始

```cmd
# 1. 构建（同时产出 daemon 与 GUI）
cargo build --release

# 2. 启动后台 daemon（会自动请求管理员权限）
target\release\hotkeys-daemon.exe

# 3. 启动 GUI 编辑配置（双击或命令行均可）
target\release\hotkeys-gui.exe
```

GUI 修改并保存后，daemon 会通过文件监听自动 reload，**无需重启**。

## ⚙️ 配置

程序首次运行时会在 daemon 同目录下创建 `hotkeys.toml` 配置文件。

### 通过 GUI 编辑（推荐）

启动 `hotkeys-gui.exe` 后：

- **全局设置区**：编辑窗口关键词、自动输入间隔、输入延迟
- **热键列表区**：增删改每条热键
  - 修饰键 / 触发键支持下拉框选择
  - 也支持「🎙 录制」按钮：聚焦窗口后按下组合键即可自动捕获
  - 输入内容支持多行编辑（换行 = 游戏内回车）
- 修改后标题会出现 `*`，点击「保存 (Ctrl+S)」落盘
- 关闭窗口时若存在未保存修改会弹出三选项确认框

### 直接编辑 TOML

配置文件结构：

```toml
# 窗口关键词 - 用于检测目标窗口（魔兽争霸）
window_keywords = ["warcraft iii"]

# 自动输入间隔（秒）
auto_input_interval_secs = 3

# 输入延迟（毫秒）
input_delay_millis = 50

# 热键配置
[[hotkeys]]
modifier_key = "Ctrl"        # 修饰键：Alt, Ctrl, Shift, Meta
trigger_key = "X"            # 触发键：BackQuote(`), Num0-9, F1-F12, A-Z
input_string = """-ss"""     # 要输入的字符串（支持多行）
description = "召唤刑天"     # 描述（可选）
```

### 支持的按键

**修饰键**：`Alt`, `Ctrl`, `Shift`, `Meta`

**触发键**：
- 反引号：`BackQuote`
- 数字键：`Num0` - `Num9`
- 功能键：`F1` - `F12`
- 字母键：`A` - `Z`

## 🎮 使用说明

1. **启动 daemon** —— 会自动请求管理员权限并加载配置
2. **（可选）启动 GUI** —— 双击 `hotkeys-gui.exe` 编辑配置，保存后 daemon 自动 reload
3. **激活魔兽窗口** —— daemon 检测到窗口激活后启用热键
4. **使用热键** —— 按下配置的组合键触发自动输入；再次按下相同热键停止该项循环

### 状态指示（daemon 控制台）

- `window is active` — 目标窗口已激活，热键可用
- `window is inactive` — 目标窗口未激活，热键暂停
- `Configuration changed, reloading...` — 检测到 `hotkeys.toml` 修改并已重载

## 🛠️ 开发

### 构建

```cmd
# 调试版本（构建 daemon + GUI）
cargo build

# 发布版本
cargo build --release

# 只构建其中一个
cargo build -p hotkeys-daemon
cargo build -p hotkeys-gui

# 跑单元测试
cargo test -p hotkeys-core
```

### 项目结构（Cargo workspace）

```
hotkeys/
├── Cargo.toml                  # workspace 根 + release profile
├── hotkeys.toml                # 用户配置
├── crates/
│   ├── hotkeys-core/           # 共享库：Config 类型、按键映射
│   │   ├── default_hotkeys.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── config.rs
│   │       └── keys.rs
│   ├── hotkeys-daemon/         # 后台监听器（原 src/）
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
│   └── hotkeys-gui/            # 图形配置工具（native-windows-gui）
│       └── src/
│           ├── main.rs
│           ├── app.rs
│           ├── recorder.rs
│           └── views/
│               ├── mod.rs
│               ├── settings.rs
│               └── hotkeys.rs
└── docs/
    └── plans/
        └── 2026-05-22-gui-design.md  # 设计方案
```

## ❓ 常见问题

### Q: 为什么 daemon 需要管理员权限？
A: 全局热键监听需要底层系统访问权限，这是 Windows 的安全限制。

### Q: GUI 也需要管理员权限吗？
A: 不需要。GUI 只读写 `hotkeys.toml` 配置文件，daemon 通过文件监听自动应用变更。

### Q: GUI 里录制热键时，按了组合键不响应？
A: 点击右侧编辑面板的「● 录制」按钮，**让 GUI 窗口保持聚焦**，然后按下组合键即可自动捕获修饰键 + 触发键。按 `Esc` 取消。
GUI 仅监听本窗口的键盘事件，不开全局键盘 hook，因此不会与 daemon 抢事件，也不需要管理员权限。

### Q: 修改配置后 daemon 没有自动加载？
A: 检查：
1. GUI 是否已点击「保存」按钮（标题栏 `*` 消失即代表已保存）
2. daemon 是否仍在运行（控制台是否输出 reloading 日志）

### Q: 程序无法启动怎么办？
A: 确保：
1. 已安装 Rust 工具链（项目使用 nightly，详见 `rust-toolchain.toml`）
2. daemon 使用管理员权限运行
3. 检查杀毒软件是否拦截

### Q: 热键不响应怎么办？
A: 检查：
1. 目标窗口是否激活（daemon 控制台显示 `window is active`）
2. 配置文件中的按键名称是否正确
3. 是否有其他程序占用相同热键

### Q: 如何添加新的热键？
A: 推荐用 GUI 的「+ 新增」按钮；也可以直接编辑 `hotkeys.toml` 添加 `[[hotkeys]]` 段落。

## 📄 许可证

此项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！
