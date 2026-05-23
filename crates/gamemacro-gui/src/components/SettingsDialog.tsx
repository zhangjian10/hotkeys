import { useState } from "react";
import {
  Button,
  Caption1,

  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  SpinButton,
  type SpinButtonOnChangeData,
  Switch,
  Tab,
  TabList,
  type TabValue,
  TagGroup,
  tokens,
} from "@fluentui/react-components";
import {
  Dismiss20Regular,
  DocumentBulletList20Regular,
  FolderOpen20Regular,
  Search20Regular,
} from "@fluentui/react-icons";

import type { Profile } from "../lib/api";

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
  onRemoveKeyword: (i: number) => void;
  onPickWindow: () => void;
  /* 全局 tab：engine 开关 + 日志 */
  engineEnabled: boolean;
  onSetEngineEnabled: (enabled: boolean) => void;
  onRevealLog: () => void;
  /* 关于 tab */
  onRevealConfig: () => void;
}

type SectionKey = "profile" | "global" | "about";

/**
 * 设置对话框：替代旧侧栏的「窗口匹配 / 输入节奏」两页 + 新增「全局 / 关于」两段。
 *
 * 关键词管理被精简成「从当前窗口列表选一个」单一入口；不再提供文本输入或精确/包含模式。
 * 选中后统一以模糊匹配（`%title%`）写入。
 */
export function SettingsDialog({
  open,
  onOpenChange,
  profile,
  configPath,
  appVersion,
  onChangeInterval,
  onChangeDelay,
  onRemoveKeyword,
  onPickWindow,
  engineEnabled,
  onSetEngineEnabled,
  onRevealLog,
  onRevealConfig,
}: SettingsDialogProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<SectionKey>("profile");

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

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface className={styles.settingsDialog}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                aria-label="关闭设置"
                icon={<Dismiss20Regular />}
                onClick={() => onOpenChange(false)}
              />
            }
          >
            设置
          </DialogTitle>
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

                  {/* 关键词管理：单一入口 = 选择窗口 */}
                  <SettingRow
                    label="目标窗口"
                    desc="选择一个正在运行的窗口，作为本配置生效的关键词。"
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

                  {/* 当前活动窗口实时显示（仅展示，不可添加） */}
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
                      <span
                        className={styles.hkMuted}
                        style={
                          matchedByCurrent
                            ? { color: tokens.colorPaletteGreenForeground1 }
                            : undefined
                        }
                      >
                        {matchedByCurrent ? "已匹配" : "未匹配"}
                      </span>
                    )}
                  </div>



                  {/* 已有关键词 */}
                  <div className={styles.windowKeywords}>
                    <div className={styles.windowKeywordsHeader}>
                      <span className={styles.windowKeywordsTitle}>生效窗口</span>
                      <Caption1 className={styles.hkMuted}>
                        {profile.window_keywords.length} 个关键词
                      </Caption1>
                    </div>
                    {profile.window_keywords.length === 0 ? (
                      <Caption1 className={styles.emptyTagHint}>
                        还没有关键词。该配置不会被任何窗口激活。
                      </Caption1>
                    ) : (
                      <div className={styles.windowKeywordTags}>
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
                              appearance="filled"
                            >
                              <InteractionTagPrimary
                                title={`包含匹配：${humanKeyword(kw)}`}
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
                  </div>

                </>
              )}

              {tab === "profile" && !profile && (
                <Caption1>请先在顶栏选择或新建一个 Profile。</Caption1>
              )}

              {tab === "global" && (
                <>
                  <SettingRow
                    label="启用热键监听"
                    desc="关闭后，所有热键不再触发；不影响 GUI 配置编辑。"
                    control={
                      <Switch
                        checked={engineEnabled}
                        onChange={(_, d) => onSetEngineEnabled(d.checked)}
                      />
                    }
                  />
                  <SettingRow
                    label="日志文件"
                    desc="位于 %LOCALAPPDATA%\GameMacro\gamemacro.log。"
                    divider={false}
                    control={
                      <Button
                        appearance="secondary"
                        icon={<DocumentBulletList20Regular />}
                        onClick={onRevealLog}
                      >
                        打开日志文件
                      </Button>
                    }
                  />
                </>
              )}

              {tab === "about" && (
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
              )}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
