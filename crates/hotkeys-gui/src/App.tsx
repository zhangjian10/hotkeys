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
  Option,
  SpinButton,
  Subtitle1,
  Subtitle2,
  TabList,
  Tab,
  type TabValue,
  TagGroup,
  Text,
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
  ArrowReset20Regular,
  Delete20Regular,
  Dismiss20Regular,
  FolderOpen20Regular,
  Keyboard20Regular,
  KeyboardLayoutFloat20Regular,
  Record20Filled,
  Record20Regular,
  Save20Regular,
  Search20Regular,
  Timer20Regular,
  Window20Regular,
} from "@fluentui/react-icons";
import {
  ALL_MODIFIERS,
  ALL_TRIGGERS,
  type AppConfig,
  type HotkeyConfig,
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

function emptyConfig(): AppConfig {
  return {
    window_keywords: [],
    hotkeys: [],
    auto_input_interval_secs: 3,
    input_delay_millis: 50,
  };
}

/* ============================================================================
 * 样式（按 Win11 设置规范：Body 13px / Title 28px、行高 56、组圆角 7、padding 36/24）
 * ========================================================================== */

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },

  /* 主体：左导航 + 右内容 */
  body: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  /* ================= 左导航 ================= */
  sidebar: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    paddingTop: "16px",
    paddingInline: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  sidebarSearch: {
    paddingInline: "8px",
    paddingBottom: "12px",
  },
  navTabList: {
    rowGap: "2px",
  },
  /* Win11 NavigationView item: 36px 高、icon 20px、左指示条 3×16px */
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

  /* ================= 右内容区 ================= */
  content: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
    /* Win11 设置: 整个内容区有自己的圆角和阴影感 */
    borderTopLeftRadius: "8px",
    borderBottomLeftRadius: "8px",
    boxShadow: tokens.shadow4,
    margin: "8px 8px 8px 0",
    overflowY: "hidden",
  },

  /* dirty 时出现的"未保存更改"提示条，吸顶 */
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
  dirtyText: {
    flex: 1,
    minWidth: 0,
  },
  dirtyActions: {
    display: "flex",
    columnGap: "8px",
    flexShrink: 0,
  },

  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  },
  scrollInner: {
    width: "100%",
    maxWidth: "1024px",
    paddingInline: "36px",
    paddingTop: "32px",
    paddingBottom: "48px",
    display: "flex",
    flexDirection: "column",
    rowGap: "20px",
  },

  /* PageHeader: Win11 是 Title2 (28px) + 描述 14px / Caption */
  pageHeader: {
    display: "flex",
    flexDirection: "column",
    rowGap: "4px",
    marginBottom: "8px",
  },
  pageSubtitle: {
    color: tokens.colorNeutralForeground3,
  },

  /* 组标题：Win11 用 14/600，不是大写 */
  groupTitle: {
    paddingInline: "4px",
    marginBottom: "4px",
    color: tokens.colorNeutralForeground1,
  },

  /* 设置组：纯白圆角卡片，行间用极浅 divider */
  group: {
    display: "flex",
    flexDirection: "column",
    rowGap: "8px",
  },
  groupCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "7px",
    overflow: "hidden",
  },

  /* 设置行：Win11 风 56px 高、左 icon、中文字、右控件 */
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

  /* 标签云 */
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

  /* ================= Hotkeys 列表行 ================= */
  /* 单行展开式（取代 split）：每条热键独占一行 */
  hkRow: {
    display: "flex",
    alignItems: "center",
    columnGap: "16px",
    minHeight: "64px",
    paddingInline: "16px",
    paddingBlock: "10px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
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
  hkActions: {
    display: "flex",
    columnGap: "4px",
    flexShrink: 0,
  },

  /* 列表上方搜索条 */
  hkSearch: {
    paddingInline: "16px",
    paddingTop: "12px",
    paddingBottom: "8px",
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
  },

  /* 空状态 */
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

  /* ================= 编辑抽屉 ================= */
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

  /* ================= 键帽 ================= */
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
  keyPlus: {
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
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
  const [section, setSection] = useState<SectionId>("hotkeys");
  const [editingHotkey, setEditingHotkey] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [hotkeyQuery, setHotkeyQuery] = useState("");

  const cancelRecRef = useRef<(() => void) | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(saved),
    [config, saved],
  );

  const editing = useMemo<HotkeyConfig | null>(() => {
    if (editingHotkey < 0 || editingHotkey >= config.hotkeys.length) return null;
    return config.hotkeys[editingHotkey] ?? null;
  }, [config.hotkeys, editingHotkey]);

  const duplicateCombo = useMemo(() => {
    if (!editing) return false;
    return config.hotkeys.some(
      (h, i) =>
        i !== editingHotkey &&
        h.modifier_key === editing.modifier_key &&
        h.trigger_key === editing.trigger_key,
    );
  }, [config.hotkeys, editing, editingHotkey]);

  const visibleHotkeys = useMemo(() => {
    const q = hotkeyQuery.trim().toLowerCase();
    return config.hotkeys
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
  }, [config.hotkeys, hotkeyQuery]);

  /* ---------------- toast ---------------- */
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
    flash("info", "已恢复到上次保存");
  }, [saved, stopRecording, flash]);

  /* Ctrl+S */
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

  /* ---------------- 关键词 ---------------- */
  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v) return;
    if (config.window_keywords.includes(v)) {
      flash("info", "该关键词已存在");
      return;
    }
    setConfig((c) => ({ ...c, window_keywords: [...c.window_keywords, v] }));
    setKeywordDraft("");
  }

  function removeKeyword(idx: number) {
    if (config.window_keywords.length <= 1) {
      flash("info", "至少需要保留 1 个窗口关键词");
      return;
    }
    setConfig((c) => ({
      ...c,
      window_keywords: c.window_keywords.filter((_, i) => i !== idx),
    }));
  }

  /* ---------------- 热键 ---------------- */
  function addHotkey() {
    if (recording) {
      flash("info", "录制中，请先结束录制");
      return;
    }
    const newIndex = config.hotkeys.length;
    setConfig((c) => ({
      ...c,
      hotkeys: [
        ...c.hotkeys,
        {
          modifier_key: "Ctrl",
          trigger_key: "A",
          input_string: "",
          description: null,
        },
      ],
    }));
    setSection("hotkeys");
    setEditingHotkey(newIndex);
  }

  function deleteHotkey(i: number) {
    if (recording) {
      flash("info", "录制中暂不能删除热键");
      return;
    }
    setConfig((c) => ({
      ...c,
      hotkeys: c.hotkeys.filter((_, idx) => idx !== i),
    }));
    if (editingHotkey === i) setEditingHotkey(-1);
    else if (editingHotkey > i) setEditingHotkey((cur) => cur - 1);
  }

  function patchEditing(patch: Partial<HotkeyConfig>) {
    setConfig((c) => ({
      ...c,
      hotkeys: c.hotkeys.map((h, i) =>
        i === editingHotkey ? { ...h, ...patch } : h,
      ),
    }));
  }

  function toggleRecord() {
    if (editingHotkey < 0) return;
    if (recording) {
      stopRecording();
      return;
    }
    setRecording(true);
    const target = editingHotkey;
    cancelRecRef.current = startRecording((res) => {
      setRecording(false);
      cancelRecRef.current = null;
      if (res.kind === "captured") {
        setConfig((c) => {
          if (target >= c.hotkeys.length) return c;
          return {
            ...c,
            hotkeys: c.hotkeys.map((h, i) =>
              i === target
                ? {
                    ...h,
                    modifier_key: res.combo.modifier ?? "Ctrl",
                    trigger_key: res.combo.trigger,
                  }
                : h,
            ),
          };
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
          current={section}
          path={path}
          onSelect={setSection}
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

          <div className={styles.scroll}>
            <div className={styles.scrollInner}>
              {section === "hotkeys" && (
                <HotkeysPage
                  styles={styles}
                  hotkeys={visibleHotkeys}
                  total={config.hotkeys.length}
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
                  keywords={config.window_keywords}
                  draft={keywordDraft}
                  onChangeDraft={setKeywordDraft}
                  onAdd={addKeyword}
                  onRemove={removeKeyword}
                />
              )}

              {section === "timing" && (
                <TimingPage
                  styles={styles}
                  config={config}
                  onChangeInterval={(v) =>
                    setConfig((c) => ({ ...c, auto_input_interval_secs: v }))
                  }
                  onChangeDelay={(v) =>
                    setConfig((c) => ({ ...c, input_delay_millis: v }))
                  }
                />
              )}
            </div>
          </div>
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

      <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />
    </div>
  );
}

/* ============================================================================
 * 左侧 NavigationView
 * ========================================================================== */

interface SectionProps {
  styles: ReturnType<typeof useStyles>;
}

function Sidebar({
  styles,
  current,
  path,
  onSelect,
  onReveal,
}: SectionProps & {
  current: SectionId;
  path: string;
  onSelect: (id: SectionId) => void;
  onReveal: () => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarSearch}>
        <Subtitle1 style={{ paddingInline: 4, marginBottom: 4 }} block>
          Hotkeys
        </Subtitle1>
        <Caption1
          style={{ paddingInline: 4, color: tokens.colorNeutralForeground3 }}
        >
          配置中心
        </Caption1>
      </div>

      <TabList
        vertical
        appearance="subtle"
        size="medium"
        className={styles.navTabList}
        selectedValue={current}
        onTabSelect={(_, d) => onSelect(d.value as SectionId)}
      >
        {NAV_ITEMS.map((item) => (
          <Tab
            key={item.id}
            value={item.id satisfies TabValue}
            icon={{ children: item.icon }}
            className={styles.navTab}
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
 * Page header / Group / SettingRow
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
        subtitle="管理全局组合键以及它们触发时自动输入的内容。"
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
  keywords,
  draft,
  onChangeDraft,
  onAdd,
  onRemove,
}: SectionProps & {
  keywords: string[];
  draft: string;
  onChangeDraft: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <>
      <PageHeader
        title="窗口匹配"
        subtitle="只有当前活动窗口的标题包含下列任一关键词时，热键才会生效。"
      />

      <Group title="新增关键词">
        <SettingRow
          icon={<Add20Regular />}
          label="添加新关键词"
          desc="输入要匹配的窗口标题片段，按 Enter 或点击添加按钮。"
          divider={false}
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
              <Button appearance="secondary" onClick={onAdd}>
                添加
              </Button>
            </>
          }
        />
      </Group>

      <Group title={`已添加（${keywords.length}）`}>
        {keywords.length === 0 ? (
          <div className={styles.emptyTagHint}>
            <Caption1>还没有关键词。</Caption1>
          </div>
        ) : (
          <div className={styles.tagGroup}>
            <TagGroup
              onDismiss={(_, d) => {
                const idx = Number(d.value);
                if (Number.isFinite(idx)) onRemove(idx);
              }}
            >
              {keywords.map((kw, i) => (
                <InteractionTag key={`${kw}-${i}`} value={String(i)} shape="rounded">
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
  config,
  onChangeInterval,
  onChangeDelay,
}: SectionProps & {
  config: AppConfig;
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
        subtitle="控制热键触发后的自动重发频率，以及模拟按键之间的间隔。"
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
              value={config.auto_input_interval_secs}
              displayValue={`${config.auto_input_interval_secs} 秒`}
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
              value={config.input_delay_millis}
              displayValue={`${config.input_delay_millis} 毫秒`}
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
            {/* 组合键预览 + 录制 */}
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
                  if (d.optionValue) onChange({ modifier_key: d.optionValue });
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

void Text;
