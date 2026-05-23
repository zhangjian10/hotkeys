import { memo } from "react";
import { Badge, Tooltip } from "@fluentui/react-components";

import { displayKey } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export type ComboBadgeState = "static" | "recording" | "conflict";

export interface ComboBadgeProps {
  modifierKey: string;
  triggerKey: string;
  state: ComboBadgeState;
  /** conflict 态时显示的 tooltip 文案（例如「与「召唤刑天」冲突」） */
  conflictHint?: string;
  /** 点击徽章；调用方决定接下来是开始/停止录制 */
  onClick?: () => void;
  size?: "small" | "medium" | "large";
}

/**
 * 组合键徽章：单一控件承担「显示 / 录制入口 / 冲突警示」三种角色。
 *
 * 取代旧 EditorDrawer 里的"修饰键下拉 + 触发键下拉 + 录制按钮"三件套。
 */
function ComboBadgeBase({
  modifierKey,
  triggerKey,
  state,
  conflictHint,
  onClick,
  size = "medium",
}: ComboBadgeProps) {
  const styles = useStyles();

  const content =
    state === "recording"
      ? "按下组合键 · Esc 取消"
      : `${modifierKey} + ${displayKey(triggerKey)}`;

  const appearance =
    state === "conflict"
      ? "filled"
      : state === "recording"
        ? "outline"
        : "tint";

  const color =
    state === "conflict"
      ? "warning"
      : state === "recording"
        ? "brand"
        : "brand";

  const className = [
    styles.comboBadge,
    state === "recording" ? styles.comboBadgeRecording : "",
    state === "conflict" ? styles.comboBadgeConflict : "",
  ]
    .filter(Boolean)
    .join(" ");

  const badge = (
    <Badge
      appearance={appearance}
      color={color}
      size={size}
      shape="rounded"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      role="button"
      tabIndex={0}
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

  if (state === "conflict" && conflictHint) {
    return (
      <Tooltip content={conflictHint} relationship="description">
        {badge}
      </Tooltip>
    );
  }
  return badge;
}

export const ComboBadge = memo(ComboBadgeBase);
