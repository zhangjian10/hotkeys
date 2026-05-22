import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Caption1,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Textarea,
  ToggleButton,
  Tooltip,
} from "@fluentui/react-components";
import {
  Dismiss20Regular,
  Play20Regular,
  Record20Filled,
  Record20Regular,
} from "@fluentui/react-icons";
import {
  ALL_MODIFIERS,
  ALL_TRIGGERS,
  type HotkeyConfig,
  displayKey,
} from "../lib/api";
import { COMMON_RESERVED_COMBOS } from "../constants/app";
import { useStyles } from "../styles/useStyles";
import { KeyChip } from "./KeyChip";

export interface EditorDrawerProps {
  open: boolean;
  hotkey: HotkeyConfig | null;
  recording: boolean;
  duplicate: boolean;
  onClose: () => void;
  onChange: (patch: Partial<HotkeyConfig>) => void;
  onToggleRecord: () => void;
  onTry: () => void;
}

export function EditorDrawer({
  open,
  hotkey,
  recording,
  duplicate,
  onClose,
  onChange,
  onToggleRecord,
  onTry,
}: EditorDrawerProps) {
  const styles = useStyles();
  const [showManual, setShowManual] = useState(false);

  // 关闭抽屉时重置展开
  useEffect(() => {
    if (!open) setShowManual(false);
  }, [open]);

  const reservedCombo = useMemo(() => {
    if (!hotkey) return null;
    const key = `${hotkey.modifier_key}+${displayKey(hotkey.trigger_key)}`;
    return COMMON_RESERVED_COMBOS.has(key) ? key : null;
  }, [hotkey]);

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
          <div className={styles.drawerForm}>
            <ComboCard
              hotkey={hotkey}
              recording={recording}
              duplicate={duplicate}
              reservedCombo={reservedCombo}
              showManual={showManual}
              onToggleRecord={onToggleRecord}
              onToggleManual={() => setShowManual((v) => !v)}
              onChange={onChange}
            />

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
                className={styles.drawerTextarea}
              />
            </Field>

            <div className={styles.drawerActions}>
              <Tooltip
                content="3 秒后向当前焦点输入内容"
                relationship="label"
              >
                <Button
                  appearance="subtle"
                  icon={<Play20Regular />}
                  disabled={recording || !hotkey.input_string.trim()}
                  onClick={onTry}
                >
                  试一下
                </Button>
              </Tooltip>
            </div>
          </div>
        )}
      </DrawerBody>
    </Drawer>
  );
}

interface ComboCardProps {
  hotkey: HotkeyConfig;
  recording: boolean;
  duplicate: boolean;
  reservedCombo: string | null;
  showManual: boolean;
  onToggleRecord: () => void;
  onToggleManual: () => void;
  onChange: (patch: Partial<HotkeyConfig>) => void;
}

function ComboCard({
  hotkey,
  recording,
  duplicate,
  reservedCombo,
  showManual,
  onToggleRecord,
  onToggleManual,
  onChange,
}: ComboCardProps) {
  const styles = useStyles();
  return (
    <div className={styles.recordCard}>
      <div className={styles.recordHeader}>
        <span className={styles.hkMuted}>当前组合键</span>
        <div className={styles.recordCombo}>
          <KeyChip text={hotkey.modifier_key} />
          <span className={styles.keyPlus}>+</span>
          <KeyChip
            text={displayKey(hotkey.trigger_key)}
            variant="trigger"
          />
        </div>
        {duplicate && (
          <Badge appearance="tint" color="warning" size="small">
            与其它热键重复
          </Badge>
        )}
      </div>

      <ToggleButton
        className={styles.recordButton}
        appearance={recording ? "primary" : "secondary"}
        checked={recording}
        size="large"
        icon={recording ? <Record20Filled /> : <Record20Regular />}
        onClick={onToggleRecord}
      >
        {recording ? "按下组合键，Esc 取消" : "录制新组合键"}
      </ToggleButton>

      {reservedCombo && !recording && (
        <Caption1 className={styles.recordWarn}>
          ⚠ {reservedCombo} 通常用于系统快捷键，可能与其它应用冲突。
        </Caption1>
      )}

      <button
        type="button"
        className={styles.manualToggle}
        onClick={onToggleManual}
      >
        {showManual ? "▴ 收起手动选择" : "▾ 手动选择修饰键 / 触发键"}
      </button>

      {showManual && (
        <div className={styles.manualGrid}>
          <Field label="修饰键">
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
          <Field label="触发键">
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
                  {displayKey(t)}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
      )}
    </div>
  );
}
