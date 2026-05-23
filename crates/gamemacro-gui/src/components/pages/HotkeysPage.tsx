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
  /** 当 profile 没有窗口关键词时，引导用户去打开设置 Dialog 配。 */
  onGoWindow: () => void;
}

/**
 * 单页主体：顶部搜索 + 「+ 新增」、下方一张卡片承载所有热键行。
 * 当前仍使用旧 HotkeyRow，Sub-PR C 替换为可内联展开的 HotkeyCard。
 */
export function HotkeysPage({
  profile,
  hotkeys,
  total,
  recording,
  query,
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

      <div className={styles.hkListCard}>
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
      </div>
    </>
  );
}
