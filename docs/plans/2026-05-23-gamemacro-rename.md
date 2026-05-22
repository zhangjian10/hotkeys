# GameMacro 阶段 1：项目改名实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把项目从 `hotkeys` / `Warcraft Hotkeys Helper` 整体改名为 `gamemacro` / `GameMacro`，包含所有 crate 名、二进制名、Tauri 标识、npm 包名、配置文件名、品牌文案、目录名，行为零变化。

**Architecture:** 纯机械性重命名 PR。先改 Cargo workspace 三个 crate 的目录与包名（一次性改完，避免半路编译失败的中间态），再改 Tauri 配置与前端 npm 元信息，再改运行时配置文件名（含旧文件自动迁移逻辑），最后改 README 与品牌文案。所有 UI 行为、组件结构、数据模型保持不变——这些归阶段 2/3。

**Tech Stack:** Rust 2024 + Cargo workspace · Tauri v2 · React 19 · Fluent UI v9 · pnpm

**前置约束（重要）：**
- 本阶段**不**改动以下命名（语义中性，归阶段 3 GUI 重构统一处理）：
  - 类型名 `HotkeyConfig` / `Profile` / `Config`（这些是领域语义，不是品牌名）
  - 组件名 `HotkeyRow.tsx` / `KeyChip.tsx` / `EditorDrawer.tsx` 等（阶段 3 整体重构会替换为 `HotkeyCard` / `KeyBadge` / `SettingsDialog`）
  - Tauri 命令名 `read_config` / `write_config` 等
- 本阶段**只**改与"品牌 / 包 / 二进制 / 文件名 / 标识符"相关的命名

**完整的命名映射表见 `docs/plans/2026-05-23-gamemacro-redesign-design.md` §2。**

---

## Task 1：基线快照与分支

**Files:** 无文件改动

**Step 1: 确认 git 工作区干净**

Run: `git status`
Expected: `nothing to commit, working tree clean`

**Step 2: 确认基线构建通过**

Run: `cargo build`
Expected: 编译成功，无错误（warning 可忽略）

**Step 3: 确认基线测试通过**

Run: `cargo test -p hotkeys-core`
Expected: 全部通过

**Step 4: 创建本阶段 commit 起点（无文件改动，仅记录）**

无需 commit，只是确认基线状态。后续每个 Task 自带 commit。

---

## Task 2：重命名 crate 目录

**Files:**
- Rename: `crates/hotkeys-core/` → `crates/gamemacro-core/`
- Rename: `crates/hotkeys-daemon/` → `crates/gamemacro-daemon/`
- Rename: `crates/hotkeys-gui/` → `crates/gamemacro-gui/`
- Rename: `crates/gamemacro-core/default_hotkeys.toml` → `crates/gamemacro-core/default_config.toml`

**Step 1: 用 git mv 重命名三个 crate 目录（保留历史）**

Run（PowerShell，逐条执行）:
```
git mv crates/hotkeys-core crates/gamemacro-core
git mv crates/hotkeys-daemon crates/gamemacro-daemon
git mv crates/hotkeys-gui crates/gamemacro-gui
```

**Step 2: 重命名 default 配置文件**

Run:
```
git mv crates/gamemacro-core/default_hotkeys.toml crates/gamemacro-core/default_config.toml
```

**Step 3: 不要 build（此时还会失败，因为 Cargo.toml 里的路径还是旧的）**

跳过 build，留到 Task 3 之后整体验证。

**Step 4: Commit**

```
git add -A
git commit -m "chore: rename crate directories from hotkeys to gamemacro"
```

---

## Task 3：更新 workspace 根 Cargo.toml

**Files:**
- Modify: `Cargo.toml`

**Step 1: 修改 workspace members**

把 `Cargo.toml` 中：
```toml
members = [
    "crates/hotkeys-core",
    "crates/hotkeys-daemon",
    "crates/hotkeys-gui/src-tauri",
]
```
改为：
```toml
members = [
    "crates/gamemacro-core",
    "crates/gamemacro-daemon",
    "crates/gamemacro-gui/src-tauri",
]
```

**Step 2: 不要 build（依然会失败，Task 4 修完后再 build）**

**Step 3: Commit**

```
git add Cargo.toml
git commit -m "chore: update workspace members to gamemacro paths"
```

---

## Task 4：重命名 gamemacro-core 包

**Files:**
- Modify: `crates/gamemacro-core/Cargo.toml`
- Modify: `crates/gamemacro-core/src/config.rs`（修改 `include_str!` 路径）

**Step 1: 改 Cargo.toml 包名**

