import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  SpinButton,
  Subtitle1,
  Subtitle2,
  Tab,
  TabList,
  type TabValue,
  TagGroup,
  Textarea,
  Title2,
  ToggleButton,
  Toaster,
  Tooltip,
  makeStyles,
  tokens,
  useId,
  useToastController,
  Toast,
  ToastBody,
  ToastTitle,
  type SpinButtonOnChangeData,
} from "@fluentui/react-components";
import {
  Add20Regular,
  AppFolder20Regular,
  ArrowReset20Regular,
  Delete20Regular,
  Dismiss20Regular,
  FolderOpen20Regular,
  Keyboard20Regular,
  KeyboardLayoutFloat20Regular,
  MoreHorizontal20Regular,
  Record20Filled,
  Record20Regular,
  Save20Regular,
  Search20Regular,
  Timer20Regular,
  Window20Regular,
  WindowConsole20Regular,
} from "@fluentui/react-icons";
import {
  ALL_MODIFIERS,
  ALL_TRIGGERS,
  type AppConfig,
  type HotkeyConfig,
  type Profile,
  type WindowInfo,
  emptyConfig,
  emptyProfile,
  listWindows,
  loadConfig,
  revealConfig,
  saveConfig,
} from "./lib/api";
import { startRecording } from "./lib/recorder";

/* ============================================================================
 * 类型 & 常量
 * ========================================================================== */

type ToastKind = "info" | "error" | "success";
type SectionId = "hotkeys" | "window" | "timing";

interface NavItemDef {
  id: SectionId;
  title: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "hotkeys", title: "热键", icon: <Keyboard20Regular /> },
  { id: "window", title: "窗口匹配", icon: <Window20Regular /> },
  { id: "timing", title: "输入节奏", icon: <Timer20Regular /> },
];

