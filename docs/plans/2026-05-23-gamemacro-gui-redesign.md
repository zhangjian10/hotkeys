# GameMacro 阶段 3：GUI 重构（Fluent UI 卡片化 + autosave）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把现有的"侧栏 + 多页 + 抽屉编辑 + 手动保存"GUI 重构为"顶栏 + 单列卡片 + 内联编辑 + autosave + 设置弹窗"形态，符合设计稿 §4–§7 与 Fluent UI v9 设计语言。

**Architecture:** 三步走的渐进重构（每步独立 PR）：
- **Sub-PR A**：拆掉 dirty/undo 模型，引入 500ms 防抖 autosave；删除 DirtyBar / useGlobalShortcuts / `past/future` 栈。视觉先不动（不动 Layout/Sidebar/Pages），只改保存范式，最小改动验证 autosave 链路。
- **Sub-PR B**：删掉 Sidebar，用 TopBar（profile 下拉 + 状态灯 + ⚙）替代；TimingPage / WindowPage 内容整合进 SettingsDialog（用 TabList 分三段：当前 profile / 全局 / 关于）。HotkeysPage 还在但作为唯一首屏内容，去掉 PageHeader / 因果卡。
- **Sub-PR C**：把 HotkeyRow + EditorDrawer 重构为 **HotkeyCard**（折叠态 + 内联展开编辑），其中组合键控件用一个 **ComboBadge** 三态组件统一替代修饰键下拉/触发键下拉/录制按钮。

**Tech Stack:** React 19 · Tauri v2 · Fluent UI v9 (`@fluentui/react-components`) · `@fluentui/react-icons` · Vite 8 · TypeScript 6

**前置约束：**
- 阶段 2 已完成（HotkeyConfig 含 repeat / interval_secs_override；daemon 已是 LoopRuntime 架构）
- Tauri 命令面**不变**：`load_config / save_config / reveal_config / list_windows / current_foreground_title / try_input` 都沿用
- 数据类型 `HotkeyConfig / Profile / AppConfig` 在 `lib/api.ts` 已对齐 core 新字段；本阶段需把 GUI 露出 `repeat` / `interval_secs_override`
- 不引入新依赖（Fluent v9 + react-icons 已够用）
- 不动 daemon 任何代码

---

## Sub-PR A：autosave + 拆 dirty 模型

### A1：先看类型层是否已对齐 core 新字段

**Files:** 仅 read

**Step 1: 检查 `lib/api.ts` 中 `HotkeyConfig` 类型**

Run: `read_file` on `crates/gamemacro-gui/src/lib/api.ts`
Expected fields on HotkeyConfig: `modifier_key, trigger_key, input_string, description, repeat, interval_secs_override`

**Step 2: 若缺字段则补**

如缺，把 `lib/api.ts` 中的 `HotkeyConfig` 接口加上：
```ts
export interface HotkeyConfig {
  modifier_key: string;
  trigger_key: string;
  input_string: string;
  description?: string | null;
  repeat?: boolean;                    // 默认 true（serde default）；undefined 视同 true
  interval_secs_override?: number | null;
}
```
**注意 `repeat` 设为可选**：daemon 端 serde 默认 true，TS 这边 undefined 也按 true 显示，避免老 toml 在 GUI 显示成"单次"；保存时 GUI 永远写一个明确值。

`emptyHotkey()` helper（如有）应初始化 `repeat: true, interval_secs_override: null`。

**验收**：构建过、类型一致。

---

### A2：useConfigState 瘦身（去 past/future/savedRef）

**Files:**
- Modify: `crates/gamemacro-gui/src/hooks/useConfigState.ts`

**Step 1: 写新版 useConfigState**

