import { useMemo } from "react";
import type { AppConfig, HotkeyConfig, Profile } from "../lib/api";
import { comboText } from "../lib/utils";

/** 视图层派生：当前激活 profile */
export function useActiveProfile(
  config: AppConfig,
  activeProfile: number,
): Profile | null {
  return useMemo(() => {
    if (activeProfile < 0 || activeProfile >= config.profiles.length) {
      return null;
    }
    return config.profiles[activeProfile] ?? null;
  }, [config.profiles, activeProfile]);
}

/** 按搜索词过滤后的热键列表 */
export function useVisibleHotkeys(
  profile: Profile | null,
  query: string,
): { hotkey: HotkeyConfig; index: number }[] {
  return useMemo(() => {
    if (!profile) return [];
    const q = query.trim().toLowerCase();
    return profile.hotkeys
      .map((hotkey, index) => ({ hotkey, index }))
      .filter(({ hotkey, index }) => {
        if (!q) return true;
        return (
          String(index + 1).includes(q) ||
          comboText(hotkey).toLowerCase().includes(q) ||
          (hotkey.description ?? "").toLowerCase().includes(q) ||
          hotkey.input_string.toLowerCase().includes(q)
        );
      });
  }, [profile, query]);
}