/* ============================================================================
 * 样式
 * ========================================================================== */

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  /* ================= Sidebar：Profile 列表 + 设置子页签 ================= */
  sidebar: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    paddingTop: "16px",
    paddingInline: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  brand: {
    paddingInline: "8px",
    marginBottom: "16px",
  },
  /* 分组小标签 */
  navGroupLabel: {
    paddingInline: "12px",
    paddingBlock: "6px",
    color: tokens.colorNeutralForeground3,
    fontSize: "11.5px",
    fontWeight: tokens.fontWeightSemibold,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  /* Profile 单项 */
  profileItem: {
    appearance: "none",
    background: "transparent",
    border: "none",
    width: "100%",
    minHeight: "36px",
    paddingInline: "12px",
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    textAlign: "left",
    "&:hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorNeutralForeground1,
    },
  },
  profileItemActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    boxShadow: tokens.shadow2,
  },
  profileItemBox: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
  },
  profileItemMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  profileItemTitle: {
    fontSize: "13px",
    fontWeight: tokens.fontWeightMedium,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  profileItemMeta: {
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  /* 子页签 */
  navTabList: {
    rowGap: "2px",
    paddingTop: "8px",
  },
  navTab: {
    height: "36px",
    borderRadius: tokens.borderRadiusMedium,
    paddingInline: "12px",
  },
  sidebarFooter: {
    marginTop: "auto",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    rowGap: "4px",
  },
  pathBtn: {
    appearance: "none",
    background: "transparent",
    border: "none",
    width: "100%",
    paddingInline: "12px",
    paddingBlock: "8px",
    borderRadius: tokens.borderRadiusMedium,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
  },
  pathBtnText: {
    minWidth: 0,
    flex: 1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: "11.5px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  /* ================= 内容区 ================= */
  content: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
    borderTopLeftRadius: "8px",
    borderBottomLeftRadius: "8px",
    boxShadow: tokens.shadow4,
    margin: "8px 8px 8px 0",
  },

  /* dirty 时出现的吸顶提示条 */
  dirtyBar: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
    paddingInline: "20px",
    paddingBlock: "10px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  dirtyText: { flex: 1, minWidth: 0 },
  dirtyActions: { display: "flex", columnGap: "8px", flexShrink: 0 },

  /* Profile header：当前正在编辑的 profile 名 + 元信息 */
  profileHeader: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
    paddingInline: "36px",
    paddingTop: "20px",
    flexShrink: 0,
  },
  profileHeaderIcon: {
    width: "36px",
    height: "36px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  profileHeaderText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  profileHeaderTitle: {
    fontSize: "18px",
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  profileHeaderMeta: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },

  scroll: { flex: 1, minHeight: 0, overflowY: "auto" },
  scrollInner: {
    width: "100%",
    maxWidth: "1024px",
    paddingInline: "36px",
    paddingTop: "20px",
    paddingBottom: "48px",
    display: "flex",
    flexDirection: "column",
    rowGap: "20px",
  },

  pageHeader: {
    display: "flex",
    flexDirection: "column",
    rowGap: "4px",
    marginBottom: "8px",
  },
  pageSubtitle: { color: tokens.colorNeutralForeground3 },

  groupTitle: {
    paddingInline: "4px",
    marginBottom: "4px",
    color: tokens.colorNeutralForeground1,
  },

  group: { display: "flex", flexDirection: "column", rowGap: "8px" },
  groupCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "7px",
    overflow: "hidden",
  },

  row: {
    display: "flex",
    alignItems: "center",
    columnGap: "16px",
    minHeight: "56px",
    paddingInline: "16px",
    paddingBlock: "10px",
  },
  rowDivider: {
    height: "1px",
    backgroundColor: tokens.colorNeutralStroke3,
    marginInline: "16px",
  },
  rowIcon: {
    width: "24px",
    height: "24px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground2,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    rowGap: "2px",
  },
  rowLabel: {
    fontSize: "14px",
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "20px",
    color: tokens.colorNeutralForeground1,
  },
  rowDesc: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    lineHeight: "16px",
  },
  rowControl: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
  },

  tagGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    paddingInline: "16px",
    paddingBlock: "12px",
  },
  emptyTagHint: {
    paddingInline: "16px",
    paddingBlock: "16px",
    color: tokens.colorNeutralForeground3,
  },

  /* Hotkeys 列表行 */
  hkRow: {
    display: "flex",
    alignItems: "center",
    columnGap: "16px",
    minHeight: "64px",
    paddingInline: "16px",
    paddingBlock: "10px",
    cursor: "pointer",
    "&:hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  hkComboBox: {
    display: "flex",
    alignItems: "center",
    columnGap: "4px",
    width: "150px",
    flexShrink: 0,
  },
  hkInfo: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    rowGap: "2px",
  },
  hkInfoTitle: {
    fontSize: "14px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hkInfoPreview: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hkActions: { display: "flex", columnGap: "4px", flexShrink: 0 },
  hkSearch: {
    paddingInline: "16px",
    paddingTop: "12px",
    paddingBottom: "8px",
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
  },

  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    rowGap: "8px",
    paddingBlock: "48px",
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    rowGap: "12px",
    paddingInline: "36px",
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },

  drawerCombo: {
    display: "flex",
    flexDirection: "column",
    rowGap: "12px",
    paddingBlock: "8px",
  },
  drawerComboRow: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
  },

  keyChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "32px",
    height: "24px",
    paddingInline: "8px",
    borderRadius: "4px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: "12px",
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: 1,
  },
  keyChipTrigger: {
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    color: tokens.colorBrandForeground1,
  },
  keyPlus: { color: tokens.colorNeutralForeground3, fontSize: "12px" },

  /* 窗口选择对话框 */
  windowList: {
    maxHeight: "360px",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "6px",
  },
  windowItem: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
    paddingInline: "12px",
    paddingBlock: "10px",
    cursor: "pointer",
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    "&:hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    "&:last-child": { borderBottom: "none" },
  },
  windowItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    "&:hover": { backgroundColor: tokens.colorBrandBackground2Hover },
  },
  windowItemTitle: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
  },
});

/* ============================================================================
 * 主组件
 * ========================================================================== */

const TOASTER_ID = "app-toaster";