`crates/gamemacro-core/Cargo.toml`：
```toml
[package]
name = "gamemacro-core"     # 旧 hotkeys-core
version = "0.1.0"
edition = "2024"
```

**Step 2: 改默认配置 include_str! 路径**

`crates/gamemacro-core/src/config.rs:5`：
```rust
const DEFAULT_CONFIG_TOML: &str = include_str!("../default_config.toml");
//                                                  ^^^^^^^^^^^^^^^^^^
// 旧值: ../default_hotkeys.toml
```

**Step 3: 单独构建 core 验证**

Run: `cargo build -p gamemacro-core`
Expected: 成功

**Step 4: 跑 core 单元测试**

Run: `cargo test -p gamemacro-core`
Expected: 全部通过（4 个测试：default_config_roundtrip / matches_title_keyword / matches_title_fuzzy / first_match_wins）

**Step 5: Commit**

```
git add crates/gamemacro-core
git commit -m "refactor(core): rename package to gamemacro-core"
```

---

## Task 5：重命名 gamemacro-daemon 包

**Files:**
- Modify: `crates/gamemacro-daemon/Cargo.toml`
- 全局替换：所有 `crates/gamemacro-daemon/src/*.rs` 中的 `use hotkeys_core` → `use gamemacro_core`

**Step 1: 改 Cargo.toml**

`crates/gamemacro-daemon/Cargo.toml`：
```toml
[package]
name = "gamemacro-daemon"    # 旧 hotkeys-daemon
version = "0.1.0"
edition = "2024"

[[bin]]
name = "gamemacro-daemon"    # 旧 hotkeys-daemon
path = "src/main.rs"

[dependencies]
gamemacro-core = { path = "../gamemacro-core" }   # 旧 hotkeys-core = { path = "../hotkeys-core" }
# 其余依赖保持不变
```

**Step 2: 替换所有 daemon 源文件中的 `hotkeys_core` 引用**

需要修改的文件（grep 命中）：
- `crates/gamemacro-daemon/src/main.rs`
- `crates/gamemacro-daemon/src/state.rs`
- `crates/gamemacro-daemon/src/hotkey.rs`

每个文件中执行替换：`hotkeys_core` → `gamemacro_core`（含 `use hotkeys_core::...`、`hotkeys_core::Config` 等所有出现位置）

PowerShell 批量替换示例（在仓库根目录执行）：
```powershell
Get-ChildItem -Path crates/gamemacro-daemon/src -Recurse -Include *.rs | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace 'hotkeys_core', 'gamemacro_core' | Set-Content $_.FullName -NoNewline
}
```

执行后**逐文件用 `git diff` 检查**，确认替换符合预期、没有误伤。

**Step 3: 构建 daemon**

Run: `cargo build -p gamemacro-daemon`
Expected: 成功，产出 `target/debug/gamemacro-daemon.exe`

**Step 4: Commit**

```
git add crates/gamemacro-daemon
git commit -m "refactor(daemon): rename package to gamemacro-daemon"
```

---

## Task 6：重命名 gamemacro-gui Tauri 后端包

**Files:**
- Modify: `crates/gamemacro-gui/src-tauri/Cargo.toml`
- Modify: `crates/gamemacro-gui/src-tauri/src/main.rs`
- Modify: `crates/gamemacro-gui/src-tauri/src/lib.rs`

**Step 1: 改 Tauri 后端 Cargo.toml**

`crates/gamemacro-gui/src-tauri/Cargo.toml`：
```toml
[package]
name = "gamemacro-gui"       # 旧 hotkeys-gui
version = "0.1.0"
edition = "2024"
description = "GameMacro 配置 GUI（Tauri v2 + React + Fluent UI v9）"

[[bin]]
name = "gamemacro"           # 旧 hotkeys-gui   注意：这是用户主入口，去掉 -gui 后缀
path = "src/main.rs"

[lib]
name = "gamemacro_lib"       # 旧 hotkeys_gui_lib
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
gamemacro-core = { path = "../../gamemacro-core" }   # 旧 hotkeys-core
# 其余依赖保持不变
```

**Step 2: 检查并修改 src/main.rs 与 src/lib.rs**

先 `read_file` 看现有内容，再相应替换：
- `hotkeys_gui_lib` → `gamemacro_lib`
- `hotkeys_core::` → `gamemacro_core::`

PowerShell 批量替换：
```powershell
Get-ChildItem -Path crates/gamemacro-gui/src-tauri/src -Recurse -Include *.rs | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    $c = $c -replace 'hotkeys_gui_lib', 'gamemacro_lib'
    $c = $c -replace 'hotkeys_core', 'gamemacro_core'
    Set-Content $_.FullName -Value $c -NoNewline
}
```

