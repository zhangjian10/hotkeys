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
