import { useCallback, useReducer, useRef, useEffect } from "react";
import type { AppConfig, Profile, HotkeyConfig } from "../lib/api";
import { emptyConfig } from "../lib/api";
import { HISTORY_LIMIT } from "../constants/app";

/**
 * useConfigState
 *
 * 集中管理 config / saved / 撤销栈，使用 useReducer 让所有状态变更
 * 在一个 dispatch 路径里完成，避免分散的 setState 嵌套。
 */

interface State {
  config: AppConfig;
  saved: AppConfig;
  past: AppConfig[];
  future: AppConfig[];
}

type Action =
  | { type: "load"; config: AppConfig }
  | { type: "save"; config: AppConfig }
  | { type: "patch"; updater: (prev: AppConfig) => AppConfig }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset-all" }
  | { type: "reset-current"; activeProfile: number };

const EMPTY = emptyConfig();

const initial: State = {
  config: EMPTY,
  saved: EMPTY,
  past: [],
  future: [],
};

function pushPast(past: AppConfig[], item: AppConfig): AppConfig[] {
  // 保留最多 HISTORY_LIMIT 条
  const next = past.length >= HISTORY_LIMIT ? past.slice(1) : past;
  return [...next, item];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load": {
      // 让 config 与 saved 共享同一引用，使 dirty(引用比较) 起步为 false
      return {
        config: action.config,
        saved: action.config,
        past: [],
        future: [],
      };
    }

    case "save": {
      // 保存后让 saved 指向 config 同一引用，dirty 立即变 false
      return { ...state, saved: action.config };
    }

    case "patch": {
      const next = action.updater(state.config);
      if (next === state.config) return state;
      return {
        ...state,
        config: next,
        past: pushPast(state.past, state.config),
        future: [],
      };
    }

    case "undo": {
      const last = state.past[state.past.length - 1];
      if (!last) return state;
      return {
        ...state,
        config: last,
        past: state.past.slice(0, -1),
        future: [...state.future, state.config],
      };
    }

    case "redo": {
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return {
        ...state,
        config: next,
        past: [...state.past, state.config],
        future: state.future.slice(0, -1),
      };
    }

    case "reset-all": {
      if (state.config === state.saved) return state;
      return {
        ...state,
        config: state.saved,
        past: [],
        future: [],
      };
    }

    case "reset-current": {
      const savedProfile = state.saved.profiles[action.activeProfile];
      if (!savedProfile) return state;
      const next: AppConfig = {
        ...state.config,
        profiles: state.config.profiles.map((p, i) =>
          i === action.activeProfile ? savedProfile : p,
        ),
      };
      if (next === state.config) return state;
      return {
        ...state,
        config: next,
        past: pushPast(state.past, state.config),
        future: [],
      };
    }
  }
}

export interface ConfigStateApi {
  config: AppConfig;
  saved: AppConfig;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  load: (config: AppConfig) => void;
  markSaved: () => void;
  patch: (updater: (prev: AppConfig) => AppConfig) => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
  resetCurrent: (activeProfile: number) => void;

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

  // 同步 ref 用于 markSaved 时拿最新 config（避免闭包陷阱）
  const configRef = useRef(state.config);
  useEffect(() => {
    configRef.current = state.config;
  }, [state.config]);

  const load = useCallback(
    (config: AppConfig) => dispatch({ type: "load", config }),
    [],
  );

  const markSaved = useCallback(
    () => dispatch({ type: "save", config: configRef.current }),
    [],
  );

  const patch = useCallback(
    (updater: (prev: AppConfig) => AppConfig) =>
      dispatch({ type: "patch", updater }),
    [],
  );

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const resetAll = useCallback(() => dispatch({ type: "reset-all" }), []);
  const resetCurrent = useCallback(
    (activeProfile: number) =>
      dispatch({ type: "reset-current", activeProfile }),
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
    saved: state.saved,
    dirty: state.config !== state.saved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    load,
    markSaved,
    patch,
    undo,
    redo,
    resetAll,
    resetCurrent,
    patchProfile,
    patchHotkey,
  };
}