**Step 3: 构建 Tauri 后端**

Run: `cargo build -p gamemacro-gui`
Expected: 成功，产出 `target/debug/gamemacro.exe`

**Step 4: 全 workspace 构建确认**

Run: `cargo build`
Expected: 三个 crate 全部成功

**Step 5: Commit**

```
git add crates/gamemacro-gui/src-tauri
git commit -m "refactor(gui): rename tauri backend to gamemacro-gui, binary to gamemacro"
```

---

## Task 7：更新 Tauri 配置（productName / identifier / 窗口标题）

**Files:**
- Modify: `crates/gamemacro-gui/src-tauri/tauri.conf.json`

**Step 1: 修改 Tauri 配置**

把 `crates/gamemacro-gui/src-tauri/tauri.conf.json` 中：
```json
{
  "productName": "Hotkeys GUI",
  "identifier": "com.hotkeys.gui",
  "app": {
    "windows": [
      {
        "title": "Hotkeys 配置",
        ...
```
改为：
```json
{
  "productName": "GameMacro",
  "identifier": "com.gamemacro.app",
  "app": {
    "windows": [
      {
        "title": "GameMacro",
        ...
```

其余字段（width / height / icon 等）保持不变。

**Step 2: 检查 capabilities 文件夹是否含旧 identifier**

Run: `Get-ChildItem -Path crates/gamemacro-gui/src-tauri/capabilities -Recurse -File | Select-String -Pattern "hotkeys"`
Expected: 无命中；若有命中，按相同思路替换为 gamemacro

**Step 3: 构建确认**

Run: `cargo build -p gamemacro-gui`
Expected: 成功

**Step 4: Commit**

```
git add crates/gamemacro-gui/src-tauri/tauri.conf.json
git add crates/gamemacro-gui/src-tauri/capabilities
git commit -m "refactor(gui): update Tauri productName/identifier to GameMacro"
```

---

## Task 8：更新前端 npm 元信息与 Tauri JS API 引用

**Files:**
- Modify: `crates/gamemacro-gui/package.json`
- 检查: `crates/gamemacro-gui/src/lib/api.ts`、`crates/gamemacro-gui/src/lib/utils.ts`、`crates/gamemacro-gui/src/hooks/useConfigState.ts`、`crates/gamemacro-gui/src/hooks/useDerived.ts`、`crates/gamemacro-gui/src/App.tsx`、`crates/gamemacro-gui/src/components/HotkeyRow.tsx`、`crates/gamemacro-gui/src/components/EditorDrawer.tsx`、`crates/gamemacro-gui/src/components/pages/HotkeysPage.tsx`

**Step 1: 改 package.json**

`crates/gamemacro-gui/package.json`：
```json
{
  "name": "gamemacro-gui",   // 旧 hotkeys-gui
  ...
}
```
其余 scripts / dependencies 保持不变。

**Step 2: 排查前端代码中含 "hotkeys" 字面量的位置**

Run: `Get-ChildItem -Path crates/gamemacro-gui/src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "hotkeys" -SimpleMatch`

**对每条命中分类处理：**
- 如果是**字符串中的配置文件名**（比如 `"hotkeys.toml"`） → 改为 `"gamemacro.toml"`
- 如果是**注释/文档中的项目名** → 改为 `GameMacro`
- 如果是**领域命名**（如组件名 `HotkeyRow`、变量 `hotkeys: HotkeyConfig[]`、函数 `parseHotkey`） → **保留不动**（这些是领域语义，归阶段 3 改）

> 重点关注：`api.ts` 里如果有任何 `invoke('xxx_hotkeys')` 之类的命令名，对应的 Rust 端命令名也得同步改；但本阶段**不改 Tauri 命令名**，所以这里只改文档/字面量。

**Step 3: 在 IDE 里逐文件 review**

每个命中文件用 `read_file` 看一遍，做精确替换后 `git diff` 检查。

**Step 4: 安装依赖并构建前端**

Run（在 `crates/gamemacro-gui` 目录下）:
```
pnpm install
pnpm build
```
Expected: `dist/` 产出无报错

**Step 5: Commit**

```
git add crates/gamemacro-gui/package.json crates/gamemacro-gui/src crates/gamemacro-gui/pnpm-lock.yaml
git commit -m "refactor(gui): update frontend package name and string references to gamemacro"
```

---

## Task 9：运行时配置文件改名 + 旧文件自动迁移

