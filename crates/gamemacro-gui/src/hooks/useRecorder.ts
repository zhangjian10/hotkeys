import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording } from "../lib/recorder";
import type { ToastKind } from "../types";

interface CapturedCombo {
  modifier: string | null;
  trigger: string;
}

interface Options {
  flash: (kind: ToastKind, text: string) => void;
  onCaptured: (combo: { modifier: string; trigger: string }) => void;
}

/**
 * useRecorder
 *
 * 状态机：idle → recording → idle。
 * 调用 toggle() 在两个状态间切换。
 */
export function useRecorder({ flash, onCaptured }: Options) {
  const [recording, setRecording] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRecording(false);
  }, []);

  // 卸载时清理
  useEffect(() => () => cancelRef.current?.(), []);

  const start = useCallback(() => {
    if (recording) return;
    setRecording(true);
    cancelRef.current = startRecording((res) => {
      setRecording(false);
      cancelRef.current = null;
      if (res.kind === "captured") {
        const captured = res.combo as CapturedCombo;
        onCaptured({
          modifier: captured.modifier ?? "Ctrl",
          trigger: captured.trigger,
        });
        flash("success", "组合键已录入");
      } else if (res.kind === "unsupported") {
        flash(
          "error",
          `不支持的按键：${res.raw}（请用字母 / 数字 / F1-F12 / 反引号）`,
        );
      }
      // cancelled 静默处理
    });
  }, [recording, onCaptured, flash]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  return { recording, start, stop, toggle };
}

