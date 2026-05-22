import { useEffect } from "react";

interface Options {
  enabled?: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * 注册全局键盘快捷键：Ctrl+S / Ctrl+Z / Ctrl+Y(or Ctrl+Shift+Z)。
 * `enabled=false` 时不响应（例如录制中）。
 */
export function useGlobalShortcuts({
  enabled = true,
  onSave,
  onUndo,
  onRedo,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && !e.shiftKey && k === "s") {
        e.preventDefault();
        onSave();
      } else if (e.ctrlKey && !e.shiftKey && k === "z") {
        e.preventDefault();
        onUndo();
      } else if (
        (e.ctrlKey && k === "y") ||
        (e.ctrlKey && e.shiftKey && k === "z")
      ) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onSave, onUndo, onRedo]);
}
