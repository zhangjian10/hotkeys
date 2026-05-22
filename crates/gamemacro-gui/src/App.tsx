import { useCallback, useEffect, useState } from "react";
import { Toaster, useId } from "@fluentui/react-components";

import {
  type HotkeyConfig,
  type Profile,
  emptyProfile,
  loadConfig,
  revealConfig,
  saveConfig,
} from "./lib/api";
import { comboText, formatErr } from "./lib/utils";
import type { DraftMode, SectionId } from "./types";
import { TOASTER_ID } from "./constants/app";
import { useStyles } from "./styles/useStyles";

/* hooks */
import { useConfigState } from "./hooks/useConfigState";
import { useFlash } from "./hooks/useFlash";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useForegroundTitle } from "./hooks/useForegroundTitle";
import { useTryInput } from "./hooks/useTryInput";
import { useRecorder } from "./hooks/useRecorder";
import {
  useActiveProfile,
  useDuplicateCombo,
  useEditingHotkey,
  useVisibleHotkeys,
} from "./hooks/useDerived";

/* components */
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { DirtyBar } from "./components/DirtyBar";
import { ProfileHeader } from "./components/ProfileHeader";
import { NoProfilesEmpty } from "./components/NoProfilesEmpty";
import { HotkeysPage } from "./components/pages/HotkeysPage";
import { WindowPage } from "./components/pages/WindowPage";
import { TimingPage } from "./components/pages/TimingPage";
import { EditorDrawer } from "./components/EditorDrawer";
import { WindowPickerDialog } from "./components/WindowPickerDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CountdownDialog } from "./components/CountdownDialog";

interface ConfirmTask {
  label: string;
  apply: () => void;
}

