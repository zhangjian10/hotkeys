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
import { humanKeyword } from "../../lib/utils";
import { useStyles } from "../../styles/useStyles";
import { Group, PageHeader } from "../Layout";
import { HotkeyRow } from "../HotkeyRow";

export interface HotkeysPageProps {
  profile: Profile;
  hotkeys: { hotkey: HotkeyConfig; index: number }[];
  total: number;
  query: string;
  recording: boolean;
  onChangeQuery: (v: string) => void;
  onAdd: () => void;
  onEdit: (i: number) => void;
  onDelete: (i: number) => void;
  onTry: (text: string) => void;
  onGoWindow: () => void;
}

export function HotkeysPage({
  profile,
  hotkeys,
  total,
  query,
  recording,
  onChangeQuery,
  onAdd,
  onEdit,
  onDelete,
  onTry,
  onGoWindow,
}: HotkeysPageProps) {
  const styles = useStyles();
  const noKeyword = profile.window_keywords.length === 0;

  return (
    <>
      <PageHeader
        title="热键"
        subtitle="管理当前配置下的全局组合键以及它们触发时自动输入的内容。"
      />

      {/* 因果预览：让小白一眼看懂"在哪激活、按什么、做什么" */}
      <div
        className={`${styles.causalCard} ${
          noKeyword ? styles.causalWarn : ""
        }`}
      >
        {noKeyword ? (
          <>
            <span>
              此配置还没有窗口关键词，热键<strong>不会</strong>
              在任何窗口被激活。
            </span>
            <Button size="small" appearance="primary" onClick={onGoWindow}>
              去添加
            </Button>
          </>
        ) : (
          <>
            <span>当窗口标题包含</span>
            {profile.window_keywords.slice(0, 3).map((kw, i) => (
              <span key={`${kw}-${i}`} className={styles.causalKw}>
                {humanKeyword(kw)}
              </span>
            ))}
            {profile.window_keywords.length > 3 && (
              <span className={styles.hkMuted}>
                等 {profile.window_keywords.length} 项
              </span>
            )}
            <span>时，按下下面任一组合键即触发。</span>
          </>
        )}
      </div>

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
                hotkey={item.hotkey}
                index={item.index}
                disabled={recording}
                onEdit={onEdit}
                onDelete={onDelete}
                onTry={onTry}
              />
            </div>
          ))
        )}
      </Group>
    </>
  );
}