新接口（API 缩减）：
```ts
type ConfigState = { config: AppConfig; lastSavedAt: number | null };
type Action =
  | { type: 'load'; config: AppConfig }
  | { type: 'patch'; producer: (draft: AppConfig) => AppConfig }
  | { type: 'markSaved'; at: number };

function useConfigState() {
  // useReducer 内部 dispatch 'load' / 'patch' / 'markSaved'
  // 暴露：
  //   state.config
  //   state.lastSavedAt              // 用于 TopBar 状态灯展示"已保存"
  //   load(config)
  //   patch(producer)                // 直接用回调改写 config
  //   patchProfile(idx, producer)    // 便利 wrapper
  //   patchHotkey(profileIdx, hkIdx, producer)
  //   markSaved(at)
  // 删除：dirty / saved / past / future / canUndo / canRedo / undo / redo / resetAll / resetCurrent / markSaved 之外的旧 markSaved 调用
}
```

**Step 2: 跨文件清理引用**

Run grep：`Get-ChildItem crates/gamemacro-gui/src -Recurse -Include *.tsx,*.ts | Select-String -Pattern 'dirty|canUndo|canRedo|resetAll|resetCurrent|undo\(|redo\(|past|future' -SimpleMatch:$false`

每处命中按"已删 → 移除调用 / 切换到等价 patch"修复。一定会命中：`App.tsx`（dirty/save 编排）、`DirtyBar.tsx`（整体待删）、`useGlobalShortcuts.ts`（待删）。

**Step 3: 构建**

Run: `cd crates/gamemacro-gui; pnpm build`  
Expected: vite 编译过；TypeScript 报错（DirtyBar / useGlobalShortcuts / App.tsx 多处用到的 API 不存在）—— 留到 A3 / A4 一起修。

> **决定**：A2 单独一步会让中间态编译失败。**实际操作上将 A2/A3/A4 合并为单 commit**——即"一气改完"，避免半坏中间态。Sub-PR A 共 1 个 commit。

---

### A3：autosave effect

**Files:**
- Modify: `crates/gamemacro-gui/src/App.tsx`

**Step 1: 删除手动保存路径**

- 删除 `<DirtyBar/>` 渲染
- 删除 `useGlobalShortcuts` 调用
- 删除 `doSave` 之外，引入新的"防抖 autosave" effect

**Step 2: 加 autosave effect**

```tsx
// App.tsx 顶层（在 useConfigState() 之后）
const SAVE_DEBOUNCE_MS = 500;
const saveTimerRef = React.useRef<number | null>(null);
const lastQueuedConfigRef = React.useRef<AppConfig | null>(null);

React.useEffect(() => {
  // 跳过初次 load 触发的 effect：lastSavedAt === null && config 与 saved 是同一引用
  // 用 lastQueuedConfigRef 简单地防抖：每次 config 变都重置 timer
  if (saveTimerRef.current !== null) {
    window.clearTimeout(saveTimerRef.current);
  }
  lastQueuedConfigRef.current = config;
  saveTimerRef.current = window.setTimeout(async () => {
    try {
      await saveConfig(config);
      markSaved(Date.now());
      // 可选：toast 一个低显示度的"已保存"
    } catch (e) {
      flashError(`自动保存失败：${formatErr(e)}`);
    }
  }, SAVE_DEBOUNCE_MS);

  return () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  };
}, [config]);
```

**关键边界**：
- **首次 load 不触发 save**：在 `useConfigState` 里把"load 后的初始 lastSavedAt"设为 `Date.now()`，并在 useEffect 里加 `if (lastSavedAt === null) return` 早返。
- **只 in-flight 一个保存**：同一时刻 `saveConfig` 还没完成时 config 又变了 —— 当前实现是上次的 `saveConfig` 仍在 await，下一次 timer 又触发一个新的 save。这没大问题（最终一致），但可以在 timer 触发处先清掉旧 timer 即可，**不需要 in-flight 锁**——daemon 端有 reload 防抖（500ms）兜底。

**Step 3: 删 DirtyBar.tsx**

Run: `git rm crates/gamemacro-gui/src/components/DirtyBar.tsx`

**Step 4: 删 useGlobalShortcuts.ts**

Run: `git rm crates/gamemacro-gui/src/hooks/useGlobalShortcuts.ts`

**Step 5: constants 里删 HISTORY_LIMIT**（已无用）

`crates/gamemacro-gui/src/constants/app.tsx` —— 删除 `HISTORY_LIMIT` 常量。

