# Warcraft Hotkeys Helper

一个专为魔兽争霸III设计的全局热键助手，支持自动输入和热键管理。

## 🚀 功能特性

- ✅ **全局热键监听** - 在任何窗口都能响应热键
- ✅ **自动管理员权限** - 程序会自动请求管理员权限
- ✅ **智能窗口检测** - 只在魔兽争霸窗口激活时工作
- ✅ **可配置热键** - 通过配置文件自定义热键
- ✅ **自动输入循环** - 支持定时自动输入命令

## 🔧 系统要求

- Windows 10/11
- 管理员权限（程序会自动请求）

## 📦 安装和运行


### 方法 1: 手动运行

1. 构建程序后，右键点击 `target\release\hotkeys.exe`
2. 选择"以管理员身份运行"

### 方法 2: 直接运行（自动请求权限）

```cmd
target\release\hotkeys.exe
```

程序会自动检测权限，如果没有管理员权限会自动重启并请求权限。

## ⚙️ 配置

程序首次运行时会创建 `config.toml` 配置文件。

### 配置文件结构

```toml
# 窗口关键词 - 用于检测魔兽争霸窗口
window_keywords = ["warcraft iii"]

# 自动输入间隔（秒）
auto_input_interval_secs = 2

# 输入延迟（微秒）
input_delay_micros = 200

# 热键配置
[[hotkeys]]
modifier_key = "Alt"        # 修饰键：Alt, Ctrl, Shift, Meta
trigger_key = "BackQuote"   # 触发键：BackQuote(`), Num1-9, F1-F12, 等
input_string = "-ww\n\n-dd\n"  # 要输入的字符串（\n 表示回车）
description = "warcraft workers and defenders"  # 描述（可选）

[[hotkeys]]
modifier_key = "Alt"
trigger_key = "Num1" 
input_string = "-ss\n\n-aa\n"
description = "start soldiers and archers"
```

### 支持的按键

**修饰键：**
- `Alt`, `Ctrl`, `Shift`, `Meta`

**触发键：**
- 数字键：`Num0` - `Num9`
- 功能键：`F1` - `F12` 
- 特殊键：`BackQuote` (`) 等
- 字母键：`KeyA` - `KeyZ`

## 🎮 使用说明

1. **启动程序** - 使用管理员权限运行
2. **等待检测** - 程序会检测魔兽争霸窗口是否激活
3. **使用热键** - 在魔兽争霸中按下配置的热键组合
4. **自动循环** - 触发的命令会自动循环执行，再次按热键可停止

### 状态指示

- ✅ `warcraft window is active` - 魔兽争霸窗口已激活，热键可用
- ❌ `warcraft window is inactive` - 魔兽争霸窗口未激活，热键暂停

## 🛠️ 开发

### 构建

```cmd
# 调试版本
cargo build

# 发布版本
cargo build --release
```

### 项目结构

```
src/
├── main.rs          # 主程序入口
├── config.rs        # 配置管理
├── elevation.rs     # 权限管理
├── window.rs        # 窗口检测
├── input.rs         # 输入管理
├── hotkey.rs        # 热键处理
├── auto_input.rs    # 自动输入
└── state.rs         # 状态管理
```

## ❓ 常见问题

### Q: 为什么需要管理员权限？
A: 全局热键监听需要底层系统访问权限，这是Windows的安全限制。

### Q: 程序无法启动怎么办？
A: 确保：
1. 已安装Rust工具链
2. 使用管理员权限运行
3. 检查杀毒软件是否拦截

### Q: 热键不响应怎么办？
A: 检查：
1. 魔兽争霸窗口是否激活
2. 配置文件中的按键名称是否正确
3. 是否有其他程序占用相同热键

### Q: 如何添加新的热键？
A: 编辑 `config.toml` 文件，按照现有格式添加新的 `[[hotkeys]]` 段落。

## 📄 许可证

此项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！
