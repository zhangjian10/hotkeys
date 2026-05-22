# GUI 配置工具设计文档

> **⚠️ DEPRECATED 2026-05-23：本设计稿已被 `2026-05-23-gamemacro-redesign-design.md` 取代。保留仅作历史参考。**
>
> 创建日期: 2026-05-22
> 范围: 为 hotkeys 项目增加独立的 GUI 配置工具
> 状态: 已确认，进入实施

## 背景

当前 hotkeys 项目是一个 Windows 全局热键工具，所有配置（窗口关键词、热键列表、自动输入间隔、输入延迟）通过手动编辑 `hotkeys.toml` 完成。配置文件已支持 `notify` 文件监听 + 热重载。

目标: 提供一个图形化的配置编辑器，降低用户使用门槛，但不影响后台监听器的体积与稳定性。

## 总体决策

| 维度 | 决策 | 理由 |
|---|---|---|
| 部署形态 | 独立 GUI + 原 CLI 后台进程（双 exe） | 后台体积保持精简；通过现有 `notify` 热重载机制解耦，零 IPC |
| GUI 库 | egui (eframe) | 即时模式 API 简洁，写表单/列表最快；crates.io 稳定版本；Windows 一等支持 |
| 项目结构 | Cargo workspace | daemon 与 GUI 共享 `Config` 类型，依赖隔离 |
| 录制方式 | 仅 GUI 窗口聚焦时录制（egui input 事件） | 无需全局 hook；不与 daemon 抢键盘；无管理员权限要求 |
| 保存策略 | 显式保存（按钮 + Ctrl+S） | 自动保存 + 热重载会带来诡异体验；用户对生效时机有完全掌控 |

## MVP 功能范围

- C1. 编辑全局设置（`window_keywords`、`auto_input_interval_secs`、`input_delay_millis`）
- C2. 热键列表的增/删/改
- C3. 保存到 `hotkeys.toml`，daemon 自动 reload
- A1. 热键录制（窗口聚焦时按下组合键自动捕获）
- A2. 修饰键 / 触发键下拉框选择
- A4. `input_string` 多行编辑器

明确不做（YAGNI）:
- 拖拽排序、导入/导出、深色模式切换、多语言、配置文件路径选择器、撤销/重做、冲突阻止性校验

## 项目结构（Cargo workspace）

```
hotkeys/
├── Cargo.toml                  # workspace 根 + release profile
├── hotkeys.toml                # 用户配置（运行时生成/编辑）
├── crates/
│   ├── hotkeys-core/           # 共享库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── config.rs       # Config / HotkeyConfig / ConfigError
│   │       └── keys.rs         # ALL_MODIFIERS / ALL_TRIGGERS / 双向映射
│   ├── hotkeys-daemon/         # 后台监听器（原 src/）
│   │   ├── Cargo.toml
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
│   └── hotkeys-gui/            # 新增
│       ├── Cargo.toml
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
        └── 2026-05-22-gui-design.md
```

产物:
- `target/release/hotkeys-daemon.exe`
- `target/release/hotkeys-gui.exe`

## 共享库 hotkeys-core

### config.rs

沿用现有 `Config` / `HotkeyConfig` 字段与 serde 派生，保留 `Default` / `load_or_create` / `save`。
错误类型从 `Box<dyn Error>` 改为自定义枚举:

```rust
#[derive(Debug)]
pub enum ConfigError {
    Io(std::io::Error),
    Parse(toml::de::Error),
    Serialize(toml::ser::Error),
}
```

`Config` 与 `HotkeyConfig` 增加 `#[derive(PartialEq)]` 以支持 dirty 判断。

### keys.rs

- `ALL_MODIFIERS: &[&str]` — 下拉候选 `["Ctrl","Alt","Shift","Meta"]`
- `ALL_TRIGGERS: &[&str]` — 反引号、Num0-9、F1-F12、A-Z
- `string_to_rdev_key(&str) -> Option<rdev::Key>`（搬迁现有实现）
- `key_to_string(rdev::Key) -> Option<&'static str>` — 录制时反查

`hotkeys-core` 因此依赖 `rdev`，但 daemon 本来就依赖，下游零开销。

## 数据流

```
用户操作 ──▶ egui update 循环 ──▶ 修改 self.config
                                         │
                              [Save 按钮 / Ctrl+S]
                                         │
                                         ▼
                              Config::save(&path) ──▶ 文件落盘
                                         │
                                         ▼
                              更新 saved_snapshot，显示 Toast
                                         │
                                         ▼
                       daemon 端 notify watcher 自动 reload
```

### GuiApp 结构

```rust
pub struct GuiApp {
    config: Config,                    // 工作副本
    saved_snapshot: Config,            // 上次保存的快照
    config_path: PathBuf,
    recorder: Option<RecorderState>,
    toast: Option<Toast>,
    pending_close: bool,               // 关闭确认对话框状态
    pending_delete: Option<usize>,     // 删除热键确认
}
```

### 录制状态机

```
Idle ──[点击🎙]──▶ Recording { target_index, started_at }
                        │
                        ├──[非修饰键 KeyDown]──▶ 写入 modifier_key + trigger_key ──▶ Idle
                        ├──[Esc]──▶ Idle
                        └──[超时 30s]──▶ Idle
```

