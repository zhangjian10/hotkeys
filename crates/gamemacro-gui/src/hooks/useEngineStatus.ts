import { useCallback, useEffect, useRef, useState } from "react";

import { type EngineStatus, engineStatus, setEngineEnabled } from "../lib/api";

const POLL_MS = 2000;

export interface UseEngineStatusResult {
  /** 当前快照；首次轮询完成前为 null */
  status: EngineStatus | null;
  /**
   * 切换"启用热键监听"开关。
   *
   * 行为：
   * 1. 本地 state 立即反映新值（乐观更新）—— Switch 不会"回弹"
   * 2. 调用后端命令；等待返回（同进程，几乎瞬时）
   * 3. 成功后立刻发起一次额外的状态查询，让真值接管，避免与 2s 轮询节奏脱钩
   * 4. 失败则回滚本地 state 并 throw 出去给上层 toast
   */
  setEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * 轮询 engine 状态。每 2s 查询一次；窗口被隐藏时暂停以省资源。
 *
 * 整合后 engine 与 GUI 同进程，invoke 不会失败 —— 但仍保留 try/catch 兜底，
 * 出错时返回一个安全默认值（已禁用 + 未激活）以避免 UI 抛错。
 */
export function useEngineStatus(): UseEngineStatusResult {
  const [status, setStatus] = useState<EngineStatus | null>(null);

  // refetch 给 setEnabled 用，让"乐观值 → 真值"的过渡尽量短。
  // 用 ref 而不是 state，避免把 refetch 暴露到依赖数组里。
  const refetchRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const fetchOnce = async () => {
      try {
        const s = await engineStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) {
          setStatus({
            active: false,
            enabled: false,
            profile: null,
            profile_index: null,
          });
        }
      }
    };

    const tick = async () => {
      await fetchOnce();
      if (!cancelled) {
        timer = window.setTimeout(tick, POLL_MS);
      }
    };

    refetchRef.current = fetchOnce;

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

  const setEnabled = useCallback(async (enabled: boolean) => {
    // 乐观更新：先把本地 state 翻过去，让 Switch 不回弹
    let prev: EngineStatus | null = null;
    setStatus((cur) => {
      prev = cur;
      if (cur === null) return cur;
      return { ...cur, enabled };
    });

    try {
      await setEngineEnabled(enabled);
      // 真值接管：不等下一次 2s 轮询
      await refetchRef.current();
    } catch (e) {
      // 回滚
      setStatus(prev);
      throw e;
    }
  }, []);

  return { status, setEnabled };
}
