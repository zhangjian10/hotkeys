import { useState } from "react";
import {
  Badge,
  Button,
  Caption1,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  Radio,
  RadioGroup,
  SpinButton,
  type SpinButtonOnChangeData,
  Tab,
  TabList,
  type TabValue,
  TagGroup,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  FolderOpen20Regular,
  Search20Regular,
  Timer20Regular,
  WindowConsole20Regular,
} from "@fluentui/react-icons";

import type { Profile } from "../lib/api";
import type { DraftMode } from "../types";
import { humanKeyword, isMatchedByCurrent } from "../lib/utils";
import { useStyles } from "../styles/useStyles";
import { useForegroundTitle } from "../hooks/useForegroundTitle";
import { SettingRow } from "./SettingRow";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  configPath: string;
  appVersion: string;
  /* 当前 profile 字段编辑 */
  onChangeInterval: (v: number) => void;
  onChangeDelay: (v: number) => void;
  onAddKeyword: (value?: string, mode?: DraftMode) => void;
  onRemoveKeyword: (i: number) => void;
  onPickWindow: () => void;
  /* 关于 tab */
  onRevealConfig: () => void;
}

type SectionKey = "profile" | "global" | "about";

/**
 * 设置对话框：替代旧侧栏的「窗口匹配 / 输入节奏」两页 + 新增「全局 / 关于」两段。
 *
 * - 当前 Profile：循环间隔、按键延迟、窗口关键词列表 + 前台标题实时预览
 * - 全局：先 stub（daemon 启停 / 开机自启 / 跟随系统深色 留给后续 PR）
 * - 关于：版本号 + 配置文件路径 + 「打开配置位置」
 */
