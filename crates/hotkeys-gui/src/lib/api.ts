// 与 Rust 后端的所有通信都集中在这里。
//
// 前端**不直接**触达文件系统：所有读 / 写都通过 Tauri 命令（`invoke`），
// 这样后端可以做校验、避免并发写、未来加权限隔离也方便。

import { invoke } from "@tauri-apps/api/core";

export interface HotkeyConfig {
  modifier_key: string;
  trigger_key: string;
  input_string: string;
  description: string | null;
}

export interface AppConfig {
  window_keywords: string[];
  hotkeys: HotkeyConfig[];
  auto_input_interval_secs: number;
  input_delay_millis: number;
}

export interface ConfigBundle {
  /** 配置文件绝对路径（仅用于状态栏展示） */
  path: string;
  /** 配置内容 */
  config: AppConfig;
}

/** 修饰键候选（与 hotkeys-core 保持一致） */
export const ALL_MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"] as const;

/** 触发键候选（与 hotkeys-core 保持一致） */
export const ALL_TRIGGERS = [
  "BackQuote",
  "Num0", "Num1", "Num2", "Num3", "Num4",
  "Num5", "Num6", "Num7", "Num8", "Num9",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
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
