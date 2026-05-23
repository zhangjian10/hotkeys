import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, useId } from "@fluentui/react-components";

import {
  type HotkeyConfig,
  emptyHotkey,
  emptyProfile,
  loadConfig,
  revealConfig,
  saveConfig,
} from "./lib/api";
import { comboText, formatErr } from "./lib/utils";
import type { DraftMode } from "./types";
import { TOASTER_ID } from "./constants/app";
import { useStyles } from "./styles/useStyles";

/* hooks */
import { useConfigState } from "./hooks/useConfigState";
import { useFlash } from "./hooks/useFlash";
import { useTryInput } from "./hooks/useTryInput";
import { useRecorder } from "./hooks/useRecorder";
import {
  useActiveProfile,
  useDuplicateCombo,
  useEditingHotkey,
  useVisibleHotkeys,
} from "./hooks/useDerived";

/* components */
import { TitleBar } from "./components/TitleBar";
import { TopBar } from "./components/TopBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { NoProfilesEmpty } from "./components/NoProfilesEmpty";
import { HotkeysPage } from "./components/pages/HotkeysPage";
import { EditorDrawer } from "./components/EditorDrawer";
import { WindowPickerDialog } from "./components/WindowPickerDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CountdownDialog } from "./components/CountdownDialog";

interface ConfirmTask {
  label: string;
  apply: () => void;
}

/** autosave 防抖延迟。daemon 也以 500ms 防抖，整体最多 1s 内反映变更。 */
const SAVE_DEBOUNCE_MS = 500;

const APP_VERSION = "0.1.0";

