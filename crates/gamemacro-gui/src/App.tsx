import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, useId } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  type HotkeyConfig,
  emptyHotkey,
  emptyProfile,
  loadConfig,
  revealConfig,
  revealLog,
  saveConfig,
} from "./lib/api";
import { comboText, formatErr } from "./lib/utils";
import { TOASTER_ID } from "./constants/app";
import { useStyles } from "./styles/useStyles";

/* hooks */
import { useConfigState } from "./hooks/useConfigState";
import { useFlash } from "./hooks/useFlash";
import { useTryInput } from "./hooks/useTryInput";
import { useRecorder } from "./hooks/useRecorder";
import { useEngineStatus } from "./hooks/useEngineStatus";
import {
  useActiveProfile,
  useVisibleHotkeys,
} from "./hooks/useDerived";

/* components */
import { TitleBar } from "./components/TitleBar";
import { TopBar } from "./components/TopBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { NoProfilesEmpty } from "./components/NoProfilesEmpty";
import { HotkeysPage } from "./components/pages/HotkeysPage";
import { WindowPickerDialog } from "./components/WindowPickerDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CountdownDialog } from "./components/CountdownDialog";
import { RecorderDialog } from "./components/RecorderDialog";

interface ConfirmTask {
  label: string;
  apply: () => void;
}