---

### A4：构建 + 烟雾测试 + commit

**Step 1: TypeScript / vite 构建**

Run: `cd crates/gamemacro-gui; pnpm build`  
Expected: exit 0，dist 产出完整

**Step 2: 真实 Tauri release 构建**

Run: `cd crates/gamemacro-gui; pnpm tauri:build --no-bundle`  
Expected: 产出 `target/release/gamemacro.exe` 可正常启动；编辑任意字段 → 标题栏不再有 `*` 标记 → 500ms 后看 daemon 控制台输出 `Configuration changed, reloading...`，证明 autosave 链路通

**Step 3: Commit**

```
git add -A
git commit -m "refactor(gui): autosave on edit, drop DirtyBar / undo / global shortcuts

useConfigState shrinks from {config, saved, past, future} to
{config, lastSavedAt}. App.tsx now writes through saveConfig with a
500ms debounce on every config change; the manual save button, the
unsaved-* indicator, the undo/redo stacks, and the Ctrl+S/Z/Y global
listener are all gone. daemon already debounces reloads at 500ms, so
the GUI side debounce alone is enough to avoid reload storms.

Removed:
- src/components/DirtyBar.tsx
- src/hooks/useGlobalShortcuts.ts
- HISTORY_LIMIT constant
- past/future/canUndo/canRedo/resetAll/resetCurrent on useConfigState

Plan: docs/plans/2026-05-23-gamemacro-gui-redesign.md (Sub-PR A)"
```

---

## Sub-PR B：拆 Sidebar，引入 TopBar + SettingsDialog

### B1：新建 TopBar 组件

**Files:**
- Create: `crates/gamemacro-gui/src/components/TopBar.tsx`
- Modify: `crates/gamemacro-gui/src/App.tsx`（在 TitleBar 下方挂 TopBar）

**TopBar 内容**（按设计稿 §5.1）：

```
[brand "GameMacro"]   [profile dropdown ▾]   [+ 新游戏]      ⚙
```

实现要点：
- profile dropdown 用 Fluent `Menu` + `MenuTrigger` + `MenuList`
  - 顶部：所有 profile 列出（当前打勾）
  - 中间分割线
  - 底部：重命名当前 / 复制为新 profile / 删除当前（仅当 profile 数 > 1）
  - 末尾：「+ 新游戏…」分组项（也可独立按钮）
- 「+ 新游戏」按钮：弹一个 mini Dialog 输入名字 + 第一条窗口关键词
- ⚙ 按钮：打开 SettingsDialog（B3 实现）
- **状态灯先用占位（后续 Sub-PR C 或 D 再做实时 daemon status）**

**Step 1: 写 TopBar.tsx**

挂 `MenuButton` / `MenuPopover` 等组件，绑定：
- `profiles: Profile[]`
- `activeIndex: number`
- `onActiveChange(i)`
- `onCreateProfile(name, keyword)`
- `onRenameProfile(i, newName)`
- `onDuplicateProfile(i)`
- `onDeleteProfile(i)`
- `onOpenSettings()`

**Step 2: App.tsx 改首屏结构**

```
<TitleBar/>
<TopBar profiles={...} ... />
<HotkeysPage activeProfile={...} ... />   // 全宽
<SettingsDialog open={settingsOpen} ... />
{/* 原 EditorDrawer / WindowPickerDialog / ConfirmDialog / CountdownDialog 不动 */}
```

**Step 3: 删除 Sidebar**

```
git rm -r crates/gamemacro-gui/src/components/Sidebar
git rm crates/gamemacro-gui/src/components/ProfileHeader.tsx
```

ProfileHeader 在新设计里被 TopBar 的 profile dropdown 取代。

---

### B2：SettingsDialog（合并 TimingPage + WindowPage 内容）

**Files:**
- Create: `crates/gamemacro-gui/src/components/SettingsDialog.tsx`

**结构**（按设计稿 §7.A）：

