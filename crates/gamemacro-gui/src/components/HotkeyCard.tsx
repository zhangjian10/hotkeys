import { memo, useCallback } from "react";
import {
  Button,
  Caption1,
  Field,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SpinButton,
  type SpinButtonOnChangeData,
  Switch,
  Textarea,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowDown20Regular,
  ArrowUp20Regular,
  Copy20Regular,
  Delete20Regular,
  MoreHorizontal20Regular,
  Play20Regular,
} from "@fluentui/react-icons";

import {
  type HotkeyConfig,
  displayKey,
} from "../lib/api";
import { previewInput } from "../lib/utils";
import { COMMON_RESERVED_COMBOS } from "../constants/app";
import { useStyles } from "../styles/useStyles";
import { ComboBadge, type ComboBadgeState } from "./ComboBadge";

export interface HotkeyCardProps {
  hotkey: HotkeyConfig;
  index: number;
  total: number;
  expanded: boolean;
  recording: boolean;
  /** 是否与同 profile 内其它热键的组合键重复 */
  duplicate: boolean;
  /** 用于"高级"里的 fallback 显示：profile 默认间隔 */
  profileIntervalSecs: number;
  onToggleExpand: () => void;
  onToggleRecord: () => void;
  onChange: (patch: Partial<HotkeyConfig>) => void;
  onTry: (text: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * 单条热键卡片：折叠态显示组合键徽章 + 描述 + 输入预览；展开态内联编辑。
 *
 * 取代旧的 HotkeyRow + EditorDrawer 双控件。整卡可点切换展开；
 * ComboBadge 单独承担"录制组合键"职责，避免把修饰键/触发键拆成两个下拉。
 */
function HotkeyCardBase({
  hotkey,
  index,
  total,
  expanded,
  recording,
  duplicate,
  profileIntervalSecs,
  onToggleExpand,
  onToggleRecord,
  onChange,
  onTry,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: HotkeyCardProps) {
  const styles = useStyles();

  // repeat 字段缺省视为 true（与 daemon serde default 对齐）
  const repeat = hotkey.repeat !== false;

  // 检测保留组合键（仅警告，不阻止）
  const reservedKey = `${hotkey.modifier_key}+${displayKey(hotkey.trigger_key)}`;
  const isReserved = COMMON_RESERVED_COMBOS.has(reservedKey);

  // ComboBadge 三态判定
  const badgeState: ComboBadgeState = recording
    ? "recording"
    : duplicate || isReserved
      ? "conflict"
      : "static";

  const conflictHint = duplicate
    ? "此组合键与同 Profile 中另一条热键重复"
    : isReserved
      ? `${reservedKey} 通常用于系统快捷键，可能与其它应用冲突`
      : undefined;

  const preview = previewInput(hotkey.input_string);

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // 控件内点击不要冒泡到卡片
      if ((e.target as HTMLElement).closest("[data-stop-card]")) return;
      onToggleExpand();
    },
    [onToggleExpand],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if ((e.target as HTMLElement).closest("[data-stop-card]")) return;
        e.preventDefault();
        onToggleExpand();
      }
    },
    [onToggleExpand],
  );

  const handleSpin = (
    _: unknown,
    data: SpinButtonOnChangeData,
  ) => {
    if (data.value === null || data.displayValue === "") {
      onChange({ interval_secs_override: null });
      return;
    }
    const value = data.value ?? Number(data.displayValue ?? "");
    if (Number.isFinite(value)) {
      onChange({
        interval_secs_override: Math.max(1, Math.floor(value as number)),
      });
    }
  };

  const overrideValue = hotkey.interval_secs_override ?? null;

  return (
    <div
      className={`${styles.hkCard} ${expanded ? styles.hkCardExpanded : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-expanded={expanded}
    >
      {/* ============ 折叠态主行（展开时仍保留作头部） ============ */}
      <div className={styles.hkCardHead}>
        <span data-stop-card>
          <ComboBadge
            modifierKey={hotkey.modifier_key}
            triggerKey={hotkey.trigger_key}
            state={badgeState}
            conflictHint={conflictHint}
            onClick={onToggleRecord}
            size="large"
          />
        </span>

        <div className={styles.hkCardText}>
          <span className={styles.hkCardTitle}>
            {hotkey.description?.trim() || "（未命名）"}
          </span>
          <span className={styles.hkCardPreview} title={preview}>
            {preview}
          </span>
        </div>

        <span data-stop-card>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <MenuButton
                appearance="subtle"
                size="small"
                icon={<MoreHorizontal20Regular />}
                aria-label={`第 ${index + 1} 条热键的更多操作`}
                disabled={recording}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<Play20Regular />} onClick={() => onTry(hotkey.input_string)}>
                  试一下
                </MenuItem>
                <MenuItem icon={<Copy20Regular />} onClick={onDuplicate}>
                  复制
                </MenuItem>
                <MenuItem
                  icon={<ArrowUp20Regular />}
                  onClick={onMoveUp}
                  disabled={index === 0}
                >
                  上移
                </MenuItem>
                <MenuItem
                  icon={<ArrowDown20Regular />}
                  onClick={onMoveDown}
                  disabled={index === total - 1}
                >
                  下移
                </MenuItem>
                <MenuItem icon={<Delete20Regular />} onClick={onDelete}>
                  删除
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </span>
      </div>

      {/* ============ 展开态内联编辑 ============ */}
      {expanded && (
        <div className={styles.hkCardBody} data-stop-card onClick={(e) => e.stopPropagation()}>
          {recording && (
            <Caption1 className={styles.hkCardHint}>
              正在录制 · 请按下组合键，按 Esc 取消
            </Caption1>
          )}

          <Field label="描述">
            <Input
              value={hotkey.description ?? ""}
              disabled={recording}
              placeholder="例如：召唤刑天"
              onChange={(_, d) => onChange({ description: d.value || null })}
            />
          </Field>

          <Field label="输入内容" hint="支持多行；换行 = 游戏内 Enter。">
            <Textarea
              value={hotkey.input_string}
              disabled={recording}
              onChange={(_, d) => onChange({ input_string: d.value })}
              spellCheck={false}
              resize="vertical"
              rows={4}
              className={styles.hkCardTextarea}
            />
          </Field>

          <div className={styles.hkCardControls}>
            <div className={styles.hkCardSwitch}>
              <Switch
                checked={repeat}
                disabled={recording}
                onChange={(_, d) => onChange({ repeat: d.checked })}
                label="按一次循环执行（再按一次停止）"
              />
            </div>

            <div className={styles.hkCardOverride}>
              <span className={styles.hkMuted}>循环间隔覆盖：</span>
              <SpinButton
                size="small"
                min={1}
                step={1}
                value={overrideValue}
                displayValue={
                  overrideValue !== null
                    ? `${overrideValue} 秒`
                    : `跟随 Profile (${profileIntervalSecs} 秒)`
                }
                disabled={recording || !repeat}
                onChange={handleSpin}
              />
              {overrideValue !== null && (
                <Tooltip content="清除覆盖，跟随 Profile 默认" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={() => onChange({ interval_secs_override: null })}
                  >
                    清除
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>

          <div className={styles.hkCardActions}>
            <Tooltip content="3 秒后向当前焦点输入内容" relationship="label">
              <Button
                appearance="subtle"
                icon={<Play20Regular />}
                disabled={recording || !hotkey.input_string.trim()}
                onClick={() => onTry(hotkey.input_string)}
              >
                试一下
              </Button>
            </Tooltip>
            <span style={{ flex: 1 }} />
            <Button
              appearance="secondary"
              size="small"
              disabled={recording}
              onClick={onToggleExpand}
            >
              完成
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const HotkeyCard = memo(HotkeyCardBase);
