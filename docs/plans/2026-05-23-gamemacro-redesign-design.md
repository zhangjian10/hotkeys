# GameMacro 重设计方案

> 状态：已与用户确认，待进入实现  
> 日期：2026-05-23  
> 取代：`docs/plans/2026-05-22-gui-design.md`（旧设计基于 native-windows-gui，已过时）

---

## 0. 背景

当前项目 `Warcraft Hotkeys Helper` 存在两个问题：

1. **定位太窄**：名字绑死「魔兽争霸」，但能力本质上适用于所有需要「按热键自动输入指令」的游戏
2. **UI 太复杂**：首屏堆叠了「全局设置 + Profile 列表 + 热键列表 + 录制 + 多控件展开」四层信息，新手劝退

本方案重新定位项目为 **GameMacro — 给游戏加一组宏热键，按一次循环执行**，并按 Fluent UI v9 设计语言重构 GUI。

---

## 1. 品牌与定位

### 名称
- **项目名**：`GameMacro`
- **一句话**：给游戏加一组宏热键，按一次循环执行
- **副标题**：自定义快捷键 · 一键连发 · 专为游戏打造

### 定位边界（YAGNI）
| 做 | 不做 |
|---|---|
| 组合键触发 | 鼠标宏 |
| 文本宏 / 一键循环 | 按键序列录制 |
| 多游戏 profile | 脚本语言 / OCR |
| 窗口标题检测 | 云同步 / 账号系统 |

---

## 2. 命名映射表（阶段 1 一次性改完）

### 2.1 Crate / 二进制 / 应用

| 类别 | 旧 | 新 |
|---|---|---|
| Workspace 根目录 | `d:/code/my/hotkeys` | 不动（git 仓库目录保持） |
| Crate `hotkeys-core` | 包名 `hotkeys-core` | `gamemacro-core` |
| Crate `hotkeys-daemon` | 包名 `hotkeys-daemon`，bin `hotkeys-daemon` | 包名 `gamemacro-daemon`，bin `gamemacro-daemon` |
| Crate `hotkeys-gui` | 包名 `hotkeys-gui`，bin `hotkeys-gui` | 包名 `gamemacro-gui`，bin `gamemacro` |
| Tauri lib name | `hotkeys_gui_lib` | `gamemacro_lib` |
| Cargo `use` 路径 | `hotkeys_core::...` | `gamemacro_core::...` |
| 配置文件 | `hotkeys.toml` | `gamemacro.toml`（daemon 启动时一次性自动迁移） |
| 默认配置 | `hotkeys-core/default_hotkeys.toml` | `gamemacro-core/default_config.toml` |
| Tauri `productName` | `Hotkeys GUI` | `GameMacro` |
| Tauri `identifier` | `com.hotkeys.gui` | `com.gamemacro.app` |
| 窗口标题 | `Hotkeys 配置` | `GameMacro` |
| npm package `name` | `hotkeys-gui` | `gamemacro-gui` |

### 2.2 目录结构

```
crates/
├── gamemacro-core/              （旧 hotkeys-core）
│   ├── default_config.toml      （旧 default_hotkeys.toml）
│   └── src/
│       ├── lib.rs
│       ├── config.rs
│       └── keys.rs
├── gamemacro-daemon/            （旧 hotkeys-daemon）
│   ├── app.manifest
│   ├── build.rs
│   └── src/...
└── gamemacro-gui/               （旧 hotkeys-gui）
    ├── package.json
    ├── src/                     （前端，详见 §6）
    └── src-tauri/
        ├── Cargo.toml
        ├── tauri.conf.json
        └── src/
            ├── main.rs
            └── lib.rs
```

### 2.3 涉及改名的文件清单（grep 命中 22 个）

`Cargo.toml` · `README.md` · `crates/hotkeys-core/Cargo.toml` · `crates/hotkeys-core/src/lib.rs` · `crates/hotkeys-core/src/config.rs` · `crates/hotkeys-daemon/Cargo.toml` · `crates/hotkeys-daemon/src/main.rs` · `crates/hotkeys-daemon/src/state.rs` · `crates/hotkeys-daemon/src/hotkey.rs` · `crates/hotkeys-gui/package.json` · `crates/hotkeys-gui/src-tauri/Cargo.toml` · `crates/hotkeys-gui/src-tauri/tauri.conf.json` · `crates/hotkeys-gui/src-tauri/src/main.rs` · `crates/hotkeys-gui/src-tauri/src/lib.rs` · `crates/hotkeys-gui/src/App.tsx` · `crates/hotkeys-gui/src/lib/api.ts` · `crates/hotkeys-gui/src/lib/utils.ts` · `crates/hotkeys-gui/src/hooks/useConfigState.ts` · `crates/hotkeys-gui/src/hooks/useDerived.ts` · `crates/hotkeys-gui/src/components/pages/HotkeysPage.tsx` · `crates/hotkeys-gui/src/components/HotkeyRow.tsx` · `crates/hotkeys-gui/src/components/EditorDrawer.tsx`