```tsx
<Dialog open={open} onOpenChange={...}>
  <DialogSurface>
    <DialogTitle>设置</DialogTitle>
    <DialogContent>
      <TabList>
        <Tab value="profile">当前 Profile</Tab>
        <Tab value="global">全局</Tab>
        <Tab value="about">关于</Tab>
      </TabList>
      {/* tab=profile: 当前 profile 的循环间隔 / 按键延迟 / 窗口关键词列表 */}
      {/* tab=global: daemon 运行中开关（先 stub）/ 开机自启（先 stub）/ 跟随系统深色（先 stub） */}
      {/* tab=about: 版本号 / [打开配置位置] 按钮 → invoke('reveal_config') */}
    </DialogContent>
  </DialogSurface>
</Dialog>
```

**复用现有代码**：
- `pages/TimingPage.tsx` 的 SpinButton 行 → "当前 Profile" tab
- `pages/WindowPage.tsx` 的关键词 chips + 前台标题预览 + WindowPickerDialog 触发 → "当前 Profile" tab
- `SettingRow.tsx` 在所有 tab 中复用

**重要简化**：把 TimingPage / WindowPage 文件**直接复制内容到 SettingsDialog 的 tab 渲染**，而不是把它们作为 child component 引用——之后可以彻底删掉两个 page 文件，让代码搜索清爽。

**Step 1: 写 SettingsDialog.tsx**

把两个 page 的有效逻辑合并进来；保留对 `useForegroundTitle` 的调用（仅 tab=profile 且 dialog open 时启用）；保留 WindowPickerDialog 触发逻辑。

**Step 2: 删两个 page**

```
git rm crates/gamemacro-gui/src/components/pages/TimingPage.tsx
git rm crates/gamemacro-gui/src/components/pages/WindowPage.tsx
```

**Step 3: HotkeysPage 瘦身**

`pages/HotkeysPage.tsx` 移除 PageHeader、因果预览卡（如果有）、可保留搜索框 + 添加按钮 + 列表骨架。也可以**直接把 HotkeysPage 内容上提到 App.tsx**，删掉 `pages/` 目录—— **本阶段仍保留为单独文件**（后续 Sub-PR C 重构 row→card 时一起处理）。

**Step 4: types.ts / constants 清理**

- `types.ts` 删除 `SectionId`（不再有多 page）
- `constants/app.tsx` 删除 `NAV_ITEMS`

**Step 5: styles 清理**

`styles/useStyles.ts`：删除与 Sidebar / DirtyBar / PageHeader / ProfileHeader / navTab 相关的 makeStyles class（grep 用到这些 class 名的地方都已清空）。

---

### B3：构建 + 烟雾测试 + commit

**Step 1: 构建**

Run: `cd crates/gamemacro-gui; pnpm tauri:build --no-bundle`  
Expected: GUI 启动后，**没有左侧栏**，顶部是 TitleBar + TopBar；点齿轮弹出 SettingsDialog 三 tab 都能切；profile 切换、新建、重命名、删除 全部可用；窗口关键词在设置里也能编辑

**Step 2: Commit**

```
git add -A
git commit -m "refactor(gui): replace sidebar+tabs with TopBar + SettingsDialog

The sidebar (profile list + 3-section tab list + config-path button)
and the per-section pages (TimingPage / WindowPage) are gone. Their
duties now live in:
- TopBar: brand, profile dropdown (switch / rename / duplicate / delete /
  + new game), settings gear; sits below the custom Win11 title bar
- SettingsDialog: 3-tab Fluent Dialog (current profile / global / about).
  - current profile tab subsumes TimingPage SpinButtons + WindowPage
    keyword editor and live foreground-title preview
  - global tab is stubbed (daemon switch / autostart / theme to come)
  - about tab exposes version + reveal-config-folder

ProfileHeader, NAV_ITEMS, SectionId, and Sidebar-related makeStyles
classes are deleted. HotkeysPage stays for now as the single full-
width content area; it gets reshaped into HotkeyCard list in Sub-PR C.

Plan: docs/plans/2026-05-23-gamemacro-gui-redesign.md (Sub-PR B)"
```

---

## Sub-PR C：HotkeyCard + ComboBadge（核心简化）

