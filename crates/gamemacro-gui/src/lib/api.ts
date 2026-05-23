// 与 Rust 后端的所有通信都集中在这里。

import { invoke } from "@tauri-apps/api/core";

export interface HotkeyConfig {
  /**
   * 修饰键集合（每项必须出自 ALL_MODIFIERS）。空数组 = 无修饰键（不推荐，
   * 单字母会与游戏内输入冲突）。daemon 永远按字典序去重存储；GUI 写入前
   * 也应保持有序。
   */
  modifiers: string[];
  trigger_key: string;
  input_string: string;
  description: string | null;
  /** 按一次开始循环输入、再按一次停止；缺省 true（与 daemon 默认一致）。 */
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
 * Daemon IPC（命名管道经由 Tauri 命令转发）
 * ========================================================================== */

export interface DaemonStatus {
  running: boolean;
  active: boolean;
  profile: string | null;
  pid: number | null;
}

/** 查询后端状态。失败也总是 resolve（值为 not running），便于轮询。 */
export async function daemonStatus(): Promise<DaemonStatus> {
  return invoke<DaemonStatus>("daemon_status");
}

/** 发 STOP 指令请求 daemon 退出。 */
export async function daemonStop(): Promise<void> {
  await invoke("daemon_stop");
}

/** 启动后端：ShellExecute runas，会触发 UAC。 */
export async function daemonSpawn(): Promise<void> {
  await invoke("daemon_spawn");
}

/** 在资源管理器中打开 daemon 日志文件位置。 */
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

/** 新建一条空热键（默认 repeat=true，与 daemon 历史行为一致）。 */
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

/** 把任意 modifiers 序列化为字典序去重的"组合键身份"，与 core::combo_signature 对齐。 */
export function comboSignature(hk: HotkeyConfig): string {
  const sorted = [...new Set(hk.modifiers)].sort();
  return sorted.length === 0
    ? hk.trigger_key
    : `${sorted.join("+")}::${hk.trigger_key}`;
}

/** 规范化 modifiers：排序+去重，过滤空串。供 GUI 写入路径调用。 */
export function normalizeModifiers(mods: readonly string[]): string[] {
  const set = new Set<string>();
  for (const m of mods) {
    const t = m.trim();
    if (t) set.add(t);
  }
  return [...set].sort();
}