> 旧设计文档 `docs/plans/2026-05-22-gui-design.md` 标记 deprecated，不删除（保留历史）。

### 2.4 类型 / 模块命名

类型名继续保留 `HotkeyConfig` / `Profile` / `Config`（语义清晰，不强行套品牌名）。但前端 hook / 组件按 §6 重新组织时会一并更新。

---

## 3. 设计语言：Fluent UI v9

- 颜色 / 字体 / 间距 / 圆角 / 阴影 / 动效全部走 Fluent 9 的 design tokens（`tokens.colorXXX` / `tokens.spacingXXX` / `tokens.borderRadiusXXX`），**不写死颜色**
- 跟随系统深浅色（`webLightTheme` / `webDarkTheme`）
- 组件优先用 Fluent 9 现成的：`Button` / `Dropdown` / `Dialog` / `Switch` / `Input` / `Textarea` / `MessageBar` / `Toast` / `Card` / `CardHeader` / `Badge` / `MenuButton` / `Field` / `Popover`
- 图标统一用 `@fluentui/react-icons` regular 风格，hover 态 filled
- 字体走系统默认（`Segoe UI Variable` / `Segoe UI`），不引入额外字体

---

## 4. 信息架构（三层 → 两层）

| | 旧 | 新 |
|---|---|---|
| 首屏可见信息块 | 4 类（全局设置 / Profile 列表 / 热键列表 / 编辑面板） | 1 类（热键卡片列表） |
| 显式保存 | 有「保存按钮 + 未保存 `*` 标记 + 关闭确认」 | 无，500ms 防抖自动保存 |
| 热键编辑入口 | 左右分栏（左列表右编辑） | 单列卡片，点击展开内联编辑 |
| 录制热键控件数 | 3（修饰键下拉 + 触发键下拉 + 录制按钮） | 1（组合键徽章，点击即录制） |

---

## 5. 首屏布局

### 5.1 顶栏（48px）

```
┌────────────────────────────────────────────────────────────┐
│ GameMacro      [魔兽争霸 ▾] [+ 新游戏]      🟢运行中  ⚙   │
└────────────────────────────────────────────────────────────┘
```

| 元素 | 职责 |
|---|---|
| Logo + `GameMacro` | 品牌 |
| `[魔兽争霸 ▾]` | 当前 profile + 切换菜单（详见 §7.B） |
| `[+ 新游戏]` | 一键创建新 profile |
| 🟢 状态灯 | 实时显示 daemon 状态（详见 §7.C） |
| ⚙ | 打开设置弹窗（详见 §7.A） |

### 5.2 主体（可滚动卡片列表）

每张卡片对应一条热键，固定 72px 折叠态高度，展开态约 280px。底部始终有「+ 新增热键」按钮。

---

## 6. 热键卡片（核心简化点）

### 6.1 折叠态（默认）

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐                                            │
│ │ Ctrl + X │  召唤刑天                            ⋮    │
│ └──────────┘  -ss                                       │
└─────────────────────────────────────────────────────────┘
```

- **左**：`KeyBadge`（Fluent `Badge` 加大版，`appearance="tint"` + `size="large"`）
- **中上**：描述（`Text size={400} weight="semibold"`）
- **中下**：输入预览（`Text size={200}`，单行 ellipsis）
- **右**：`MenuButton` 提供 编辑 / 复制 / 删除 / 上移 / 下移
- 整卡可点 → 切换为展开态；点 `KeyBadge` 直接进入录制

### 6.2 展开态（内联编辑）

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐                                            │
│ │ Ctrl + X │  🎙 点击徽章重新录制 · Esc 取消             │
│ └──────────┘                                            │
│                                                         │
│ 描述   [ 召唤刑天                                    ]  │
│ 输入   ┌──────────────────────────────────────────────┐ │
│        │ -ss                                          │ │
│        └──────────────────────────────────────────────┘ │
│        换行 = 游戏内回车                                │
│                                                         │
│        [🔁 按一次循环执行]  ⚙ 高级 ▾   [完成]           │
└─────────────────────────────────────────────────────────┘
```

