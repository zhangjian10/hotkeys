import { useCallback, useEffect, useRef, useState } from "react";
import { tryInput } from "../lib/api";
import { formatErr } from "../lib/utils";
import type { ToastKind } from "../types";

interface Countdown {
  left: number;
  text: string;
}

interface Options {
  flash: (kind: ToastKind, text: string) => void;
  seconds?: number;
}

/**
 * 「试一下」: 显示 N 秒倒计时，时间到后调用 tryInput 把字符串敲进当前焦点。
 */
export function useTryInput({ flash, seconds = 3 }: Options) {
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    setCountdown(null);
  }, []);

  const start = useCallback(
    (text: string) => {
      cancel();
      const trimmed = text.trim();
      if (!trimmed) {
        flash("info", "这条热键还没有输入内容");
        return;
      }
      const tick = (left: number) => {
        if (left <= 0) {
          tryInput(text)
            .then(() => flash("success", "已发送，请查看目标窗口"))
            .catch((e) => flash("error", `发送失败：${formatErr(e)}`));
          setCountdown(null);
          timerRef.current = undefined;
          return;
        }
        setCountdown({ left, text });
        timerRef.current = window.setTimeout(() => tick(left - 1), 1000);
      };
      tick(seconds);
    },
    [cancel, flash, seconds],
  );

  useEffect(() => () => cancel(), [cancel]);

  return { countdown, start, cancel };
}