### C1：ComboBadge 组件（三态：静态 / 录制中 / 冲突）

**Files:**
- Create: `crates/gamemacro-gui/src/components/ComboBadge.tsx`
- 不动: `KeyChip.tsx`（仍可作为 ComboBadge 的内部样式碎片复用）

**Step 1: 写 ComboBadge.tsx**

```tsx
type ComboBadgeProps = {
  modifierKey: string;
  triggerKey: string;
  state: 'static' | 'recording' | 'conflict';
  conflictHint?: string;          // 冲突时显示的 tooltip 文案
  onClick: () => void;            // static -> recording / recording -> 取消
  size?: 'small' | 'medium' | 'large';
};
```

实现要点：
- 整体用 Fluent `Badge`（appearance="tint" → 静态 / "filled" → 冲突）
- 内部用现有 `KeyChip` 组件渲染 `[Ctrl] + [X]`
- `recording` 态：红色脉冲 border（CSS keyframes），文案改为「按下组合键…」
- 点击徽章：`onClick()`；调用方负责把 useRecorder 的 state 切到 `recording`，并在录制完成时把组合键写回数据 + 切回 `static`

**Step 2: 单元烟雾**

把 ComboBadge 在一张测试页（或 storybook 风格的独立挂载）渲染三种态，确认 hover/click/动画都正常—— **本阶段没有 storybook，跳过这步，直接进 C2 在真实卡片里验证**。

---

### C2：HotkeyCard 组件（折叠态 + 内联展开）

**Files:**
- Create: `crates/gamemacro-gui/src/components/HotkeyCard.tsx`
- Modify: `crates/gamemacro-gui/src/components/pages/HotkeysPage.tsx`（用 HotkeyCard 替代 HotkeyRow）

**Step 1: 写 HotkeyCard.tsx**

折叠态（默认）：
```
[ComboBadge]   描述                                         ⋮
                输入预览（单行 ellipsis）
```

展开态：
```
[ComboBadge: state=recording when 录制中]
  说明文案：点击徽章重新录制 · Esc 取消（仅录制态）

描述    [Input]
输入    [Textarea, multiline]
        换行 = 游戏内回车

[Switch] 按一次循环执行    ⚙ 高级 ▾    [完成]

(高级展开后)
循环间隔覆盖   [SpinButton 留空 = 用 profile 默认]
```

控件复用：
- 顶部 `⋮` MenuButton：编辑（=展开）/ 复制 / 删除 / 上移 / 下移 / 试一下
- `Switch` 接 `repeat`
- `SpinButton` 接 `interval_secs_override`（empty = null）
- 「完成」按钮 = 收起卡片

**关键设计**：
- 卡片**整体可点击**进入展开态；点 ComboBadge 直接进入录制（不展开）
- 同一时刻只允许一张卡片展开（其他点开就会自动收起）—— 在 HotkeysPage 维护 `expandedKey: string | null`
- 卡片内编辑直接调用 `patchHotkey(profileIdx, hkIdx, producer)`，autosave 自动落盘

**Step 2: HotkeysPage 改造**

从 `<HotkeyRow/>` 列表改为 `<HotkeyCard/>` 列表；新增 `expandedKey` 状态；保留搜索框；保留底部「+ 新增热键」按钮（点击 = `patchProfile` 末尾追加一条空热键 + 自动展开 + ComboBadge 自动进入录制）。

**Step 3: 删除被替代的组件**

```
git rm crates/gamemacro-gui/src/components/HotkeyRow.tsx
git rm crates/gamemacro-gui/src/components/EditorDrawer.tsx
```

**Step 4: 清掉 App.tsx 里 EditorDrawer 的挂载与 editingHotkey 状态**

`useDerived.ts` 里的 `useEditingHotkey`（如果只被 EditorDrawer 用）也可移除——通过 grep 确认。

---

### C3：构建 + 烟雾测试 + commit

**Step 1: 构建**

