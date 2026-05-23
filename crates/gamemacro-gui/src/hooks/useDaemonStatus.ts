import { useEffect, useState } from "react";

import { type DaemonStatus, daemonStatus } from "../lib/api";

const POLL_MS = 2000;

/**
 * 轮询 daemon 状态。每 2s 查询一次；窗口被隐藏时暂停以省资源。
 *
 * 返回的 `status` 在初次结果到达前是 null，组件可据此显示「检查中…」。
 */
export function useDaemonStatus(): DaemonStatus | null {
  const [status, setStatus] = useState<DaemonStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const s = await daemonStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) {
          setStatus({ running: false, active: false, profile: null, pid: null });
        }
      }
      if (!cancelled) {
        timer = window.setTimeout(tick, POLL_MS);
      }
    };

    void tick();

    const onVisibility = () => {
      if (document.hidden) {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      } else if (timer === null && !cancelled) {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return status;
}
