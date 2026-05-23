import { useCallback, useReducer } from "react";
import type { AppConfig, Profile, HotkeyConfig } from "../lib/api";
import { emptyConfig } from "../lib/api";

/**
 * useConfigState
 *
 * 集中管理配置状态。autosave 模型下不再维护 saved 副本和 undo / redo 栈，
 * 只追踪 `lastSavedAt`（用于 UI 显示"已保存"指示）。
 */

interface State {
  config: AppConfig;
  /** 最近一次成功保存到磁盘的 epoch ms；初次 load 之前为 null。 */
  lastSavedAt: number | null;
}

type Action =
  | { type: "load"; config: AppConfig; at: number }
  | { type: "patch"; updater: (prev: AppConfig) => AppConfig }
  | { type: "markSaved"; at: number };

const EMPTY = emptyConfig();

const initial: State = {
  config: EMPTY,
  lastSavedAt: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load": {
      // load 视为"上次保存就是这份"，避免初始化触发一次无谓的 autosave
      return {
        config: action.config,
        lastSavedAt: action.at,
      };
    }

    case "patch": {
      const next = action.updater(state.config);
      if (next === state.config) return state;
      return { ...state, config: next };
    }

    case "markSaved": {
      return { ...state, lastSavedAt: action.at };
    }
  }
}

export interface ConfigStateApi {
  config: AppConfig;
  lastSavedAt: number | null;

  load: (config: AppConfig) => void;
  patch: (updater: (prev: AppConfig) => AppConfig) => void;
  markSaved: (at: number) => void;

  /* 高阶帮助函数 */
  patchProfile: (activeProfile: number, patch: Partial<Profile>) => void;
  patchHotkey: (
    activeProfile: number,
    hotkeyIndex: number,
    patch: Partial<HotkeyConfig>,
  ) => void;
}

export function useConfigState(): ConfigStateApi {
  const [state, dispatch] = useReducer(reducer, initial);

  const load = useCallback(
    (config: AppConfig) => dispatch({ type: "load", config, at: Date.now() }),
    [],
  );

  const patch = useCallback(
    (updater: (prev: AppConfig) => AppConfig) =>
      dispatch({ type: "patch", updater }),
    [],
  );

  const markSaved = useCallback(
    (at: number) => dispatch({ type: "markSaved", at }),
    [],
  );

  const patchProfile = useCallback(
    (activeProfile: number, profilePatch: Partial<Profile>) => {
      if (activeProfile < 0) return;
      dispatch({
        type: "patch",
        updater: (c) => ({
          ...c,
          profiles: c.profiles.map((p, i) =>
            i === activeProfile ? { ...p, ...profilePatch } : p,
          ),
        }),
      });
    },
    [],
  );

  const patchHotkey = useCallback(
    (
      activeProfile: number,
      hotkeyIndex: number,
      hotkeyPatch: Partial<HotkeyConfig>,
    ) => {
      if (activeProfile < 0 || hotkeyIndex < 0) return;
      dispatch({
        type: "patch",
        updater: (c) => ({
          ...c,
          profiles: c.profiles.map((p, pi) =>
            pi === activeProfile
              ? {
                  ...p,
                  hotkeys: p.hotkeys.map((h, hi) =>
                    hi === hotkeyIndex ? { ...h, ...hotkeyPatch } : h,
                  ),
                }
              : p,
          ),
        }),
      });
    },
    [],
  );

  return {
    config: state.config,
    lastSavedAt: state.lastSavedAt,
    load,
    patch,
    markSaved,
    patchProfile,
    patchHotkey,
  };
}
