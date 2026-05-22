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

/** 当前正在编辑的热键 */
export function useEditingHotkey(
  profile: Profile | null,
  editingIndex: number,
): HotkeyConfig | null {
  return useMemo(() => {
    if (!profile) return null;
    if (editingIndex < 0 || editingIndex >= profile.hotkeys.length) {
      return null;
    }
    return profile.hotkeys[editingIndex] ?? null;
  }, [profile, editingIndex]);
}

/** 编辑中的组合键是否与同 profile 内其它热键重复 */
export function useDuplicateCombo(
  profile: Profile | null,
  editing: HotkeyConfig | null,
  editingIndex: number,
): boolean {
  return useMemo(() => {
    if (!profile || !editing) return false;
    return profile.hotkeys.some(
      (h, i) =>
        i !== editingIndex &&
        h.modifier_key === editing.modifier_key &&
        h.trigger_key === editing.trigger_key,
    );
  }, [profile, editing, editingIndex]);
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