**Files:**
- Modify: `crates/gamemacro-daemon/src/main.rs`（启动时迁移逻辑）
- Modify: 仓库根的 `hotkeys.toml` → `gamemacro.toml`（开发时使用的配置文件）

**Step 1: 重命名仓库根的开发配置**

Run: `git mv hotkeys.toml gamemacro.toml`

**Step 2: 在 daemon 里加自动迁移逻辑**

先用 `read_file` 看 `crates/gamemacro-daemon/src/main.rs` 中加载 config 的位置，找到调用 `Config::load_or_create` 的地方。

**目标行为：**
- daemon 启动时，先确定配置目录（沿用现有逻辑：daemon exe 同目录）
- 计算 `new_path = dir/gamemacro.toml`、`old_path = dir/hotkeys.toml`
- 如果 `new_path` 不存在但 `old_path` 存在 → `fs::rename(old_path, new_path)`，并 `eprintln!` 一行迁移日志
- 然后正常 `Config::load_or_create(new_path)`

**插入代码（紧挨在 load_or_create 调用之前）：**

```rust
// 一次性迁移：旧 hotkeys.toml → 新 gamemacro.toml
let old_config = config_dir.join("hotkeys.toml");
let new_config = config_dir.join("gamemacro.toml");
if !new_config.exists() && old_config.exists() {
    if let Err(e) = std::fs::rename(&old_config, &new_config) {
        eprintln!(
            "Warning: failed to migrate {} -> {}: {}",
            old_config.display(),
            new_config.display(),
            e
        );
    } else {
        println!(
            "Migrated config: {} -> {}",
            old_config.display(),
            new_config.display()
        );
    }
}
```

> 具体变量名（`config_dir`）需根据现有 main.rs 实际定义对齐。如果现有代码里直接拼 `"hotkeys.toml"` 字符串，则同步改为 `"gamemacro.toml"`，并把上述迁移片段放在加载之前。

**Step 3: 全 workspace 搜索硬编码的 `hotkeys.toml` 字符串**

Run: `Get-ChildItem -Path crates -Recurse -Include *.rs,*.ts,*.tsx,*.json | Select-String -Pattern "hotkeys\.toml"`

把所有命中改为 `gamemacro.toml`（除了 Task 9 Step 2 加的迁移逻辑里的 `"hotkeys.toml"` 旧路径）。

**Step 4: 构建 daemon**

Run: `cargo build -p gamemacro-daemon`
Expected: 成功

**Step 5: 跑一次 daemon 的迁移逻辑（手动验证）**

```powershell
# 准备：创建一个旧文件副本测试迁移
Copy-Item gamemacro.toml hotkeys.toml -ErrorAction SilentlyContinue
# 临时把 gamemacro.toml 移走
Move-Item gamemacro.toml gamemacro.toml.bak

# 跑 daemon（按 Ctrl+C 几秒后中断）
.\target\debug\gamemacro-daemon.exe
# 预期控制台输出: "Migrated config: ...\hotkeys.toml -> ...\gamemacro.toml"
# 预期文件系统: hotkeys.toml 消失，gamemacro.toml 重新出现

# 还原
Move-Item gamemacro.toml.bak gamemacro.toml -Force
```

**Step 6: Commit**

```
git add -A
git commit -m "feat(daemon): rename config to gamemacro.toml with auto-migration from hotkeys.toml"
```

---

## Task 10：更新 README 与品牌文案

**Files:**
- Rewrite: `README.md`
- 检查: `crates/gamemacro-gui/src/constants/app.tsx`（如含项目名常量）

**Step 1: 重写 README.md**

把 `README.md` 整体改写为 GameMacro 品牌：
- 标题：`# GameMacro`
- 一句话：「给游戏加一组宏热键，按一次循环执行」
- 副标题：「自定义快捷键 · 一键连发 · 专为游戏打造」
- 把所有 `Warcraft Hotkeys Helper` / `hotkeys-daemon.exe` / `hotkeys-gui.exe` / `hotkeys.toml` 文案替换为：
  - `GameMacro` / `gamemacro-daemon.exe` / `gamemacro.exe` / `gamemacro.toml`
- 项目结构图同步改为新目录名
- 「专为魔兽争霸 III 设计」改为「默认提供魔兽争霸 III 配置示例，但适用于任何接受文本输入的游戏」
- 在 README 顶部加一行小字："旧用户配置 `hotkeys.toml` 会在首次运行 daemon 时自动迁移为 `gamemacro.toml`"
- 「项目结构」一节里的旧设计文档路径，加上：「旧设计稿 `docs/plans/2026-05-22-gui-design.md` 已废弃，新设计见 `docs/plans/2026-05-23-gamemacro-redesign-design.md`」