- 每条热键有独立 `repeat: bool` 开关（核心卖点必须显眼）
- 「⚙ 高级 ▾」默认折叠：循环间隔覆盖（不填用 profile 默认）
- 「完成」= 收起卡片，不是保存（已自动保存）

### 6.3 KeyBadge 三态

| 态 | 视觉 | 行为 |
|---|---|---|
| 静态 | `Ctrl + X` 蓝灰 tint | 显示当前组合键 |
| 录制中 | 红色脉冲边框 +「按下组合键…」 | 监听键盘 → 捕获合法组合键 → 立即写入 + 退出 |
| 冲突 | 红底 `appearance="filled"` + Tooltip | 阻止保存，引导改键 |

### 6.4 新增热键

点底部「+ 新增热键」→ 在列表末尾插入一张**已展开的空卡片**，徽章自动进入录制态。

---

## 7. 二级页面

### 7.A 设置弹窗（Fluent `Dialog`）

```
┌─ 设置 ──────────────────────────────────── × ┐
│  当前 Profile：魔兽争霸                       │
│  ─────────────────────────────────────────   │
│  循环间隔        [  3 ] 秒                    │
│  按键之间延迟     [ 50 ] 毫秒                 │
│  匹配窗口标题     [ warcraft iii      ] [+]   │
│                  [ %dota%             ] [×]  │
│                                              │
│  全局                                         │
│  ─────────────────────────────────────────   │
│  [开关] Daemon 运行中                         │
│  [开关] 开机自启                              │
│  [开关] 跟随系统深色                          │
│                                              │
│  关于                                         │
│  ─────────────────────────────────────────   │
│  GameMacro v0.x.x  · [打开配置位置]           │
│                                              │
│                                  [关闭]      │
└──────────────────────────────────────────────┘
```

- 上半段是当前 profile 配置，切 profile 时跟着切
- 字段变更同样 500ms 防抖自动保存，无应用/取消按钮
- 窗口关键词支持 `%xxx%` 模糊匹配（沿用现有语义）

### 7.B Profile 菜单（顶栏下拉）

```
✓ 魔兽争霸
  DOTA
  原神
─────────
✏  重命名当前
📋  复制为新 profile
🗑  删除当前（最后一个 profile 不可删）
─────────
+  新游戏…
```

「新游戏…」迷你 Dialog 只问名称 + 一个窗口关键词，其它字段进 ⚙ 调。

### 7.C 状态灯

| 状态 | 视觉 | Tooltip |
|---|---|---|
| 已激活 | 🟢 | 「魔兽争霸 窗口已聚焦，热键生效中」 |
| 待命 | 🟡 | 「Daemon 运行中，等待目标窗口聚焦」 |
| 已停止 | ⚪ | 「Daemon 未运行，点击 ⚙ 启动」 |
| 错误 | 🔴 | 「无管理员权限 / 配置错误」 |

点击 → `Popover` 显示最近 3 条 daemon 日志。

---

## 8. 数据模型变更

`gamemacro-core::config::HotkeyConfig` 新增两个字段，保持向后兼容：

```rust
pub struct HotkeyConfig {
    pub modifier_key: String,
    pub trigger_key: String,
    pub input_string: String,
    pub description: Option<String>,

    /// 本条热键是否循环（再按一次停止）；缺省 true，与旧行为一致
    #[serde(default = "default_true")]
    pub repeat: bool,

    /// 可选地覆盖 profile 默认循环间隔
    #[serde(default)]
    pub interval_secs_override: Option<u64>,
}
```

旧 toml 不写这两字段时 → 全部默认循环、用 profile 间隔，行为不变。

---

## 9. 前端目录结构（GUI 重构）

