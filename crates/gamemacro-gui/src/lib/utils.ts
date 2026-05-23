import type { HotkeyConfig, Profile } from "./api";
import type { ToastKind } from "../types";

export function comboText(hotkey: HotkeyConfig): string {
  if (!hotkey.modifiers || hotkey.modifiers.length === 0) {
    return hotkey.trigger_key;
  }
  return `${hotkey.modifiers.join("+")}+${hotkey.trigger_key}`;
}

/** 把 "%abc%" 这种模糊匹配关键词显示得更可读 */
export function humanKeyword(kw: string): string {
  if (kw.startsWith("%") && kw.endsWith("%") && kw.length >= 2) {
    return kw.slice(1, -1);
  }
  return kw;
}

export function previewInput(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "（无输入内容）";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function formatErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function toastTitle(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "成功";
    case "error":
      return "错误";
    case "warning":
      return "警告";
    default:
      return "提示";
  }
}

/** 当前活动窗口标题是否会激活该 profile */
export function isMatchedByCurrent(title: string, profile: Profile): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return profile.window_keywords.some((kw) => {
    if (kw.includes("%")) {
      return lower.includes(kw.replace(/%/g, "").toLowerCase());
    }
    return lower === kw.toLowerCase();
  });
}