/** autosave 防抖延迟。engine 配置 watcher 也以 500ms 防抖，整体最多 1s 内反映变更。 */
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
  /** 当前内联展开编辑的热键 index；-1 表示全部折叠 */
  const [expandedHotkey, setExpandedHotkey] = useState(-1);
  /** 当前正在录制组合键的热键 index；-1 表示没有 */
  const [recordingTarget, setRecordingTarget] = useState(-1);
  const recordingTargetRef = useRef(-1);
  const [hotkeyQuery, setHotkeyQuery] = useState("");

  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTask | null>(null);

  const profile = useActiveProfile(config, activeProfile);
  const visibleHotkeys = useVisibleHotkeys(profile, hotkeyQuery);

  /* ------------------------- Engine 状态 / 控制 ------------------------- */
  const { status: engine, setEnabled: setEngineEnabledOptimistic } =
    useEngineStatus();
  const engineEnabledBeforeRecordingRef = useRef<boolean | null>(null);
  const restartingRecordingRef = useRef(false);

  const pauseEngineForRecording = useCallback(async () => {

    if (engineEnabledBeforeRecordingRef.current === null) {
      engineEnabledBeforeRecordingRef.current = engine?.enabled ?? true;
    }
    if (engineEnabledBeforeRecordingRef.current) {
      try {
        await setEngineEnabledOptimistic(false);
      } catch (e) {
        flash("error", formatErr(e));
      }
    }
  }, [engine?.enabled, flash, setEngineEnabledOptimistic]);


  const restoreEngineAfterRecording = useCallback(() => {
    const shouldRestore = engineEnabledBeforeRecordingRef.current;
    engineEnabledBeforeRecordingRef.current = null;
    if (shouldRestore) {
      void setEngineEnabledOptimistic(true).catch((e) =>
        flash("error", formatErr(e)),
      );
    }
  }, [flash, setEngineEnabledOptimistic]);

  /* ------------------------- 录制 ------------------------- */
  const recorder = useRecorder({
    flash,
    onCaptured: (combo) => {
      const idx = recordingTargetRef.current;
      if (idx >= 0) {
        cfg.patchHotkey(activeProfile, idx, {
          modifiers: combo.modifiers,
          trigger_key: combo.trigger,
        });
      }
    },
    onSettled: () => {
      if (restartingRecordingRef.current) {
        restartingRecordingRef.current = false;
        return;
      }
      restoreEngineAfterRecording();
      recordingTargetRef.current = -1;
      setRecordingTarget(-1);
    },

  });


  const { recording, pendingModifiers } = recorder;

  /* ------------------------- 初始加载 ------------------------- */
  useEffect(() => {
    let cancelled = false;
    let shown = false;

    const showWindow = () => {
      if (shown || cancelled) return;
      shown = true;
      // 双 rAF：等 React commit + 浏览器至少 paint 一次再露出窗口
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          const win = getCurrentWindow();
          void win.show();
          void win.setFocus();
        });
      });
    };

    // 兜底：无论 loadConfig 多慢，最迟 1500ms 后也要把窗口 show 出来
    const fallback = window.setTimeout(showWindow, 1500);

    void (async () => {
      try {
        const bundle = await loadConfig();
        if (cancelled) return;
        cfg.load(bundle.config);
        setPath(bundle.path);
        setActiveProfile(bundle.config.profiles.length > 0 ? 0 : -1);
      } catch (e) {
        if (!cancelled) flash("error", `加载失败：${formatErr(e)}`);
      } finally {
        showWindow();
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
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
    setExpandedHotkey(-1);
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
      setExpandedHotkey(-1);
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
    setExpandedHotkey(-1);
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
        setExpandedHotkey(-1);
      },
    });
  }, [recording, profile, activeProfile, config.profiles.length, cfg, flash]);

  /* ------------------------- 关键词 ------------------------- */
  /** 把一个窗口标题以模糊匹配（`%title%`）形式加进当前 profile。 */
  const addKeyword = useCallback(
    (title: string) => {
      if (!profile) return;
      const v = title.trim();
      if (!v) return;
      const final = v.includes("%") ? v : `%${v}%`;
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
    setExpandedHotkey(newIndex);
  }, [recording, profile, cfg, activeProfile, flash]);

  /** 折叠/展开切换；切到不同卡片时收起旧卡片，必要时停止当前录制 */
  const toggleExpandHotkey = useCallback(
    (i: number) => {
      if (recording && i !== expandedHotkey) {
        // 切到别的卡片要先停止录制
        recorder.stop();
        recordingTargetRef.current = -1;
        setRecordingTarget(-1);
      }

      setExpandedHotkey((cur) => (cur === i ? -1 : i));
    },
    [recording, expandedHotkey, recorder],
  );

  /** 点击 ComboBadge / 「重新录制」按钮：打开录制 Dialog 并启动录制器。
   *  再次点击时（recording=true）= 取消录制并关闭 Dialog。 */
  const toggleRecordHotkey = useCallback(
    async (i: number) => {
      if (recording && recordingTarget === i) {
        recorder.stop();
        return;
      }
      // 取消旧录制（如果在录别的）
      if (recording) {
        restartingRecordingRef.current = true;
        recorder.stop();
      }

      if (expandedHotkey !== i) setExpandedHotkey(i);
      recordingTargetRef.current = i;
      setRecordingTarget(i);
      await pauseEngineForRecording();
      recorder.start();
    },
    [
      recording,
      recordingTarget,
      recorder,
      expandedHotkey,
      pauseEngineForRecording,
    ],
  );

  /** Dialog 关闭按钮 / Esc 走这条路径 */

  const cancelRecording = useCallback(() => {
    recorder.stop();
    recordingTargetRef.current = -1;
    setRecordingTarget(-1);
  }, [recorder]);

  const patchHotkeyAt = useCallback(

    (i: number, patch: Partial<HotkeyConfig>) =>
      cfg.patchHotkey(activeProfile, i, patch),
    [cfg, activeProfile],
  );

  const duplicateHotkey = useCallback(
    (i: number) => {
      if (recording) {
        flash("info", "录制中暂不能复制热键");
        return;
      }
      if (!profile) return;
      const target = profile.hotkeys[i];
      if (!target) return;
      const copy = { ...target };
      cfg.patchProfile(activeProfile, {
        hotkeys: [
          ...profile.hotkeys.slice(0, i + 1),
          copy,
          ...profile.hotkeys.slice(i + 1),
        ],
      });
      setExpandedHotkey(i + 1);
    },
    [recording, profile, cfg, activeProfile, flash],
  );

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
      setExpandedHotkey((cur) => {
        if (cur === i) return -1;
        if (cur > i) return cur - 1;
        return cur;
      });
      if (target) {
        flash("info", `已删除「${target.description || comboText(target)}」`);
      }
    },
    [recording, profile, cfg, activeProfile, flash],
  );

  /* ------------------------- 杂项 ------------------------- */
  const reveal = useCallback(() => {
    revealConfig().catch((e) => flash("error", formatErr(e)));
  }, [flash]);


  /* ------------------------- Engine 控制 ------------------------- */
  const onRevealLog = useCallback(() => {

    void revealLog().catch((e) => flash("error", formatErr(e)));
  }, [flash]);
  const onSetEnabled = useCallback(
    (enabled: boolean) => {
      // hook 内部已做乐观更新 + 失败回滚；这里只负责把异常 toast 出去
      void setEngineEnabledOptimistic(enabled).catch((e) =>
        flash("error", formatErr(e)),
      );
    },
    [flash, setEngineEnabledOptimistic],
  );

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
        engine={engine}
        onSetEnabled={onSetEnabled}
        onRevealLog={onRevealLog}
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
                pendingModifiers={pendingModifiers}
                expandedIndex={expandedHotkey}
                onChangeQuery={setHotkeyQuery}
                onAdd={addHotkey}
                onToggleExpand={toggleExpandHotkey}
                onToggleRecord={toggleRecordHotkey}
                onChange={patchHotkeyAt}
                onTry={tryInput.start}
                onDuplicate={duplicateHotkey}
                onDelete={deleteHotkey}
                onGoWindow={() => setSettingsOpen(true)}
              />
            </div>
          </div>
        ) : (
          <NoProfilesEmpty onCreate={() => createProfile(`配置 1`, "")} />
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        configPath={path}
        appVersion={APP_VERSION}
        onChangeInterval={onChangeInterval}
        onChangeDelay={onChangeDelay}
        onRemoveKeyword={removeKeyword}
        onPickWindow={() => setWindowPickerOpen(true)}
        engineEnabled={engine?.enabled ?? true}
        onSetEngineEnabled={onSetEnabled}
        onRevealLog={onRevealLog}
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

      <RecorderDialog
        open={recordingTarget >= 0}
        pendingModifiers={pendingModifiers}
        current={
          recordingTarget >= 0 && profile?.hotkeys[recordingTarget]
            ? {
                modifiers: profile.hotkeys[recordingTarget].modifiers ?? [],
                trigger: profile.hotkeys[recordingTarget].trigger_key,
              }
            : null
        }
        onCancel={cancelRecording}
      />

      <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />
    </div>
  );
}
