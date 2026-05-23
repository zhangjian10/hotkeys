// 与 Rust 后端的所有通信都集中在这里。

import { invoke } from "@tauri-apps/api/core";

export interface HotkeyConfig {
  /**
   * 修饰键序列（每项必须出自 ALL_MODIFIERS）。**保留用户按下的顺序**——
   * 录制时按下的次序决定保存顺序；查重 / 触发匹配都按数组本身做。
   * 空数组 = 无修饰键（不推荐，单字母会与游戏内输入冲突）。
   */
  modifiers: string[];
  trigger_key: string;
  input_string: string;
  description: string | null;
  /** 按一次开始循环输入、再按一次停止；缺省 true（与 engine 默认一致）。 */
  repeat?: boolean;
  /** 覆盖此条热键专属的循环间隔（秒）。null/undefined 时使用 profile 的 auto_input_interval_secs。 */
  interval_secs_override?: number | null;
}

/** 一个 Profile 对应某一类窗口（例如某款游戏） */
export interface Profile {
  name: string;
  window_keywords: string[];
  hotkeys: HotkeyConfig[];
  auto_input_interval_secs: number;
  input_delay_millis: number;
}

export interface AppConfig {
  profiles: Profile[];
}

export interface ConfigBundle {
  /** 配置文件绝对路径（仅用于状态栏展示） */
  path: string;
  /** 配置内容 */
  config: AppConfig;
}

export interface WindowInfo {
  hwnd: number;
  title: string;
}

export const ALL_MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"] as const;

export const ALL_TRIGGERS = [
  "BackQuote",
  "Num0",
  "Num1",
  "Num2",
  "Num3",
  "Num4",
  "Num5",
  "Num6",
  "Num7",
  "Num8",
  "Num9",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

/** 把内部触发键名转成对小白友好的键盘符号（例如 BackQuote → \`、Num1 → 1） */
export function displayKey(key: string): string {
  if (key === "BackQuote") return "`";
  if (key.startsWith("Num") && key.length === 4) return key.slice(3);
  return key;
}

export async function loadConfig(): Promise<ConfigBundle> {
  return invoke<ConfigBundle>("load_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke("save_config", { config });
}

export async function revealConfig(): Promise<void> {
  await invoke("reveal_config");
}

export async function listWindows(): Promise<WindowInfo[]> {
  return invoke<WindowInfo[]>("list_windows");
}

/** 取当前前台窗口标题；用于"窗口匹配"页实时反馈 */
export async function currentForegroundTitle(): Promise<string> {
  return invoke<string>("current_foreground_title");
}

/** 试一下：把 input 文本通过模拟键盘输入到当前焦点窗口 */
export async function tryInput(text: string): Promise<void> {
  await invoke("try_input", { text });
}

/* ============================================================================
 * Engine 状态 / 控制（进程内直调，无 IPC）
 *
 * 整合前 daemon 是独立进程，整合后 engine 与 GUI 同进程：
 * - engine 与 GUI 同进程，所有 invoke 都是直接函数调用
 * - 不再有 "running" 概念（进程要么活着要么挂了，挂了 GUI 也一并退出）
 * - 新增 enabled：用户开关，运行时可 toggle 而无需重启
 * ========================================================================== */

export interface EngineStatus {
  /** 命中某 profile（窗口聚焦匹配） */
  active: boolean;
  /** 用户开关：是否启用热键监听 */
  enabled: boolean;
  /** 激活的 profile 名 */
  profile: string | null;
  /** 激活的 profile 在 profiles 数组中的索引 */
  profile_index: number | null;
}

/** 查询 engine 状态。同进程直调，不会失败 —— 用 try/catch 兜底纯属保险。 */
export async function engineStatus(): Promise<EngineStatus> {
  return invoke<EngineStatus>("engine_status");
}

/** 启用 / 禁用热键监听（运行时开关，不影响进程生命周期） */
export async function setEngineEnabled(enabled: boolean): Promise<void> {
  await invoke("set_engine_enabled", { enabled });
}

/** 同步读 enabled（极少需要，通常用 engineStatus 一次拿全） */
export async function engineEnabled(): Promise<boolean> {
  return invoke<boolean>("engine_enabled");
}

/** 在资源管理器中打开日志文件位置：`%LOCALAPPDATA%\GameMacro\gamemacro.log` */
export async function revealLog(): Promise<void> {
  await invoke("reveal_log");
}

export function emptyProfile(name = "新建配置"): Profile {
  return {
    name,
    window_keywords: [],
    hotkeys: [],
    auto_input_interval_secs: 3,
    input_delay_millis: 50,
  };
}

export function emptyConfig(): AppConfig {
  return { profiles: [] };
}

/** 新建一条空热键（默认 repeat=true，与 engine 历史行为一致）。 */
export function emptyHotkey(): HotkeyConfig {
  return {
    modifiers: ["Ctrl"],
    trigger_key: "A",
    input_string: "",
    description: null,
    repeat: true,
    interval_secs_override: null,
  };
}

/** 把 modifiers + trigger 拼成"组合键身份"，与 core::combo_signature 对齐。
 *  modifiers 顺序敏感：Ctrl+Shift 与 Shift+Ctrl 视为不同条目。 */
export function comboSignature(hk: HotkeyConfig): string {
  const mods = hk.modifiers ?? [];
  return mods.length === 0 ? hk.trigger_key : `${mods.join("+")}::${hk.trigger_key}`;
}