export default function App() {
  const styles = useStyles();
  const toasterId = useId(TOASTER_ID);
  const flash = useFlash(toasterId);

  /* ------------------------- 数据/派生 ------------------------- */
  const cfg = useConfigState();
  const { config, saved, dirty, canUndo, canRedo } = cfg;

  const [path, setPath] = useState("");
  const [activeProfile, setActiveProfile] = useState(-1);
  const [section, setSection] = useState<SectionId>("hotkeys");
  const [editingHotkey, setEditingHotkey] = useState(-1);
  const [hotkeyQuery, setHotkeyQuery] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [draftMode, setDraftMode] = useState<DraftMode>("fuzzy");
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTask | null>(null);

  const profile = useActiveProfile(config, activeProfile);
  const editing = useEditingHotkey(profile, editingHotkey);
  const duplicateCombo = useDuplicateCombo(profile, editing, editingHotkey);
  const visibleHotkeys = useVisibleHotkeys(profile, hotkeyQuery);

  const foreground = useForegroundTitle(section === "window");

  /* ------------------------- 录制 ------------------------- */
  // 用 ref 风格捕获回调，避免每次 editing 变都重建 useRecorder
  const recorder = useRecorder({
    flash,
    onCaptured: (combo) => {
      // 录制完成时把组合键写入 *当前* editing 位置
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

  /* ------------------------- 保存 / 重置 ------------------------- */
  const doSave = useCallback(async () => {
    try {
      await saveConfig(config);
      cfg.markSaved();
      flash("success", "已保存");
    } catch (e) {
      flash("error", `保存失败：${formatErr(e)}`);
    }
  }, [config, cfg, flash]);

  const doResetAll = useCallback(() => {
    recorder.stop();
    cfg.resetAll();
    setActiveProfile((cur) =>
      saved.profiles.length === 0
        ? -1
        : Math.min(Math.max(cur, 0), saved.profiles.length - 1),
    );
    flash("info", "已恢复到上次保存");
  }, [recorder, cfg, saved.profiles.length, flash]);

  const doResetCurrentPage = useCallback(() => {
    if (activeProfile < 0) return;
    if (!saved.profiles[activeProfile]) {
      flash("info", "当前配置在上次保存里不存在，请用「全部重置」");
      return;
    }
    cfg.resetCurrent(activeProfile);
    flash("info", "当前配置已恢复");
  }, [activeProfile, saved, cfg, flash]);

  /* ------------------------- 全局快捷键 ------------------------- */
  useGlobalShortcuts({
    enabled: !recording,
    onSave: () => void doSave(),
    onUndo: cfg.undo,
    onRedo: cfg.redo,
  });

  /* ------------------------- 试一下 ------------------------- */
  const tryInput = useTryInput({ flash });

  /* ------------------------- Profile 操作 ------------------------- */
  const selectProfile = useCallback((i: number) => {
    setActiveProfile(i);
    setEditingHotkey(-1);
  }, []);

  const addProfile = useCallback(() => {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    const name = `配置 ${config.profiles.length + 1}`;
    const newIndex = config.profiles.length;
    cfg.patch((c) => ({ ...c, profiles: [...c.profiles, emptyProfile(name)] }));
    setActiveProfile(newIndex);
    setSection("window");
  }, [recording, config.profiles.length, cfg, flash]);

  const renameProfile = useCallback(
    (idx: number, name: string) =>
      cfg.patch((c) => ({
        ...c,
        profiles: c.profiles.map((p, i) => (i === idx ? { ...p, name } : p)),
      })),
    [cfg],
  );

  const requestRemoveProfile = useCallback(
    (idx: number) => {
      if (recording) {
        flash("info", "录制中暂不能删除配置");
        return;
      }
      if (config.profiles.length <= 1) {
        flash("info", "至少保留 1 个配置");
        return;
      }
      const target = config.profiles[idx];
      if (!target) return;
      setConfirm({
        label: `要删除配置「${target.name}」吗？该配置下的 ${target.hotkeys.length} 条热键会一起被移除。删除后仍可用 Ctrl+Z 撤销。`,
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
    },
    [recording, config.profiles, cfg, flash],
  );

  /* ------------------------- 关键词 ------------------------- */
  const addKeyword = useCallback(
    (value?: string, mode?: DraftMode) => {
      if (!profile) return;
      const v = (value ?? keywordDraft).trim();
      if (!v) return;
      const m = mode ?? draftMode;
      const final = m === "fuzzy" && !v.includes("%") ? `%${v}%` : v;
      if (profile.window_keywords.includes(final)) {
        flash("info", "该关键词已存在");
        return;
      }
      cfg.patchProfile(activeProfile, {
        window_keywords: [...profile.window_keywords, final],
      });
      setKeywordDraft("");
    },
    [profile, keywordDraft, draftMode, cfg, activeProfile, flash],
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
      hotkeys: [
        ...profile.hotkeys,
        {
          modifier_key: "Ctrl",
          trigger_key: "A",
          input_string: "",
          description: null,
        },
      ],
    });
    setSection("hotkeys");
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
        flash(
          "info",
          `已删除「${target.description || comboText(target)}」，按 Ctrl+Z 可撤销`,
        );
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
      <div className={styles.body}>
        <Sidebar
          profiles={config.profiles}
          activeProfile={activeProfile}
          section={section}
          path={path}
          onSelectProfile={selectProfile}
          onAddProfile={addProfile}
          onRenameProfile={renameProfile}
          onRemoveProfile={requestRemoveProfile}
          onSelectSection={setSection}
          onReveal={reveal}
        />

        <div className={styles.content}>
          {dirty && (
            <DirtyBar
              recording={recording}
              canUndo={canUndo}
              canRedo={canRedo}
              onSave={() => void doSave()}
              onResetAll={doResetAll}
              onResetPage={doResetCurrentPage}
              onUndo={cfg.undo}
              onRedo={cfg.redo}
            />
          )}

          {profile ? (
            <Content
              profile={profile}
              section={section}
              recording={recording}
              hotkeyQuery={hotkeyQuery}
              visibleHotkeys={visibleHotkeys}
              foreground={foreground}
              keywordDraft={keywordDraft}
              draftMode={draftMode}
              onChangeQuery={setHotkeyQuery}
              onAddHotkey={addHotkey}
              onEditHotkey={setEditingHotkey}
              onDeleteHotkey={deleteHotkey}
              onTryHotkey={tryInput.start}
              onGoWindow={() => setSection("window")}
              onChangeKeywordDraft={setKeywordDraft}
              onChangeDraftMode={setDraftMode}
              onAddKeyword={addKeyword}
              onAddForegroundKeyword={() => {
                if (foreground) addKeyword(foreground, "fuzzy");
              }}
              onRemoveKeyword={removeKeyword}
              onPickWindow={() => setWindowPickerOpen(true)}
              onChangeInterval={onChangeInterval}
              onChangeDelay={onChangeDelay}
            />
          ) : (
            <NoProfilesEmpty onCreate={addProfile} />
          )}
        </div>
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

/* ============================================================================
 * Content：根据 section 渲染对应页
 * ========================================================================== */

interface ContentProps {
  profile: Profile;
  section: SectionId;
  recording: boolean;
  hotkeyQuery: string;
  visibleHotkeys: { hotkey: HotkeyConfig; index: number }[];
  foreground: string;
  keywordDraft: string;
  draftMode: DraftMode;
  onChangeQuery: (v: string) => void;
  onAddHotkey: () => void;
  onEditHotkey: (i: number) => void;
  onDeleteHotkey: (i: number) => void;
  onTryHotkey: (text: string) => void;
  onGoWindow: () => void;
  onChangeKeywordDraft: (v: string) => void;
  onChangeDraftMode: (m: DraftMode) => void;
  onAddKeyword: (value?: string, mode?: DraftMode) => void;
  onAddForegroundKeyword: () => void;
  onRemoveKeyword: (i: number) => void;
  onPickWindow: () => void;
  onChangeInterval: (v: number) => void;
  onChangeDelay: (v: number) => void;
}

function Content({
  profile,
  section,
  recording,
  hotkeyQuery,
  visibleHotkeys,
  foreground,
  keywordDraft,
  draftMode,
  onChangeQuery,
  onAddHotkey,
  onEditHotkey,
  onDeleteHotkey,
  onTryHotkey,
  onGoWindow,
  onChangeKeywordDraft,
  onChangeDraftMode,
  onAddKeyword,
  onAddForegroundKeyword,
  onRemoveKeyword,
  onPickWindow,
  onChangeInterval,
  onChangeDelay,
}: ContentProps) {
  const styles = useStyles();
  return (
    <>
      <ProfileHeader profile={profile} />
      <div className={styles.scroll}>
        <div className={styles.scrollInner}>
          {section === "hotkeys" && (
            <HotkeysPage
              profile={profile}
              hotkeys={visibleHotkeys}
              total={profile.hotkeys.length}
              query={hotkeyQuery}
              recording={recording}
              onChangeQuery={onChangeQuery}
              onAdd={onAddHotkey}
              onEdit={onEditHotkey}
              onDelete={onDeleteHotkey}
              onTry={onTryHotkey}
              onGoWindow={onGoWindow}
            />
          )}
          {section === "window" && (
            <WindowPage
              profile={profile}
              draft={keywordDraft}
              draftMode={draftMode}
              foreground={foreground}
              onChangeDraft={onChangeKeywordDraft}
              onChangeMode={onChangeDraftMode}
              onAdd={onAddKeyword}
              onAddForeground={onAddForegroundKeyword}
              onRemove={onRemoveKeyword}
              onPickWindow={onPickWindow}
            />
          )}
          {section === "timing" && (
            <TimingPage
              profile={profile}
              onChangeInterval={onChangeInterval}
              onChangeDelay={onChangeDelay}
            />
          )}
        </div>
      </div>
    </>
  );
}
