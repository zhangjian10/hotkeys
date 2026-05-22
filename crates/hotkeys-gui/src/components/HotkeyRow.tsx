import { memo, useCallback } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { Delete20Regular, Play20Regular } from "@fluentui/react-icons";
import type { HotkeyConfig } from "../lib/api";
import { displayKey } from "../lib/api";
import { previewInput } from "../lib/utils";
import { useStyles } from "../styles/useStyles";
import { KeyChip } from "./KeyChip";

export interface HotkeyRowProps {
  hotkey: HotkeyConfig;
  index: number;
  disabled: boolean;
  onEdit: (i: number) => void;
  onDelete: (i: number) => void;
  onTry: (input: string) => void;
}

function HotkeyRowBase({
  hotkey,
  index,
  disabled,
  onEdit,
  onDelete,
  onTry,
}: HotkeyRowProps) {
  const styles = useStyles();
  const preview = previewInput(hotkey.input_string);

  const handleEdit = useCallback(() => {
    if (!disabled) onEdit(index);
  }, [disabled, onEdit, index]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEdit(index);
      }
    },
    [disabled, onEdit, index],
  );

  const handleTry = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTry(hotkey.input_string);
    },
    [onTry, hotkey.input_string],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(index);
    },
    [onDelete, index],
  );

  return (
    <div
      className={styles.hkRow}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleEdit}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.hkLine}>
        <div className={styles.hkSentence}>
          <span className={styles.hkMuted}>按下</span>
          <KeyChip text={hotkey.modifier_key} />
          <span className={styles.keyPlus}>+</span>
          <KeyChip text={displayKey(hotkey.trigger_key)} variant="trigger" />
          <span className={styles.hkMuted}>→ 自动输入</span>
          <span className={styles.hkInputPreview} title={preview}>
            {preview}
          </span>
        </div>
        {hotkey.description && (
          <span className={styles.hkDesc}>{hotkey.description}</span>
        )}
      </div>
      <div className={styles.hkActions}>
        <Tooltip content="试一下（3 秒后向当前焦点输入）" relationship="label">
          <Button
            appearance="subtle"
            icon={<Play20Regular />}
            disabled={disabled || !hotkey.input_string.trim()}
            aria-label="试一下"
            onClick={handleTry}
          />
        </Tooltip>
        <Tooltip content="删除热键" relationship="label">
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            disabled={disabled}
            aria-label={`删除第 ${index + 1} 条热键`}
            onClick={handleDelete}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export const HotkeyRow = memo(HotkeyRowBase);
