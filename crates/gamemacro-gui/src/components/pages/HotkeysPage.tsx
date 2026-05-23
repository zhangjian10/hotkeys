import {
  Button,
  Caption1,
  Input,
  Subtitle2,
} from "@fluentui/react-components";
import {
  Add20Regular,
  KeyboardLayoutFloat20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import type { HotkeyConfig, Profile } from "../../lib/api";
import { useStyles } from "../../styles/useStyles";
import { HotkeyCard } from "../HotkeyCard";

export interface HotkeysPageProps {
  profile: Profile;
  hotkeys: { hotkey: HotkeyConfig; index: number }[];
  total: number;
  query: string;
  recording: boolean;
  /** 当前展开内联编辑的热键 index；-1 表示无 */
  expandedIndex: number;
  onChangeQuery: (v: string) => void;
  onAdd: () => void;
  onToggleExpand: (i: number) => void;
  onToggleRecord: (i: number) => void;
  onChange: (i: number, patch: Partial<HotkeyConfig>) => void;
  onTry: (text: string) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  /** 当 profile 没有窗口关键词时引导用户打开设置 Dialog */
  onGoWindow: () => void;
}

/**
 * 单页主体：搜索 + 添加按钮 + 卡片列表 + 「+ 新增热键」底部按钮。
 */
export function HotkeysPage({
  profile,
  hotkeys,
  total,
  recording,
  query,
  expandedIndex,
  onChangeQuery,
  onAdd,
  onToggleExpand,
  onToggleRecord,
  onChange,
  onTry,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onGoWindow,
}: HotkeysPageProps) {
  const styles = useStyles();
  const noKeyword = profile.window_keywords.length === 0;
  const profileInterval = profile.auto_input_interval_secs;

  return (
    <>
      {noKeyword && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            columnGap: 8,
            padding: "10px 14px",
            border: "1px solid #f0c674",
            backgroundColor: "#fff8e1",
            borderRadius: 7,
            color: "#7a5b00",
            fontSize: 13,
          }}
        >
          <span>
            「{profile.name}」还没有窗口关键词，热键
            <strong>不会</strong>在任何窗口生效。
          </span>
          <span style={{ flex: 1 }} />
          <Button size="small" appearance="primary" onClick={onGoWindow}>
            去设置
          </Button>
        </div>
      )}

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

      {hotkeys.length === 0 ? (
        <div className={styles.empty}>
          <KeyboardLayoutFloat20Regular style={{ fontSize: 28 }} />
          <Subtitle2>{total === 0 ? "还没有热键" : "没有匹配的热键"}</Subtitle2>
          <Caption1>
            {total === 0
              ? "点击右上角「添加热键」创建第一条"
              : "尝试换一个关键词"}
          </Caption1>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", rowGap: 8 }}>
          {hotkeys.map((item) => {
            const isExpanded = item.index === expandedIndex;
            const isDuplicate = profile.hotkeys.some(
              (h, j) =>
                j !== item.index &&
                h.modifier_key === item.hotkey.modifier_key &&
                h.trigger_key === item.hotkey.trigger_key,
            );

            return (
              <HotkeyCard
                key={item.index}
                hotkey={item.hotkey}
                index={item.index}
                total={profile.hotkeys.length}
                expanded={isExpanded}
                recording={recording && item.index === expandedIndex}
                duplicate={isDuplicate}
                profileIntervalSecs={profileInterval}
                onToggleExpand={() => onToggleExpand(item.index)}
                onToggleRecord={() => onToggleRecord(item.index)}
                onChange={(patch) => onChange(item.index, patch)}
                onTry={onTry}
                onDuplicate={() => onDuplicate(item.index)}
                onDelete={() => onDelete(item.index)}
                onMoveUp={() => onMoveUp(item.index)}
                onMoveDown={() => onMoveDown(item.index)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