export function SettingsDialog({
  open,
  onOpenChange,
  profile,
  configPath,
  appVersion,
  onChangeInterval,
  onChangeDelay,
  onAddKeyword,
  onRemoveKeyword,
  onPickWindow,
  onRevealConfig,
}: SettingsDialogProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<SectionKey>("profile");
  const [draft, setDraft] = useState("");
  const [draftMode, setDraftMode] = useState<DraftMode>("fuzzy");

  // 仅在 dialog 打开 + 当前 tab 为 profile 时轮询前台窗口标题
  const foreground = useForegroundTitle(open && tab === "profile");
  const matchedByCurrent =
    !!foreground && !!profile && isMatchedByCurrent(foreground, profile);

  const handleSpin =
    (setter: (v: number) => void, min: number) =>
    (_: unknown, data: SpinButtonOnChangeData) => {
      const value = data.value ?? Number(data.displayValue ?? min);
      if (Number.isFinite(value)) setter(Math.max(min, Math.floor(value)));
    };

  const submitDraft = () => {
    onAddKeyword(draft, draftMode);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface className={styles.settingsDialog}>
        <DialogBody>
          <DialogTitle>设置</DialogTitle>
          <DialogContent>
            <TabList
              selectedValue={tab}
              onTabSelect={(_, d) => setTab(d.value as SectionKey)}
            >
              <Tab value={"profile" satisfies TabValue}>当前 Profile</Tab>
              <Tab value={"global" satisfies TabValue}>全局</Tab>
              <Tab value={"about" satisfies TabValue}>关于</Tab>
            </TabList>

            <div className={styles.settingsBody}>
              {tab === "profile" && profile && (
                <>
                  {/* 计时 */}
                  <SettingRow
                    icon={<Timer20Regular />}
                    label="自动输入间隔"
                    desc="持续按住循环热键时，每隔多少秒重发一次输入。可被每条热键单独覆盖。"
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

                  {/* 当前活动窗口实时显示 */}
                  <div className={styles.liveWindow}>
                    <span
                      className={styles.liveDot}
                      style={{
                        backgroundColor: matchedByCurrent
                          ? tokens.colorPaletteGreenForeground2
                          : tokens.colorNeutralForeground4,
                      }}
                    />
                    <span className={styles.hkMuted}>当前活动窗口：</span>
                    <span className={styles.liveTitle}>
                      {foreground || "（读取中…）"}
                    </span>
                    {foreground && (
                      <>
                        <Badge
                          appearance="tint"
                          color={matchedByCurrent ? "success" : "informative"}
                          size="small"
                        >
                          {matchedByCurrent ? "本配置生效" : "未匹配本配置"}
                        </Badge>
                        <Tooltip
                          content="把这个窗口标题加为关键词"
                          relationship="label"
                        >
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Add20Regular />}
                            onClick={() => onAddKeyword(foreground, "fuzzy")}
                          >
                            加入此窗口
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </div>

                  {/* 关键词输入 */}
                  <SettingRow
                    icon={<Add20Regular />}
                    label="新增关键词"
                    desc="输入关键词后按 Enter 添加；选「包含」时即使部分匹配也会激活。"
                    control={
                      <>
                        <Input
                          placeholder="例如：原神"
                          value={draft}
                          onChange={(_, d) => setDraft(d.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitDraft();
                            }
                          }}
                          style={{ width: 200 }}
                        />
                        <Button appearance="secondary" onClick={submitDraft}>
                          添加
                        </Button>
                      </>
                    }
                  />
                  <SettingRow
                    label="匹配方式"
                    desc={
                      draftMode === "fuzzy"
                        ? "标题中只要「包含」这段文字就算命中（推荐用于游戏）。"
                        : "标题需要和关键词「完全相等」才算命中。"
                    }
                    control={
                      <RadioGroup
                        layout="horizontal"
                        value={draftMode}
                        onChange={(_, d) => setDraftMode(d.value as DraftMode)}
                      >
                        <Radio value="fuzzy" label="包含" />
                        <Radio value="exact" label="完全相等" />
                      </RadioGroup>
                    }
                  />
                  <SettingRow
                    icon={<WindowConsole20Regular />}
                    label="从所有窗口列表中选择"
                    desc="弹出列表，点选目标窗口作为关键词。"
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

                  {/* 已有关键词 */}
                  <Caption1 className={styles.settingsGroupLabel}>
                    已添加（{profile.window_keywords.length}）
                  </Caption1>
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
                          if (Number.isFinite(idx)) onRemoveKeyword(idx);
                        }}
                      >
                        {profile.window_keywords.map((kw, i) => (
                          <InteractionTag
                            key={`${kw}-${i}`}
                            value={String(i)}
                            shape="rounded"
                            appearance={kw.includes("%") ? "outline" : "filled"}
                          >
                            <InteractionTagPrimary
                              title={
                                kw.includes("%")
                                  ? `包含匹配：${humanKeyword(kw)}`
                                  : `完全匹配：${kw}`
                              }
                            >
                              {humanKeyword(kw)}
                            </InteractionTagPrimary>
                            <InteractionTagSecondary
                              aria-label={`删除关键词 ${kw}`}
                            />
                          </InteractionTag>
                        ))}
                      </TagGroup>
                    </div>
                  )}
                </>
              )}

              {tab === "profile" && !profile && (
                <Caption1>请先在顶栏选择或新建一个 Profile。</Caption1>
              )}

              {tab === "global" && (
                <>
                  <SettingRow
                    label="Daemon 运行中"
                    desc="后续版本：从 GUI 直接启停 daemon。当前需手动运行 gamemacro-daemon.exe。"
                    divider={false}
                    control={<Caption1>即将推出</Caption1>}
                  />
                </>
              )}

              {tab === "about" && (
                <>
                  <SettingRow
                    label="GameMacro"
                    desc={`v${appVersion} · 配置文件：${configPath || "（加载中…）"}`}
                    divider={false}
                    control={
                      <Button
                        appearance="secondary"
                        icon={<FolderOpen20Regular />}
                        onClick={onRevealConfig}
                      >
                        打开配置位置
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
