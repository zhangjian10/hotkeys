import { makeStyles, tokens } from "@fluentui/react-components";

/**
 * 全局样式表。集中在此便于维护。
 * 子组件之外通过 `useStyles()` 取用即可。
 */
export const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },

  /* ================= 自绘标题栏（decorations:false 配合） ================= */
  titleBar: {
    flexShrink: 0,
    height: "32px",
    display: "flex",
    alignItems: "stretch",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    userSelect: "none",
  },
  titleBarLeft: {
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    paddingInline: "12px",
    flexShrink: 0,
  },
  titleBarIcon: {
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorBrandForeground1,
  },
  titleBarTitle: {
    fontSize: "12px",
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "nowrap",
  },
  titleBarSpacer: { flex: 1, minWidth: 0 },
  titleBarActions: {
    display: "flex",
    alignItems: "stretch",
    flexShrink: 0,
  },
  /**
   * Windows 11 原生 caption 按钮 —— 使用原生 <button>，没有 Fluent Button 的
   * minHeight / padding / focus-ring 干扰。
   */
  captionBtn: {
    appearance: "none",
    margin: 0,
    padding: 0,
    width: "46px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    color: tokens.colorNeutralForeground1,
    cursor: "default",
    outline: "none",
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.0578)",
      color: tokens.colorNeutralForeground1,
    },
    "&:active": {
      backgroundColor: "rgba(0, 0, 0, 0.0373)",
      color: tokens.colorNeutralForeground1,
    },
    "&:focus-visible": {
      outline: `1px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-1px",
    },
  },
  captionBtnClose: {
    "&:hover": {
      backgroundColor: "#C42B1C",
      color: "#FFFFFF",
    },
    "&:active": {
      backgroundColor: "#B5271B",
      color: "#FFFFFF",
    },
  },

  /* ================= 顶栏（TitleBar 下方一条） ================= */
  topBar: {
    flexShrink: 0,
    height: "44px",
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
    paddingInline: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  topBrand: {
    fontSize: "13px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    paddingRight: "8px",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    marginRight: "4px",
  },
  topBarSpacer: { flex: 1, minWidth: 0 },

  /* ================= 顶栏：daemon 状态灯按钮 ================= */
  statusBtn: {
    display: "inline-flex",
    alignItems: "center",
    columnGap: "6px",
    paddingInline: "8px",
    height: "28px",
    fontSize: "12px",
  },
  statusDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralForeground3,
  },
  statusDotRunning: {
    backgroundColor: tokens.colorPaletteGreenForeground1,
    boxShadow: `0 0 0 2px ${tokens.colorPaletteGreenBackground2}`,
  },
  statusDotInactive: {
    backgroundColor: tokens.colorPaletteYellowForeground1,
    boxShadow: `0 0 0 2px ${tokens.colorPaletteYellowBackground2}`,
  },
  statusDotDown: {
    backgroundColor: tokens.colorNeutralForeground3,
  },
  statusMenuHeader: {
    paddingInline: "12px",
    paddingTop: "10px",
    paddingBottom: "4px",
    fontSize: "11.5px",
    color: tokens.colorNeutralForeground3,
  },

  /* ================= 主体（顶栏下方铺满） ================= */
  body: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  scroll: { flex: 1, minHeight: 0, overflowY: "auto" },
  scrollInner: {
    width: "100%",
    maxWidth: "1024px",
    marginInline: "auto",
    paddingInline: "24px",
    paddingTop: "16px",
    paddingBottom: "48px",
    display: "flex",
    flexDirection: "column",
    rowGap: "16px",
  },

  /* ================= 设置 Dialog ================= */
  settingsDialog: {
    minWidth: "560px",
    maxWidth: "640px",
  },
  settingsBody: {
    paddingTop: "8px",
    display: "flex",
    flexDirection: "column",
    rowGap: "0px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "7px",
    overflow: "hidden",
    marginTop: "12px",
  },
  settingsGroupLabel: {
    paddingInline: "16px",
    paddingTop: "12px",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  dialogForm: {
    display: "flex",
    flexDirection: "column",
    rowGap: "12px",
  },

  /* ================= 通用 SettingRow ================= */
  row: {
    display: "flex",
    alignItems: "center",
    columnGap: "16px",
    minHeight: "56px",
    paddingInline: "16px",
    paddingBlock: "10px",
    backgroundColor: tokens.colorNeutralBackground1,
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

  /* ================= 关键词 Tag ================= */
  tagGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    paddingInline: "16px",
    paddingBlock: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  emptyTagHint: {
    paddingInline: "16px",
    paddingBlock: "16px",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
  },

  /* ================= 热键搜索条 + 卡片列表 ================= */
  hkSearch: {
    paddingTop: "4px",
    paddingBottom: "4px",
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
  },
  hkMuted: { color: tokens.colorNeutralForeground3 },

  /* ================= 单条热键卡片 ================= */
  hkCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
    "&:hover": {
      border: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    "&:focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "1px",
    },
  },
  hkCardExpanded: {
    border: `1px solid ${tokens.colorBrandStroke1}`,
    boxShadow: tokens.shadow4,
    cursor: "default",
  },
  hkCardHead: {
    display: "flex",
    alignItems: "center",
    columnGap: "12px",
    paddingInline: "12px",
    paddingBlock: "10px",
    minHeight: "56px",
  },
  hkCardText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    rowGap: "2px",
  },
  hkCardTitle: {
    fontSize: "13.5px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hkCardPreview: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hkCardBody: {
    display: "flex",
    flexDirection: "column",
    rowGap: "12px",
    paddingInline: "16px",
    paddingTop: "8px",
    paddingBottom: "16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: "default",
  },
  hkCardHint: {
    color: tokens.colorPaletteYellowForeground1,
    paddingInline: "4px",
  },
  hkCardTextarea: {
    fontFamily: tokens.fontFamilyMonospace,
    "& textarea": {
      minHeight: "84px",
      maxHeight: "240px",
    },
  },
  hkCardControls: {
    display: "flex",
    alignItems: "center",
    columnGap: "16px",
    flexWrap: "wrap",
  },
  hkCardSwitch: {
    flexShrink: 0,
  },
  hkCardOverride: {
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    fontSize: "12.5px",
    flexWrap: "wrap",
  },
  hkCardActions: {
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    paddingTop: "4px",
  },

  /* ================= ComboBadge ================= */
  comboBadge: {
    cursor: "pointer",
    fontFamily: tokens.fontFamilyMonospace,
    letterSpacing: "0.02em",
    paddingInline: "10px",
    height: "28px",
    "&:focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "1px",
    },
  },
  comboBadgeRecording: {
    animationName: {
      "0%": { boxShadow: `0 0 0 0 ${tokens.colorPaletteRedBorder1}` },
      "70%": { boxShadow: `0 0 0 6px transparent` },
      "100%": { boxShadow: `0 0 0 0 transparent` },
    },
    animationDuration: "1.6s",
    animationIterationCount: "infinite",
  },
  comboBadgeConflict: {
    cursor: "pointer",
  },

  /* ================= 当前活动窗口实时显示（设置 Dialog 内复用） ================= */
  liveWindow: {
    display: "flex",
    alignItems: "center",
    columnGap: "8px",
    paddingInline: "16px",
    paddingBlock: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    fontSize: "12.5px",
  },
  liveDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  liveTitle: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  /* ================= "试一下" 倒计时 ================= */
  countdownBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    rowGap: "12px",
    paddingBlock: "24px",
  },
  countdownNum: {
    fontSize: "56px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorBrandForeground1,
    lineHeight: 1,
  },

  /* ================= 空状态（无 profile / 无 hotkey 搜索） ================= */
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

  /* ================= KeyChip（备用，目前未使用，保留以便外部组件复用） ================= */
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

  /* ================= WindowPickerDialog ================= */
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
  windowPickerRow: {
    display: "flex",
    gap: "8px",
  },
  windowPickerBody: {
    display: "flex",
    flexDirection: "column",
    rowGap: "12px",
  },
});

export type AppStyles = ReturnType<typeof useStyles>;