```
crates/gamemacro-gui/src/
├── App.tsx                       // 顶栏 + 卡片列表 + 设置 Dialog
├── main.tsx
├── env.d.ts
├── types.ts
├── components/
│   ├── TopBar.tsx
│   ├── HotkeyCard.tsx            // 折叠/展开切换
│   ├── KeyBadge.tsx              // 三态：静态/录制中/冲突
│   ├── HotkeyList.tsx            // 卡片列表 + 「+ 新增」
│   ├── SettingsDialog.tsx        // 当前 profile + 全局 + 关于
│   ├── ProfileMenu.tsx
│   └── StatusLamp.tsx            // 灯 + 日志 popover
├── hooks/
│   ├── useConfig.ts              // 读 / 防抖写 / 监听文件变更
│   ├── useKeyRecorder.ts         // 监听 keydown，输出合法组合键
│   └── useDaemonStatus.ts
├── lib/
│   ├── tauri.ts                  // invoke 包装
│   └── conflict.ts               // 组合键冲突检测
└── styles/
    └── tokens.ts                 // 复用 Fluent tokens 的 small helpers
```

**砍掉的旧文件**：`components/HotkeyRow.tsx` / `components/EditorDrawer.tsx` / `components/pages/HotkeysPage.tsx` / `hooks/useConfigState.ts`（未保存逻辑） / `hooks/useDerived.ts`。

---

## 10. Tauri 命令面（src-tauri）

| 命令 | 状态 | 用途 |
|---|---|---|
| `read_config` / `write_config` | 保留 | 读写 `gamemacro.toml` |
| `daemon_status` | 新增 | 返回 `{ running, active_profile, last_logs[] }` |
| `daemon_start` / `daemon_stop` | 新增 | 启停 daemon（spawn + 命名管道发停止信号） |
| `open_config_dir` | 新增 | 文件管理器打开配置目录 |
| `set_autostart` | 新增 | 写注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| `try_input` | 保留 | 「试一下」预览输入（已用 `enigo`） |

---

## 11. 实施阶段（4 个 PR）

### 阶段 1：改名（机械性，低风险）✓ 已完成
按 §2 命名映射表一次性改完所有 22 个文件 + 目录重命名。一次性迁移代码已在阶段 2 之前移除（项目从 GameMacro 品牌起步发布，无遗留 `hotkeys.toml`）。  
**验收**：`cargo build --release` 通过；行为零变化。

### 阶段 2：Per-hotkey 循环架构 ✓ 已完成
`HotkeyConfig` 增加 `repeat`（默认 true）/ `interval_secs_override`（`Option<u64>`）字段，向后兼容旧 toml。daemon 引入 `LoopRuntime`：tokio multi-thread runtime + per-hotkey task + 一个 std thread 上的 Enigo input worker，所有 task 通过 std::mpsc 把待输入文本投递给 worker 串行化执行。每条热键独立循环、独立间隔；窗口失活 / 配置 reload 时通过 `CancellationToken` 整体清理。`auto_input.rs` 已删除。  
**验收**：`cargo test -p gamemacro-core` 13/13 通过；`cargo build --release` 通过；手动烟雾测试见 `docs/plans/2026-05-23-gamemacro-loop-runtime.md` Task 8。

### 阶段 3：GUI 重构（核心工作量）
按 §5～§10 重写前端，砍掉旧分栏与显式保存。  
**验收**：
- 首屏只有顶栏 + 卡片列表 + 「+ 新增」
- 新增 → 自动展开 → 徽章自动进入录制 → 按键自动捕获 → 500ms 后落盘
- 改任意字段无需点保存，daemon 自动 reload
- 切 profile 不刷新整页

### 阶段 4：Daemon 静默化（可选）
- daemon 改 `windows` subsystem，无控制台
- 日志写 `%LOCALAPPDATA%\GameMacro\daemon.log`
- 命名管道暴露 `status` / `stop`

**验收**：双击 `gamemacro.exe` 即可一站式管理，普通用户全程不见黑框框。

---

## 12. 风险与对策

| 风险 | 对策 |
|---|---|
| GUI 不需要管理员，但要启停 daemon | GUI 通过 `ShellExecute` + `runas` 拉起 daemon，UAC 弹窗一次 |
| Fluent v9 + Tauri v2 + React 19 三新栈兼容性 | 阶段 3 开工前先跑空白页验证 toolchain |
| 自动保存触发频繁 reload | GUI 端 500ms 防抖 + daemon 端 200ms 防抖 双保险 |
| 用户已有 `hotkeys.toml` 不想丢 | daemon 启动时若仅有旧文件，rename 而非 copy，保证不留垃圾；写一行迁移日志 |

---

## 13. 不做（明确 YAGNI）

- 鼠标宏 / 按键序列 / 脚本语言 / OCR
- 云同步 / 账号系统
- profile 导入导出（V1 不做）
- 国际化（先中文）