export default function App() {
  const styles = useStyles();
  const toasterId = useId(TOASTER_ID);
  const flash = useFlash(toasterId);

  /* ------------------------- 数据/派生 ------------------------- */
  const cfg = useConfigState();
  const { config, lastSavedAt } = cfg;

  const [path, setPath] = useState("");
  const [activeProfile, setActiveProfile] = useState(-1);
  const [editingHotkey, setEditingHotkey] = useState(-1);
  const [hotkeyQuery, setHotkeyQuery] = useState("");
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTask | null>(null);

  const profile = useActiveProfile(config, activeProfile);
  const editing = useEditingHotkey(profile, editingHotkey);
  const duplicateCombo = useDuplicateCombo(profile, editing, editingHotkey);
  const visibleHotkeys = useVisibleHotkeys(profile, hotkeyQuery);

  /* ------------------------- 录制 ------------------------- */
  const recorder = useRecorder({
    flash,
    onCaptured: (combo) => {
      cfg.patchHotkey(activeProfile, editingHotkey, {
        modifier_key: combo.modifier,
        trigger_key: combo.trigger,
      });
    },
  });
  const { recording } = recorder;

  /* ------------------------- 初始加载 ------------------------- */
  useEffect(() => {
    void (async () => {
      try {
        const bundle = await loadConfig();
        cfg.load(bundle.config);
        setPath(bundle.path);
        setActiveProfile(bundle.config.profiles.length > 0 ? 0 : -1);
      } catch (e) {
        flash("error", `加载失败：${formatErr(e)}`);
      }
    })();
    // 仅初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- Autosave ------------------------- */
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastSavedAt === null) return; // 还没加载完，不要写盘
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void (async () => {
        try {
          await saveConfig(config);
          cfg.markSaved(Date.now());
        } catch (e) {
          flash("error", `自动保存失败：${formatErr(e)}`);
        }
      })();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  /* ------------------------- 试一下 ------------------------- */
  const tryInput = useTryInput({ flash });

  /* ------------------------- Profile 操作 ------------------------- */
  const selectProfile = useCallback((i: number) => {
    setActiveProfile(i);
    setEditingHotkey(-1);
  }, []);

  const createProfile = useCallback(
    (name: string, keyword: string) => {
      if (recording) {
        flash("info", "录制中，请先结束录制");
        return;
      }
      const cleanName = name.trim() || `配置 ${config.profiles.length + 1}`;
      const cleanKeyword = keyword.trim();
      const newIndex = config.profiles.length;
      const draft = emptyProfile(cleanName);
      if (cleanKeyword) {
        const final = cleanKeyword.includes("%")
          ? cleanKeyword
          : `%${cleanKeyword}%`;
        draft.window_keywords = [final];
      }
      cfg.patch((c) => ({ ...c, profiles: [...c.profiles, draft] }));
      setActiveProfile(newIndex);
    },
    [recording, config.profiles.length, cfg, flash],
  );

  const renameCurrentProfile = useCallback(
    (name: string) => {
      if (activeProfile < 0) return;
      cfg.patchProfile(activeProfile, { name });
    },
    [activeProfile, cfg],
  );

  const duplicateCurrentProfile = useCallback(() => {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    if (!profile) return;
    const newIndex = config.profiles.length;
    const copy = {
      ...profile,
      name: `${profile.name} 副本`,
      hotkeys: profile.hotkeys.map((h) => ({ ...h })),
      window_keywords: [...profile.window_keywords],
    };
    cfg.patch((c) => ({ ...c, profiles: [...c.profiles, copy] }));
    setActiveProfile(newIndex);
  }, [recording, profile, config.profiles.length, cfg, flash]);

  const deleteCurrentProfile = useCallback(() => {
    if (recording) {
      flash("info", "录制中暂不能删除配置");
      return;
    }
    if (config.profiles.length <= 1) {
      flash("info", "至少保留 1 个配置");
      return;
    }
    if (!profile) return;
    const idx = activeProfile;
    setConfirm({
      label: `要删除配置「${profile.name}」吗？该配置下的 ${profile.hotkeys.length} 条热键会一起被移除。此操作不可撤销。`,
      apply: () => {
        cfg.patch((c) => ({
          ...c,
          profiles: c.profiles.filter((_, i) => i !== idx),
        }));
        setActiveProfile((cur) => {
          if (cur === idx) return Math.max(0, idx - 1);
          if (cur > idx) return cur - 1;
          return cur;
        });
      },
    });
  }, [recording, profile, activeProfile, config.profiles.length, cfg, flash]);

  /* ------------------------- 关键词 ------------------------- */
  const addKeyword = useCallback(
    (value?: string, mode?: DraftMode) => {
      if (!profile) return;
      const v = (value ?? "").trim();
      if (!v) return;
      const m: DraftMode = mode ?? "fuzzy";
      const final = m === "fuzzy" && !v.includes("%") ? `%${v}%` : v;
      if (profile.window_keywords.includes(final)) {
        flash("info", "该关键词已存在");
        return;
      }
      cfg.patchProfile(activeProfile, {
        window_keywords: [...profile.window_keywords, final],
      });
    },
    [profile, cfg, activeProfile, flash],
  );

  const removeKeyword = useCallback(
    (idx: number) => {
      if (!profile) return;
      if (profile.window_keywords.length <= 1) {
        flash("info", "至少需要保留 1 个窗口关键词");
        return;
      }
      cfg.patchProfile(activeProfile, {
        window_keywords: profile.window_keywords.filter((_, i) => i !== idx),
      });
    },
    [profile, cfg, activeProfile, flash],
  );

  /* ------------------------- 热键 ------------------------- */
  const addHotkey = useCallback(() => {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    if (!profile) return;
    const newIndex = profile.hotkeys.length;
    cfg.patchProfile(activeProfile, {
      hotkeys: [...profile.hotkeys, emptyHotkey()],
    });
    setEditingHotkey(newIndex);
  }, [recording, profile, cfg, activeProfile, flash]);

  const deleteHotkey = useCallback(
    (i: number) => {
      if (recording) {
        flash("info", "录制中暂不能删除热键");
        return;
      }
      if (!profile) return;
      const target = profile.hotkeys[i];
      cfg.patchProfile(activeProfile, {
        hotkeys: profile.hotkeys.filter((_, idx) => idx !== i),
      });
      if (editingHotkey === i) setEditingHotkey(-1);
      else if (editingHotkey > i) setEditingHotkey((cur) => cur - 1);
      if (target) {
        flash("info", `已删除「${target.description || comboText(target)}」`);
      }
    },
    [recording, profile, cfg, activeProfile, editingHotkey, flash],
  );

  const patchEditing = useCallback(
    (patch: Partial<HotkeyConfig>) =>
      cfg.patchHotkey(activeProfile, editingHotkey, patch),
    [cfg, activeProfile, editingHotkey],
  );

  const closeDrawer = useCallback(() => {
    if (recording) recorder.stop();
    setEditingHotkey(-1);
  }, [recording, recorder]);

  /* ------------------------- 杂项 ------------------------- */
  const reveal = useCallback(() => {
    revealConfig().catch((e) => flash("error", formatErr(e)));
  }, [flash]);

  const onChangeInterval = useCallback(
    (v: number) => cfg.patchProfile(activeProfile, { auto_input_interval_secs: v }),
    [cfg, activeProfile],
  );
  const onChangeDelay = useCallback(
    (v: number) => cfg.patchProfile(activeProfile, { input_delay_millis: v }),
    [cfg, activeProfile],
  );

  /* ------------------------- 渲染 ------------------------- */
  return (
    <div className={styles.root}>
      <TitleBar title="GameMacro" />
      <TopBar
        profiles={config.profiles}
        activeProfile={activeProfile}
        onSelectProfile={selectProfile}
        onCreateProfile={createProfile}
        onRenameCurrent={renameCurrentProfile}
        onDuplicateCurrent={duplicateCurrentProfile}
        onDeleteCurrent={deleteCurrentProfile}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className={styles.body}>
        {profile ? (
          <div className={styles.scroll}>
            <div className={styles.scrollInner}>
              <HotkeysPage
                profile={profile}
                hotkeys={visibleHotkeys}
                total={profile.hotkeys.length}
                query={hotkeyQuery}
                recording={recording}
                onChangeQuery={setHotkeyQuery}
                onAdd={addHotkey}
                onEdit={setEditingHotkey}
                onDelete={deleteHotkey}
                onTry={tryInput.start}
                onGoWindow={() => setSettingsOpen(true)}
              />
            </div>
          </div>
        ) : (
          <NoProfilesEmpty
            onCreate={() => createProfile(`配置 1`, "")}
          />
        )}
      </div>

      <EditorDrawer
        open={!!editing}
        hotkey={editing}
        recording={recording}
        duplicate={duplicateCombo}
        onClose={closeDrawer}
        onChange={patchEditing}
        onToggleRecord={recorder.toggle}
        onTry={() => editing && tryInput.start(editing.input_string)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        configPath={path}
        appVersion={APP_VERSION}
        onChangeInterval={onChangeInterval}
        onChangeDelay={onChangeDelay}
        onAddKeyword={(value, mode) => addKeyword(value, mode)}
        onRemoveKeyword={removeKeyword}
        onPickWindow={() => setWindowPickerOpen(true)}
        onRevealConfig={reveal}
      />

      <WindowPickerDialog
        open={windowPickerOpen}
        onOpenChange={setWindowPickerOpen}
        onPick={(title) => {
          addKeyword(title);
          setWindowPickerOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        label={confirm?.label ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.apply();
          setConfirm(null);
        }}
      />

      <CountdownDialog
        open={!!tryInput.countdown}
        left={tryInput.countdown?.left ?? 0}
        onCancel={tryInput.cancel}
      />

      <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />
    </div>
  );
}
