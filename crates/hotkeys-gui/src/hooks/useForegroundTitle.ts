import { useEffect, useState } from "react";
import { currentForegroundTitle } from "../lib/api";

/**
 * 当 enabled=true 时，每隔 intervalMs 拉取一次前台窗口标题。
 * 关闭时停止轮询并清空。
 */
export function useForegroundTitle(
  enabled: boolean,
  intervalMs = 1500,
): string {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!enabled) {
      setTitle("");
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const t = await currentForegroundTitle();
        if (alive) setTitle(t);
      } catch {
        /* noop */
      }
    };
    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return title;
}