录制使用 egui 的 `ctx.input(|i| ...)`：
- modifiers 从 `i.modifiers` 读取（自动合成 Ctrl/Alt/Shift/Cmd 状态）
- trigger 从 `i.events` 中过滤 `Event::Key { pressed: true, .. }` 取首个非修饰键
- 反查通过 `key_to_string(egui_key_to_rdev(k))` 完成

## UI 布局

主窗口默认 720×560，可缩放，深色主题。

```
┌─ Hotkeys 配置 * ────────────────────────────────────────┐
│                                                         │
│  ▾ 全局设置                                              │
│    窗口关键词    [warcraft iii        ] [+]            │
│                  [...                  ] [✕]            │
│    自动输入间隔  [ 3 ] 秒                                │
│    输入延迟      [50 ] 毫秒                              │
│                                                         │
│  ▾ 热键列表  (5)                            [+ 新增]    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ #1  [Ctrl ▼] + [X 🎙]  描述: [召唤刑天]   ✕    │   │
│  │     输入内容:                                   │   │
│  │     ┌─────────────────────────────────────┐    │   │
│  │     │ -ss                                 │    │   │
│  │     └─────────────────────────────────────┘    │   │
│  │     提示: 换行 = 游戏内回车                     │   │
│  └─────────────────────────────────────────────────┘   │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  hotkeys.toml         [重置]  [保存 (Ctrl+S)]          │
└─────────────────────────────────────────────────────────┘
```

控件细节:
- `window_keywords` 用可增删列表
- 数值用 `egui::DragValue`，最小值 1
- 修饰键用 `ComboBox`（4 项）
- 触发键: 显示当前键名 + 录制按钮（不用下拉，候选 40+ 项太长）
- `input_string`: `TextEdit::multiline().desired_rows(3)`，下方灰字提示
- 删除按钮二次确认（`egui::Window::modal`）
- Toast: `egui::Area` 右下角悬浮，2 秒自动消失
- 关闭拦截 `eframe::App::on_close_event`，dirty 时弹三选项 modal

## 错误处理

| 场景 | 行为 |
|---|---|
| 启动时 toml 损坏 | 用 `Config::default()` 兜底 + 弹错误 modal，提供"覆盖为默认"选项 |
| 保存失败 | 红色 Toast 显示错误，dirty 状态保持 |
| 录制不支持的按键 | 不写入，Toast 提示 |
| toml 不存在 | `load_or_create` 自动创建默认 |
| modifier+trigger 冲突 | 不阻止保存，行下方黄色警告文字 |

## 依赖

### hotkeys-core

```toml
serde = { version = "1", default-features = false, features = ["std", "derive"] }
toml = "0.9"
rdev = { version = "0.5", default-features = false }
```

### hotkeys-daemon

沿用现有依赖，新增 `hotkeys-core = { path = "../hotkeys-core" }`，删除原 `serde` `toml` 直接依赖（通过 core re-export）。

### hotkeys-gui

```toml
hotkeys-core = { path = "../hotkeys-core" }
eframe = { version = "0.32", default-features = false, features = ["default_fonts", "wgpu"] }
egui = "0.32"
```

不开 `persistence` feature，避免引入 `ron` / `directories`。

### 根 release profile

沿用现有极致压缩配置:

```toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "z"
panic = "abort"
strip = "symbols"
debug = "full"
split-debuginfo = "packed"
incremental = true
```

GUI 在该 profile 下预计 6-9 MB。

## 测试

### 单元测试（hotkeys-core）

- `Config` toml 序列化往返一致性
- `key_to_string ∘ string_to_rdev_key` 对所有 `ALL_TRIGGERS` 项往返一致
- `ConfigError` 的 From 转换

### 手动测试清单

- [ ] 首次启动无配置文件 → 自动创建并显示默认热键
- [ ] 修改任意字段 → 标题 `*` 出现，重置按钮启用
- [ ] 点击保存 → daemon 控制台出现 reloading 日志
- [ ] 录制 Ctrl+Q → modifier=Ctrl, trigger=Q
- [ ] 录制时按 Esc → 取消，原值不变
- [ ] 录制超时 30s → 自动取消
- [ ] dirty 关闭 → 三选项确认框
- [ ] 删除 hotkey → 二次确认
- [ ] 保存时 toml 被占用 → 红色 Toast，仍 dirty

## 实施步骤

1. 写入此设计文档（本步）
2. 重组目录为 workspace
3. 抽 `hotkeys-core`
4. 迁移 daemon，验证编译
5. 实现 GUI 全局设置面板（打通保存链路）
6. 实现热键列表 CRUD
7. 实现录制功能
8. 加 dirty / 关闭确认 / Toast / Ctrl+S
9. 更新 README

## 文档更新

`README.md` 增加章节:
- GUI 启动方式: 双击 `hotkeys-gui.exe`，无需管理员权限
- 工作流: 编辑 → 保存 → daemon 自动 reload
- 截图占位 `docs/gui-screenshot.png`