Run: `cd crates/gamemacro-gui; pnpm tauri:build --no-bundle`  
Expected: 启动后只剩「TitleBar + TopBar + 卡片列表 + + 新增热键」；展开/折叠/录制/Switch/SpinButton 全部正常；自动保存生效；切 profile 切换列表

**Step 2: 手动验收清单**

- [ ] 单列卡片，折叠态 72px 高
- [ ] 展开态可编辑所有字段（描述、输入、repeat 开关、interval 覆盖）
- [ ] ComboBadge 三态视觉正确；点击进入录制；按 Esc 取消
- [ ] 重复组合键 → ComboBadge 显示冲突态 + tooltip 指出冲突的另一条
- [ ] 「+ 新增」→ 末尾插入展开的空卡片，徽章自动进入录制
- [ ] `⋮` 菜单的复制 / 删除 / 上移下移 / 试一下 都可用
- [ ] daemon 控制台能看到 `Configuration changed, reloading...` 在 500ms 防抖后触发
- [ ] daemon 加载新 toml 后，按热键的行为符合 repeat / interval_secs_override

**Step 3: Commit**

```
git add -A
git commit -m "refactor(gui): hotkey row+drawer become inline-editing HotkeyCard

The hotkey list is now a single column of Fluent Cards. Each card has
a folded mode (combo badge + description + input preview + ⋮ menu)
and an inline expanded mode (description Input, multiline Textarea,
``repeat`` Switch, ``interval_secs_override`` SpinButton in an
advanced disclosure). Tapping the card expands it; tapping the combo
badge enters key-recording without expanding.

ComboBadge collapses three previously-separate controls (modifier
dropdown + trigger dropdown + record button) into one tri-state
control: static / recording / conflict. The right-side EditorDrawer
is gone — every edit lives next to the row it modifies.

Combined with autosave from Sub-PR A, the user can add a hotkey,
record its keys, type its input, flip its loop switch, and have all
of it persisted to gamemacro.toml without ever clicking save.

Removed: HotkeyRow.tsx, EditorDrawer.tsx, related makeStyles classes.

Plan: docs/plans/2026-05-23-gamemacro-gui-redesign.md (Sub-PR C)"
```

---

## Sub-PR D：收尾（可选）

> 不强制做；做完 A/B/C 后如果 GUI 整体跑顺，**可直接进入阶段 4（daemon 静默化）**。这里列出来是为了记录哪些「锦上添花」可以挑着做。

- D1：状态灯组件（实时显示 daemon 是否运行 + 目标窗口是否聚焦）—— 需 daemon 暴露 status pipe，留给阶段 4
- D2：GUI 启动时若 daemon 未运行，自动 spawn 一个（`shellExecute runas` UAC 一次）—— 留给阶段 4
- D3：暗色主题切换（`webDarkTheme`）+ 跟随系统 —— 1h 工作，可独立 PR

---

## 完成标准

- [x] `pnpm build` + `pnpm tauri:build --no-bundle` 全部通过
- [x] 启动后 GUI 形态 = 标题栏 + 顶栏 + 单列卡片 + 「+ 新增」
- [x] 0 显式保存按钮、0 dirty 标记、0 撤销/重做
- [x] 每条热键独立 `repeat` 开关 + 独立间隔覆盖（在卡片展开态 ⚙ 高级里）
- [x] 设置 Dialog 三 tab 完整可用
- [x] daemon 在 GUI 编辑后 500ms 自动 reload；按热键行为符合新字段
- [x] 旧组件全部删除：`Sidebar/* / DirtyBar / ProfileHeader / EditorDrawer / HotkeyRow / pages/WindowPage / pages/TimingPage / useGlobalShortcuts`

---

## 不做（明确 YAGNI）

- ❌ 状态灯实时数据（daemon status 管道）→ 阶段 4
- ❌ daemon 启停按钮、开机自启、深色模式 → 阶段 4 / 后续小 PR
- ❌ profile 导入导出
- ❌ 组合键的"录制时屏蔽 OS 默认行为"（按 Ctrl+S 不应该触发浏览器另存）—— 实际上 Tauri webview 不太会有此问题，先不处理
- ❌ 国际化（中文 only）
