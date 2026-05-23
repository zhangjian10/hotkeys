import type { ReactNode } from "react";
import {
  Keyboard20Regular,
  Timer20Regular,
  Window20Regular,
} from "@fluentui/react-icons";
import type { SectionId } from "../types";

export interface NavItemDef {
  id: SectionId;
  title: string;
  icon: ReactNode;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: "hotkeys", title: "热键", icon: <Keyboard20Regular /> },
  { id: "window", title: "窗口匹配", icon: <Window20Regular /> },
  { id: "timing", title: "输入节奏", icon: <Timer20Regular /> },
];

/** 与系统/常用应用冲突的组合键，录制时给出提示但不阻止 */
export const COMMON_RESERVED_COMBOS = new Set([
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+X",
  "Ctrl+Z",
  "Ctrl+Y",
  "Ctrl+A",
  "Ctrl+S",
  "Ctrl+W",
  "Ctrl+T",
  "Ctrl+N",
  "Ctrl+F",
  "Ctrl+P",
  "Ctrl+Q",
  "Alt+F4",
  "Ctrl+F4",
]);

/** Toaster 的全局 ID。 */
export const TOASTER_ID = "app-toaster";
