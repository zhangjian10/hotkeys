// 与 Rust 后端的所有通信都集中在这里。

import { invoke } from "@tauri-apps/api/core";

export interface HotkeyConfig {
  modifier_key: string;
  trigger_key: string;
  input_string: string;
  description: string | null;
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

/** 修饰键候选 */
export const ALL_MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"] as const;

/** 触发键候选 */
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

export async function loadConfig(): Promise<ConfigBundle> {
  return invoke<ConfigBundle>("load_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await invoke("save_config", { config });
}

/** 在文件管理器中定位 hotkeys.toml */
export async function revealConfig(): Promise<void> {
  await invoke("reveal_config");
}

/** 枚举当前可见的顶层窗口 */
export async function listWindows(): Promise<WindowInfo[]> {
  return invoke<WindowInfo[]>("list_windows");
}

/** 创建一个新的空 Profile */
export function emptyProfile(name = "新建配置"): Profile {
  return {
    name,
    window_keywords: [],
    hotkeys: [],
    auto_input_interval_secs: 3,
    input_delay_millis: 50,
  };
}

/** 创建一个新的空 AppConfig */
export function emptyConfig(): AppConfig {
  return { profiles: [] };
}