export default function App() {
  const styles = useStyles();
  const toasterId = useId(TOASTER_ID);
  const { dispatchToast } = useToastController(toasterId);

  const [config, setConfig] = useState<AppConfig>(emptyConfig);
  const [saved, setSaved] = useState<AppConfig>(emptyConfig);
  const [path, setPath] = useState("");
  const [activeProfile, setActiveProfile] = useState(0);
  const [section, setSection] = useState<SectionId>("hotkeys");
  const [editingHotkey, setEditingHotkey] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [hotkeyQuery, setHotkeyQuery] = useState("");
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);

  const cancelRecRef = useRef<(() => void) | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(saved),
    [config, saved],
  );

  const profile = useMemo<Profile | null>(() => {
    if (activeProfile < 0 || activeProfile >= config.profiles.length)
      return null;
    return config.profiles[activeProfile] ?? null;
  }, [config.profiles, activeProfile]);

  const editing = useMemo<HotkeyConfig | null>(() => {
    if (!profile) return null;
    if (editingHotkey < 0 || editingHotkey >= profile.hotkeys.length)
      return null;
    return profile.hotkeys[editingHotkey] ?? null;
  }, [profile, editingHotkey]);

  const duplicateCombo = useMemo(() => {
    if (!profile || !editing) return false;
    return profile.hotkeys.some(
      (h, i) =>
        i !== editingHotkey &&
        h.modifier_key === editing.modifier_key &&
        h.trigger_key === editing.trigger_key,
    );
  }, [profile, editing, editingHotkey]);

  const visibleHotkeys = useMemo(() => {
    if (!profile) return [];
    const q = hotkeyQuery.trim().toLowerCase();
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
  }, [profile, hotkeyQuery]);

  /* ---------------- Toast ---------------- */
  const flash = useCallback(
    (kind: ToastKind, text: string) => {
      dispatchToast(
        <Toast>
          <ToastTitle>{toastTitle(kind)}</ToastTitle>
          <ToastBody>{text}</ToastBody>
        </Toast>,
        { intent: kind, timeout: 2800 },
      );
    },
    [dispatchToast],
  );

  /* ---------------- 加载 ---------------- */
  useEffect(() => {
    void (async () => {
      try {
        const bundle = await loadConfig();
        setConfig(bundle.config);
        setSaved(structuredClone(bundle.config));
        setPath(bundle.path);
        setActiveProfile(bundle.config.profiles.length > 0 ? 0 : -1);
      } catch (e) {
        flash("error", `加载失败：${formatErr(e)}`);
      }
    })();
  }, [flash]);

  /* ---------------- 录制 ---------------- */
  const stopRecording = useCallback(() => {
    cancelRecRef.current?.();
    cancelRecRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => cancelRecRef.current?.(), []);

  /* ---------------- 保存 / 重置 ---------------- */
  const doSave = useCallback(async () => {
    try {
      await saveConfig(config);
      setSaved(structuredClone(config));
      flash("success", "已保存");
    } catch (e) {
      flash("error", `保存失败：${formatErr(e)}`);
    }
  }, [config, flash]);

  const doReset = useCallback(() => {
    stopRecording();
    setConfig(structuredClone(saved));
    setActiveProfile((cur) =>
      saved.profiles.length === 0
        ? -1
        : Math.min(Math.max(cur, 0), saved.profiles.length - 1),
    );
    flash("info", "已恢复到上次保存");
  }, [saved, stopRecording, flash]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (recording) return;
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recording, doSave]);

  /* ---------------- Profile 操作 ---------------- */
  function patchProfile(patch: Partial<Profile>) {
    if (activeProfile < 0) return;
    setConfig((c) => ({
      ...c,
      profiles: c.profiles.map((p, i) =>
        i === activeProfile ? { ...p, ...patch } : p,
      ),
    }));
  }

  function addProfile() {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    const name = `配置 ${config.profiles.length + 1}`;
    setConfig((c) => ({ ...c, profiles: [...c.profiles, emptyProfile(name)] }));
    setActiveProfile(config.profiles.length);
    setSection("window");
  }

  function removeProfile(idx: number) {
    if (recording) {
      flash("info", "录制中暂不能删除配置");
      return;
    }
    if (config.profiles.length <= 1) {
      flash("info", "至少保留 1 个配置");
      return;
    }
    setConfig((c) => ({
      ...c,
      profiles: c.profiles.filter((_, i) => i !== idx),
    }));
    setActiveProfile((cur) => {
      const newLen = config.profiles.length - 1;
      if (cur === idx) return Math.max(0, idx - 1);
      if (cur > idx) return cur - 1;
      return Math.min(cur, newLen - 1);
    });
  }

  function renameProfile(idx: number, name: string) {
    setConfig((c) => ({
      ...c,
      profiles: c.profiles.map((p, i) => (i === idx ? { ...p, name } : p)),
    }));
  }

  /* ---------------- 关键词 ---------------- */
  function addKeyword(value?: string) {
    const v = (value ?? keywordDraft).trim();
    if (!v) return;
    if (!profile) return;
    if (profile.window_keywords.includes(v)) {
      flash("info", "该关键词已存在");
      return;
    }
    patchProfile({ window_keywords: [...profile.window_keywords, v] });
    setKeywordDraft("");
  }

  function removeKeyword(idx: number) {
    if (!profile) return;
    if (profile.window_keywords.length <= 1) {
      flash("info", "至少需要保留 1 个窗口关键词");
      return;
    }
    patchProfile({
      window_keywords: profile.window_keywords.filter((_, i) => i !== idx),
    });
  }

  /* ---------------- 热键 ---------------- */
  function addHotkey() {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    if (!profile) return;
    const newIndex = profile.hotkeys.length;
    patchProfile({
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
  }

  function deleteHotkey(i: number) {
    if (recording) {
      flash("info", "录制中暂不能删除热键");
      return;
    }
    if (!profile) return;
    patchProfile({
      hotkeys: profile.hotkeys.filter((_, idx) => idx !== i),
    });
    if (editingHotkey === i) setEditingHotkey(-1);
    else if (editingHotkey > i) setEditingHotkey((cur) => cur - 1);
  }

  function patchEditing(patch: Partial<HotkeyConfig>) {
    if (!profile) return;
    patchProfile({
      hotkeys: profile.hotkeys.map((h, i) =>
        i === editingHotkey ? { ...h, ...patch } : h,
      ),
    });
  }

  function toggleRecord() {
    if (!profile) return;
    if (editingHotkey < 0) return;
    if (recording) {
      stopRecording();
      return;
    }
    setRecording(true);
    const targetProfileIdx = activeProfile;
    const targetIdx = editingHotkey;
    cancelRecRef.current = startRecording((res) => {
      setRecording(false);
      cancelRecRef.current = null;
      if (res.kind === "captured") {
        setConfig((c) => {
          const profiles = c.profiles.map((p, pi) => {
            if (pi !== targetProfileIdx) return p;
            return {
              ...p,
              hotkeys: p.hotkeys.map((h, hi) =>
                hi === targetIdx
                  ? {
                      ...h,
                      modifier_key: res.combo.modifier ?? "Ctrl",
                      trigger_key: res.combo.trigger,
                    }
                  : h,
              ),
            };
          });
          return { ...c, profiles };
        });
        flash("success", "组合键已录入");
      } else if (res.kind === "unsupported") {
        flash(
          "error",
          `不支持的按键：${res.raw}（请用字母 / 数字 / F1-F12 / 反引号）`,
        );
      }
    });
  }

  function closeDrawer() {
    if (recording) stopRecording();
    setEditingHotkey(-1);
  }

  const reveal = useCallback(() => {
    revealConfig().catch((e) => flash("error", formatErr(e)));
  }, [flash]);

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        <Sidebar
          styles={styles}
          profiles={config.profiles}
          activeProfile={activeProfile}
          section={section}
          path={path}
          onSelectProfile={(i) => {
            setActiveProfile(i);
            setEditingHotkey(-1);
          }}
          onAddProfile={addProfile}
          onRenameProfile={renameProfile}
          onRemoveProfile={removeProfile}
          onSelectSection={setSection}
          onReveal={reveal}
        />

        <div className={styles.content}>
          {dirty && (
            <DirtyBar
              styles={styles}
              recording={recording}
              onSave={() => void doSave()}
              onReset={doReset}
            />
          )}

          {profile ? (
            <>
              <ProfileHeader styles={styles} profile={profile} />
              <div className={styles.scroll}>
                <div className={styles.scrollInner}>
                  {section === "hotkeys" && (
                    <HotkeysPage
                      styles={styles}
                      hotkeys={visibleHotkeys}
                      total={profile.hotkeys.length}
                      query={hotkeyQuery}
                      recording={recording}
                      onChangeQuery={setHotkeyQuery}
                      onAdd={addHotkey}
                      onEdit={setEditingHotkey}
                      onDelete={deleteHotkey}
                    />
                  )}
                  {section === "window" && (
                    <WindowPage
                      styles={styles}
                      profile={profile}
                      draft={keywordDraft}
                      onChangeDraft={setKeywordDraft}
                      onAdd={addKeyword}
                      onRemove={removeKeyword}
                      onPickWindow={() => setWindowPickerOpen(true)}
                    />
                  )}
                  {section === "timing" && (
                    <TimingPage
                      styles={styles}
                      profile={profile}
                      onChangeInterval={(v) =>
                        patchProfile({ auto_input_interval_secs: v })
                      }
                      onChangeDelay={(v) =>
                        patchProfile({ input_delay_millis: v })
                      }
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <AppFolder20Regular style={{ fontSize: 28 }} />
              <Subtitle1>还没有任何配置</Subtitle1>
              <Caption1>
                点击左侧「+ 新建配置」创建一个，例如"魔兽争霸"或"真三国无双"。
              </Caption1>
              <Button appearance="primary" icon={<Add20Regular />} onClick={addProfile}>
                新建配置
              </Button>
            </div>
          )}
        </div>
      </div>

      <EditorDrawer
        styles={styles}
        open={!!editing}
        hotkey={editing}
        recording={recording}
        duplicate={duplicateCombo}
        onClose={closeDrawer}
        onChange={patchEditing}
        onToggleRecord={toggleRecord}
      />

      <WindowPickerDialog
        styles={styles}
        open={windowPickerOpen}
        onOpenChange={setWindowPickerOpen}
        onPick={(title) => {
          addKeyword(title);
          setWindowPickerOpen(false);
        }}
      />

      <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />
    </div>
  );
}

/* ============================================================================
 * Sidebar
 * ========================================================================== */

interface SectionProps {
  styles: ReturnType<typeof useStyles>;
}

function Sidebar({
  styles,
  profiles,
  activeProfile,
  section,
  path,
  onSelectProfile,
  onAddProfile,
  onRenameProfile,
  onRemoveProfile,
  onSelectSection,
  onReveal,
}: SectionProps & {
  profiles: Profile[];
  activeProfile: number;
  section: SectionId;
  path: string;
  onSelectProfile: (i: number) => void;
  onAddProfile: () => void;
  onRenameProfile: (i: number, name: string) => void;
  onRemoveProfile: (i: number) => void;
  onSelectSection: (id: SectionId) => void;
  onReveal: () => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Subtitle1 block>Hotkeys</Subtitle1>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          配置中心
        </Caption1>
      </div>

      <div className={styles.navGroupLabel}>
        <span>配置</span>
        <Tooltip content="新建配置" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Add20Regular />}
            onClick={onAddProfile}
            aria-label="新建配置"
          />
        </Tooltip>
      </div>

      {profiles.map((p, i) => (
        <ProfileItem
          key={i}
          styles={styles}
          profile={p}
          active={i === activeProfile}
          onSelect={() => onSelectProfile(i)}
          onRename={(name) => onRenameProfile(i, name)}
          onRemove={() => onRemoveProfile(i)}
        />
      ))}

      <div className={styles.navGroupLabel} style={{ marginTop: 12 }}>
        <span>设置</span>
      </div>
      <TabList
        vertical
        appearance="subtle"
        size="medium"
        className={styles.navTabList}
        selectedValue={section}
        onTabSelect={(_, d) => onSelectSection(d.value as SectionId)}
      >
        {NAV_ITEMS.map((item) => (
          <Tab
            key={item.id}
            value={item.id satisfies TabValue}
            icon={{ children: item.icon }}
            className={styles.navTab}
            disabled={activeProfile < 0}
          >
            {item.title}
          </Tab>
        ))}
      </TabList>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.pathBtn}
          onClick={onReveal}
          title="在文件管理器中显示"
        >
          <FolderOpen20Regular />
          <span className={styles.pathBtnText}>{path || "加载中…"}</span>
        </button>
      </div>
    </aside>
  );
}

