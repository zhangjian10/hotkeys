import {
  Badge,
  Button,
  Caption1,
  Input,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  Radio,
  RadioGroup,
  TagGroup,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Search20Regular,
  WindowConsole20Regular,
} from "@fluentui/react-icons";
import type { Profile } from "../../lib/api";
import type { DraftMode } from "../../types";
import { humanKeyword, isMatchedByCurrent } from "../../lib/utils";
import { useStyles } from "../../styles/useStyles";
import { Group, PageHeader } from "../Layout";
import { SettingRow } from "../SettingRow";

export interface WindowPageProps {
  profile: Profile;
  draft: string;
  draftMode: DraftMode;
  foreground: string;
  onChangeDraft: (v: string) => void;
  onChangeMode: (m: DraftMode) => void;
  onAdd: (value?: string, mode?: DraftMode) => void;
  onAddForeground: () => void;
  onRemove: (i: number) => void;
  onPickWindow: () => void;
}

export function WindowPage({
  profile,
  draft,
  draftMode,
  foreground,
  onChangeDraft,
  onChangeMode,
  onAdd,
  onAddForeground,
  onRemove,
  onPickWindow,
}: WindowPageProps) {
  const styles = useStyles();
  const matchedByCurrent =
    !!foreground && isMatchedByCurrent(foreground, profile);

  return (
    <>
      <PageHeader
        title="窗口匹配"
        subtitle={`只有当前活动窗口的标题包含「${profile.name}」配置下的任一关键词时，热键才会生效。`}
      />

      {/* 当前活动窗口 + 是否被本配置激活 */}
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
            <Tooltip content="把这个窗口标题加为关键词" relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<Add20Regular />}
                onClick={onAddForeground}
              >
                加入此窗口
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      <Group title="新增关键词">
        <SettingRow
          icon={<Add20Regular />}
          label="手动输入"
          desc="输入关键词后按 Enter 添加。"
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
                style={{ width: 220 }}
              />
              <Button appearance="secondary" onClick={() => onAdd()}>
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
              onChange={(_, d) => onChangeMode(d.value as DraftMode)}
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
      </Group>

      <Group title={`已添加（${profile.window_keywords.length}）`}>
        {profile.window_keywords.length === 0 ? (
          <div className={styles.emptyTagHint}>
            <Caption1>还没有关键词。该配置不会被任何窗口激活。</Caption1>
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
