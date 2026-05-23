import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording } from "../lib/recorder";
import type { ToastKind } from "../types";

interface Options {
  flash: (kind: ToastKind, text: string) => void;
  onCaptured: (combo: { modifiers: string[]; trigger: string }) => void;
  onSettled?: () => void;
}

/**

 * useRecorder
 *
 * 状态机：idle → recording（修饰键累积中） → idle。
 * 调用 toggle() 在两个状态间切换。
 * 录制态期间通过 `pendingModifiers` 实时反馈用户按下的修饰键集合（UI 用）。
 */
export function useRecorder({ flash, onCaptured, onSettled }: Options) {
  const [recording, setRecording] = useState(false);

  const [pendingModifiers, setPendingModifiers] = useState<string[]>([]);
  const cancelRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRecording(false);
    setPendingModifiers([]);
  }, []);

  // 卸载时清理
  useEffect(() => () => cancelRef.current?.(), []);

  const start = useCallback(() => {
    if (recording) return;
    setRecording(true);
    setPendingModifiers([]);
    cancelRef.current = startRecording(
      (res) => {
        setRecording(false);
        setPendingModifiers([]);
        cancelRef.current = null;
        if (res.kind === "captured") {
          onCaptured({
            modifiers: res.combo.modifiers,
            trigger: res.combo.trigger,
          });
          const label = [...res.combo.modifiers, res.combo.trigger].join(" + ");
          flash("success", `已录入 ${label}`);
        } else if (res.kind === "unsupported") {
          flash(
            "error",
            `不支持的按键：${res.raw}（请用字母 / 数字 / F1-F12 / 反引号）`,
          );
        }
        // cancelled 静默处理
        onSettled?.();
      },
      {
        onProgress: (mods) => setPendingModifiers(mods),

      },
    );
  }, [recording, onCaptured, onSettled, flash]);

  const toggle = useCallback(() => {
    if (recording) stop();

    else start();
  }, [recording, start, stop]);

  return { recording, pendingModifiers, start, stop, toggle };
}