**Step 2: 检查前端 constants 是否含项目名常量**

Run: `read_file crates/gamemacro-gui/src/constants/app.tsx`

如有 `APP_NAME = "Hotkeys"` / 窗口标题字符串等，改为 `"GameMacro"`。

**Step 3: 给旧设计稿加 deprecated 标记**

在 `docs/plans/2026-05-22-gui-design.md` 文件最顶部插入一行：
```markdown
> **⚠️ DEPRECATED 2026-05-23：本设计稿已被 `2026-05-23-gamemacro-redesign-design.md` 取代。保留仅作历史参考。**
```

**Step 4: Commit**

```
git add README.md crates/gamemacro-gui/src/constants docs/plans/2026-05-22-gui-design.md
git commit -m "docs: rebrand to GameMacro across README and constants"
```

---

## Task 11：全量验证

**Files:** 无文件改动，纯验证

**Step 1: clean build 确认**

Run: `cargo clean; cargo build`
Expected: 三个 crate 全部成功

**Step 2: 跑核心测试**

Run: `cargo test -p gamemacro-core`
Expected: 全部通过

**Step 3: 二进制产物检查**

Run: `Get-ChildItem target/debug/gamemacro*.exe`
Expected: 至少看到 `gamemacro-daemon.exe` 和 `gamemacro.exe`（不应再有 `hotkeys-*.exe`）

**Step 4: 全仓搜残留旧名**

Run:
```powershell
Get-ChildItem -Path . -Recurse -Include *.rs,*.ts,*.tsx,*.toml,*.json,*.md `
  -Exclude *.lock `
  | Where-Object { $_.FullName -notmatch 'node_modules|target|dist|\.codebuddy' } `
  | Select-String -Pattern '\bhotkeys[-_](core|daemon|gui)\b|hotkeys_gui_lib|hotkeys\.toml|com\.hotkeys\.gui|"Hotkeys GUI"|Hotkeys 配置|Warcraft Hotkeys Helper' `
  -SimpleMatch:$false
```
Expected: 无命中（除了 Task 9 迁移代码里"old_config" 字符串里的 `"hotkeys.toml"` 是允许的，可加 `-NotMatch '迁移|migrate'` 过滤）

**Step 5: 手动跑一次 GUI（烟雾测试）**

```
cd crates/gamemacro-gui
pnpm tauri dev
```
Expected:
- 窗口标题显示 `GameMacro`
- 任务管理器进程名为 `gamemacro.exe`
- 启动时不报错；编辑保存功能（旧逻辑）能用

**Step 6: 手动跑一次 daemon**

```
.\target\debug\gamemacro-daemon.exe
```
Expected: 正常加载 `gamemacro.toml` 配置；按热键能触发输入（行为与改名前一致）

**Step 7: 最终 commit（如果 Step 4 发现遗漏，补完后单独提交）**

无遗漏则跳过；有则：
```
git add -A
git commit -m "chore: final cleanup of legacy hotkeys references"
```

---

## 完成标准

- [x] `cargo build` 全 workspace 通过
- [x] `cargo test -p gamemacro-core` 全部通过
- [x] `target/debug/` 下产物为 `gamemacro-daemon.exe` 和 `gamemacro.exe`
- [x] GUI 窗口标题显示 `GameMacro`
- [x] daemon 启动时若存在旧 `hotkeys.toml` 自动迁移为 `gamemacro.toml`
- [x] 全仓搜不到残留的 `hotkeys-core/daemon/gui` 包名、`hotkeys_gui_lib`、`com.hotkeys.gui`、`"Hotkeys GUI"`、`Warcraft Hotkeys Helper` 等旧品牌字符串
- [x] 行为与阶段 1 之前完全一致（无功能变化）
- [x] commit 历史清晰，按 Task 切分（共约 9～10 个 commit）

---

## 不在本阶段做的事情（明确边界）

- ❌ 数据模型新增 `repeat` / `interval_secs_override` 字段 → 阶段 2
- ❌ 组件重构（`HotkeyRow` → `HotkeyCard`、`KeyChip` → `KeyBadge`、`EditorDrawer` 删除等）→ 阶段 3
- ❌ 自动保存 / 取消显式保存按钮 → 阶段 3
- ❌ 设置弹窗 / Profile 菜单 / 状态灯 → 阶段 3
- ❌ daemon 静默化（无控制台窗口）→ 阶段 4
- ❌ Tauri 命令名变更 → 阶段 3 视需要
