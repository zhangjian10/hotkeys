import { memo } from "react";
import { Badge, Tooltip, mergeClasses } from "@fluentui/react-components";
import { Edit16Regular, Record16Regular } from "@fluentui/react-icons";

import { displayKey } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export type ComboBadgeState = "static" | "recording" | "conflict";

export interface ComboBadgeProps {
  /** 修饰键集合（已排序去重）。可为空数组 = 无修饰键。 */
  modifiers: string[];
  triggerKey: string;
  state: ComboBadgeState;
  /** 录制态下，已按下但还在等触发键的修饰键集合。 */
  pendingModifiers?: string[];
  /** conflict 态时显示的 tooltip 文案 */
  conflictHint?: string;
  /** 点击徽章；调用方决定接下来是开始/停止录制 */
  onClick?: () => void;
  size?: "small" | "medium" | "large";
}

/**
 * 组合键徽章：单一控件承担「显示 / 录制入口 / 冲突警示」三种角色。
 *
 * 视觉提示（v2）：
 * - 始终显示一个铅笔/录制小图标 + 文字徽章，明示这是可点击控件
 * - hover 时整体微微浮起（CSS）
 * - 录制态：图标变成红点，文字实时显示已按下的修饰键 +「按下任意键完成」
 * - 支持任意多修饰键；空 modifiers 则只展示 trigger
 */
function ComboBadgeBase({
  modifiers,
  triggerKey,
  state,
  pendingModifiers = [],
  conflictHint,
  onClick,
  size = "medium",
}: ComboBadgeProps) {
  const styles = useStyles();

  const recordingContent =
    pendingModifiers.length > 0
      ? `${pendingModifiers.join(" + ")} + …`
      : "按下组合键 · Esc 取消";

  const staticContent =
    modifiers.length === 0
      ? displayKey(triggerKey)
      : `${modifiers.join(" + ")} + ${displayKey(triggerKey)}`;

  const content = state === "recording" ? recordingContent : staticContent;

  // 三态都用 tint 外观（淡底+柔色字），仅靠 color 区分：
  //   static / conflict / recording -> 仅色相不同，避免刺眼
  const appearance = state === "recording" ? "outline" : "tint";
  const color = state === "conflict" ? "warning" : "brand";

  const icon =
    state === "recording" ? <Record16Regular /> : <Edit16Regular />;

  const className = mergeClasses(
    styles.comboBadge,
    state === "recording" && styles.comboBadgeRecording,
    state === "conflict" && styles.comboBadgeConflict,
  );

  const ariaLabel =
    state === "recording"
      ? "正在录制组合键，按 Esc 取消"
      : `组合键 ${staticContent}，点击重新录制`;

  const badge = (
    <Badge
      appearance={appearance}
      color={color}
      size={size}
      shape="rounded"
      icon={icon}
      iconPosition="before"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }
      }}
    >
      {content}
    </Badge>
  );

  // 静态态也加 tooltip 帮助新用户发现"它可以点"
  const tooltip =
    state === "conflict" && conflictHint
      ? conflictHint
      : state === "static"
        ? "点击重新录制组合键"
        : null;

  if (tooltip) {
    return (
      <Tooltip content={tooltip} relationship="description">
        {badge}
      </Tooltip>
    );
  }
  return badge;
}

export const ComboBadge = memo(ComboBadgeBase);