function ProfileItem({
  styles,
  profile,
  active,
  onSelect,
  onRename,
  onRemove,
}: SectionProps & {
  profile: Profile;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(profile.name);

  useEffect(() => {
    if (!renaming) setDraft(profile.name);
  }, [profile.name, renaming]);

  const commit = () => {
    const name = draft.trim() || profile.name;
    if (name !== profile.name) onRename(name);
    setRenaming(false);
  };

  return (
    <div
      className={`${styles.profileItem} ${
        active ? styles.profileItemActive : ""
      }`}
      onClick={() => !renaming && onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (renaming) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.profileItemBox}>
        <AppFolder20Regular />
        <div className={styles.profileItemMain}>
          {renaming ? (
            <Input
              autoFocus
              size="small"
              value={draft}
              onChange={(_, d) => setDraft(d.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className={styles.profileItemTitle}>{profile.name}</span>
              <span className={styles.profileItemMeta}>
                {profile.hotkeys.length} 热键 · {profile.window_keywords.length}{" "}
                关键词
              </span>
            </>
          )}
        </div>
        {!renaming && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                size="small"
                icon={<MoreHorizontal20Regular />}
                aria-label="更多操作"
                onClick={(e) => e.stopPropagation()}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(true);
                  }}
                >
                  重命名
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  删除
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 顶部"未保存更改"吸顶提示条
 * ========================================================================== */

function DirtyBar({
  styles,
  recording,
  onSave,
  onReset,
}: SectionProps & {
  recording: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.dirtyBar}>
      <Badge
        appearance="filled"
        color={recording ? "danger" : "warning"}
        size="small"
      >
        {recording ? "录制中" : "有未保存的更改"}
      </Badge>
      <span className={styles.dirtyText}>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          按 Ctrl+S 保存配置，或者重置回上次保存的状态
        </Caption1>
      </span>
      <div className={styles.dirtyActions}>
        <Button
          icon={<ArrowReset20Regular />}
          appearance="subtle"
          onClick={onReset}
        >
          重置
        </Button>
        <Button icon={<Save20Regular />} appearance="primary" onClick={onSave}>
          保存
        </Button>
      </div>
    </div>
  );
}

/* ============================================================================
 * Profile header
 * ========================================================================== */

function ProfileHeader({
  styles,
  profile,
}: SectionProps & { profile: Profile }) {
  return (
    <div className={styles.profileHeader}>
      <div className={styles.profileHeaderIcon}>
        <AppFolder20Regular />
      </div>
      <div className={styles.profileHeaderText}>
        <span className={styles.profileHeaderTitle}>{profile.name}</span>
        <span className={styles.profileHeaderMeta}>
          {profile.window_keywords.length === 0
            ? "未设置窗口关键词"
            : `匹配窗口：${profile.window_keywords.join(" / ")}`}
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
 * Group / SettingRow
 * ========================================================================== */

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
  return (
    <header className={styles.pageHeader}>
      <Title2 as="h1" block>
        {title}
      </Title2>
      {subtitle && (
        <Body1 className={styles.pageSubtitle} block>
          {subtitle}
        </Body1>
      )}
    </header>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <section className={styles.group}>
      {title && (
        <Subtitle2 className={styles.groupTitle} as="h2">
          {title}
        </Subtitle2>
      )}
      <div className={styles.groupCard}>{children}</div>
    </section>
  );
}

function SettingRow({
  icon,
  label,
  desc,
  control,
  divider = true,
  rowStyle,
}: {
  icon?: ReactNode;
  label: ReactNode;
  desc?: ReactNode;
  control: ReactNode;
  divider?: boolean;
  rowStyle?: CSSProperties;
}) {
  const styles = useStyles();
  return (
    <>
      <div className={styles.row} style={rowStyle}>
        {icon && <span className={styles.rowIcon}>{icon}</span>}
        <div className={styles.rowMain}>
          <span className={styles.rowLabel}>{label}</span>
          {desc && <span className={styles.rowDesc}>{desc}</span>}
        </div>
        <div className={styles.rowControl}>{control}</div>
      </div>
      {divider && <div className={styles.rowDivider} />}
    </>
  );
}

/* ============================================================================
 * 热键页
 * ========================================================================== */

function HotkeysPage({
  styles,
  hotkeys,
  total,
  query,
  recording,
  onChangeQuery,
  onAdd,
  onEdit,
  onDelete,
}: SectionProps & {
  hotkeys: { hotkey: HotkeyConfig; index: number }[];
  total: number;
  query: string;
  recording: boolean;
  onChangeQuery: (v: string) => void;
  onAdd: () => void;
  onEdit: (i: number) => void;
  onDelete: (i: number) => void;
}) {
  return (
    <>
      <PageHeader
        title="热键"
        subtitle="管理当前配置下的全局组合键以及它们触发时自动输入的内容。"
      />

      <div className={styles.hkSearch}>
        <Input
          style={{ flex: 1 }}
          contentBefore={<Search20Regular />}
          placeholder="搜索组合键、描述或输入内容…"
          value={query}
          onChange={(_, d) => onChangeQuery(d.value)}
        />
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          disabled={recording}
          onClick={onAdd}
        >
          添加热键
        </Button>
      </div>

      <Group>
        {hotkeys.length === 0 ? (
          <div className={styles.empty}>
            <KeyboardLayoutFloat20Regular style={{ fontSize: 28 }} />
            <Subtitle2>
              {total === 0 ? "还没有热键" : "没有匹配的热键"}
            </Subtitle2>
            <Caption1>
              {total === 0
                ? "点击右上角「添加热键」创建第一条"
                : "尝试换一个关键词"}
            </Caption1>
          </div>
        ) : (
          hotkeys.map((item, idx) => (
            <div key={item.index}>
              {idx > 0 && <div className={styles.rowDivider} />}
              <HotkeyRow
                styles={styles}
                hotkey={item.hotkey}
                index={item.index}
                disabled={recording}
                onEdit={() => onEdit(item.index)}
                onDelete={() => onDelete(item.index)}
              />
            </div>
          ))
        )}
      </Group>
    </>
  );
}

function HotkeyRow({
  styles,
  hotkey,
  index,
  disabled,
  onEdit,
  onDelete,
}: SectionProps & {
  hotkey: HotkeyConfig;
  index: number;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={styles.hkRow}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onEdit()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <div className={styles.hkComboBox}>
        <KeyChip text={hotkey.modifier_key} />
        <span className={styles.keyPlus}>+</span>
        <KeyChip text={hotkey.trigger_key} variant="trigger" />
      </div>
      <div className={styles.hkInfo}>
        <span className={styles.hkInfoTitle}>
          {hotkey.description || "未命名热键"}
        </span>
        <span className={styles.hkInfoPreview}>
          {previewInput(hotkey.input_string)}
        </span>
      </div>
      <div className={styles.hkActions}>
        <Tooltip content="删除热键" relationship="label">
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            disabled={disabled}
            aria-label={`删除第 ${index + 1} 条热键`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
}

/* ============================================================================
 * 窗口匹配页
 * ========================================================================== */

function WindowPage({
  styles,
  profile,
  draft,
  onChangeDraft,
  onAdd,
  onRemove,
  onPickWindow,
}: SectionProps & {
  profile: Profile;
  draft: string;
  onChangeDraft: (v: string) => void;
  onAdd: (value?: string) => void;
  onRemove: (i: number) => void;
  onPickWindow: () => void;
}) {
  return (
    <>
      <PageHeader
        title="窗口匹配"
        subtitle={`只有当前活动窗口的标题包含「${profile.name}」配置下的任一关键词时，热键才会生效。`}
      />

      <Group title="新增关键词">
        <SettingRow
          icon={<Add20Regular />}
          label="手动输入"
          desc="按 Enter 或点击添加按钮添加新关键词。"
          control={
            <>
              <Input
                placeholder="例如：原神"
                value={draft}
                onChange={(_, d) => onChangeDraft(d.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                style={{ width: 200 }}
              />
              <Button appearance="secondary" onClick={() => onAdd()}>
                添加
              </Button>
            </>
          }
        />
        <SettingRow
          icon={<WindowConsole20Regular />}
          label="从当前窗口选择"
          desc="列出所有可见窗口，点选后使用窗口标题作为关键词。"
          divider={false}
          control={
            <Button
              appearance="secondary"
              icon={<Search20Regular />}
              onClick={onPickWindow}
            >
              选择窗口…
            </Button>
          }
        />
      </Group>

      <Group title={`已添加（${profile.window_keywords.length}）`}>
        {profile.window_keywords.length === 0 ? (
          <div className={styles.emptyTagHint}>
            <Caption1>
              还没有关键词。该配置不会被任何窗口激活。
            </Caption1>
          </div>
        ) : (
          <div className={styles.tagGroup}>
            <TagGroup
              onDismiss={(_, d) => {
                const idx = Number(d.value);
                if (Number.isFinite(idx)) onRemove(idx);
              }}
            >
              {profile.window_keywords.map((kw, i) => (
                <InteractionTag
                  key={`${kw}-${i}`}
                  value={String(i)}
                  shape="rounded"
                >
                  <InteractionTagPrimary>{kw}</InteractionTagPrimary>
                  <InteractionTagSecondary aria-label={`删除关键词 ${kw}`} />
                </InteractionTag>
              ))}
            </TagGroup>
          </div>
        )}
      </Group>
    </>
  );
}

/* ============================================================================
 * 输入节奏页
 * ========================================================================== */

function TimingPage({
  styles: _styles,
  profile,
  onChangeInterval,
  onChangeDelay,
}: SectionProps & {
  profile: Profile;
  onChangeInterval: (v: number) => void;
  onChangeDelay: (v: number) => void;
}) {
  const handleSpin =
    (setter: (v: number) => void, min: number) =>
    (_: unknown, data: SpinButtonOnChangeData) => {
      const value = data.value ?? Number(data.displayValue ?? min);
      if (Number.isFinite(value)) setter(Math.max(min, Math.floor(value)));
    };

  return (
    <>
      <PageHeader
        title="输入节奏"
        subtitle={`当前配置「${profile.name}」的自动重发频率与按键间隔。`}
      />

      <Group title="计时">
        <SettingRow
          icon={<Timer20Regular />}
          label="自动输入间隔"
          desc="持续按住热键时，每隔多少秒重发一次输入。"
          control={
            <SpinButton
              min={1}
              step={1}
              value={profile.auto_input_interval_secs}
              displayValue={`${profile.auto_input_interval_secs} 秒`}
              onChange={handleSpin(onChangeInterval, 1)}
            />
          }
        />
        <SettingRow
          icon={<Timer20Regular />}
          label="按键间延迟"
          desc="模拟每次按键之间的等待时间，越大越稳定，越小越快。"
          divider={false}
          control={
            <SpinButton
              min={0}
              step={5}
              value={profile.input_delay_millis}
              displayValue={`${profile.input_delay_millis} 毫秒`}
              onChange={handleSpin(onChangeDelay, 0)}
            />
          }
        />
      </Group>
    </>
  );
}

/* ============================================================================
 * 编辑抽屉
 * ========================================================================== */

function EditorDrawer({
  styles,
  open,
  hotkey,
  recording,
  duplicate,
  onClose,
  onChange,
  onToggleRecord,
}: SectionProps & {
  open: boolean;
  hotkey: HotkeyConfig | null;
  recording: boolean;
  duplicate: boolean;
  onClose: () => void;
  onChange: (patch: Partial<HotkeyConfig>) => void;
  onToggleRecord: () => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={(_, d) => !d.open && onClose()}
      position="end"
      separator
      size="medium"
      modalType="non-modal"
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              aria-label="关闭"
              onClick={onClose}
            />
          }
        >
          编辑热键
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody>
        {hotkey && (
          <div style={{ display: "flex", flexDirection: "column", rowGap: 20 }}>
            <div className={styles.drawerCombo}>
              <div className={styles.drawerComboRow}>
                <KeyChip text={hotkey.modifier_key} />
                <span className={styles.keyPlus}>+</span>
                <KeyChip text={hotkey.trigger_key} variant="trigger" />
                {duplicate && (
                  <Badge appearance="tint" color="warning" size="small">
                    与其它热键重复
                  </Badge>
                )}
              </div>
              <ToggleButton
                checked={recording}
                icon={recording ? <Record20Filled /> : <Record20Regular />}
                onClick={onToggleRecord}
              >
                {recording ? "按下组合键，Esc 取消" : "录制组合键"}
              </ToggleButton>
            </div>

            <Field label="修饰键" hint="修饰键 + 触发键 共同组成全局快捷键">
              <Dropdown
                value={hotkey.modifier_key}
                selectedOptions={[hotkey.modifier_key]}
                disabled={recording}
                onOptionSelect={(_, d) => {
                  if (d.optionValue)
                    onChange({ modifier_key: d.optionValue });
                }}
              >
                {ALL_MODIFIERS.map((m) => (
                  <Option key={m} value={m}>
                    {m}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            <Field label="触发键" hint="支持字母 / 数字 / F1–F12 / 反引号">
              <Dropdown
                value={hotkey.trigger_key}
                selectedOptions={[hotkey.trigger_key]}
                disabled={recording}
                onOptionSelect={(_, d) => {
                  if (d.optionValue) onChange({ trigger_key: d.optionValue });
                }}
              >
                {ALL_TRIGGERS.map((t) => (
                  <Option key={t} value={t}>
                    {t}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            <Field label="描述" hint="显示在热键列表中，建议写成动作名称">
              <Input
                value={hotkey.description ?? ""}
                disabled={recording}
                placeholder="例如：召唤刑天"
                onChange={(_, d) =>
                  onChange({ description: d.value || null })
                }
              />
            </Field>

            <Field
              label="输入内容"
              hint="支持多行；换行会按游戏内 Enter 处理。录制组合键时编辑区会临时锁定。"
            >
              <Textarea
                value={hotkey.input_string}
                disabled={recording}
                onChange={(_, d) => onChange({ input_string: d.value })}
                spellCheck={false}
                resize="vertical"
                style={{ minHeight: 220, fontFamily: tokens.fontFamilyMonospace }}
              />
            </Field>
          </div>
        )}
      </DrawerBody>
    </Drawer>
  );
}

/* ============================================================================
 * 窗口选择对话框
 * ========================================================================== */

function WindowPickerDialog({
  styles,
  open,
  onOpenChange,
  onPick,
}: SectionProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (title: string) => void;
}) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listWindows();
      setWindows(list);
      setSelected(list.length > 0 ? 0 : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFilter("");
      void refresh();
    }
  }, [open, refresh]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return windows;
    return windows.filter((w) => w.title.toLowerCase().includes(q));
  }, [windows, filter]);

  const submit = () => {
    if (selected === null) return;
    const w = filtered[selected];
    if (w) onPick(w.title);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      modalType="modal"
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>从当前窗口中选择</DialogTitle>
          <DialogContent
            style={{ display: "flex", flexDirection: "column", rowGap: 12 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                style={{ flex: 1 }}
                contentBefore={<Search20Regular />}
                placeholder="过滤窗口标题…"
                value={filter}
                onChange={(_, d) => setFilter(d.value)}
              />
              <Button
                appearance="secondary"
                onClick={() => void refresh()}
                disabled={loading}
              >
                刷新
              </Button>
            </div>

            <div className={styles.windowList}>
              {loading ? (
                <div className={styles.empty}>
                  <Caption1>正在枚举窗口…</Caption1>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                  <Caption1>没有匹配的窗口</Caption1>
                </div>
              ) : (
                filtered.map((w, i) => (
                  <div
                    key={`${w.hwnd}-${i}`}
                    className={`${styles.windowItem} ${
                      selected === i ? styles.windowItemActive : ""
                    }`}
                    onClick={() => setSelected(i)}
                    onDoubleClick={() => onPick(w.title)}
                    role="option"
                    aria-selected={selected === i}
                  >
                    <Window20Regular />
                    <span className={styles.windowItemTitle} title={w.title}>
                      {w.title}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              提示：将使用窗口标题作为关键词；如要支持多个版本，可以在添加后手动改成
              <code> %关键字% </code>形式以模糊匹配。
            </Caption1>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle">取消</Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={selected === null}
              onClick={submit}
            >
              使用此窗口标题
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/* ============================================================================
 * KeyChip
 * ========================================================================== */

function KeyChip({
  text,
  variant,
}: {
  text: string;
  variant?: "modifier" | "trigger";
}) {
  const styles = useStyles();
  return (
    <span
      className={`${styles.keyChip} ${
        variant === "trigger" ? styles.keyChipTrigger : ""
      }`}
    >
      {text}
    </span>
  );
}

/* ============================================================================
 * 工具
 * ========================================================================== */

function comboText(hotkey: HotkeyConfig): string {
  return `${hotkey.modifier_key}+${hotkey.trigger_key}`;
}

function previewInput(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "（无输入内容）";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function formatErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function toastTitle(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "成功";
    case "error":
      return "错误";
    default:
      return "提示";
  }
}
