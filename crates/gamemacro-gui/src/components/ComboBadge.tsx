import { memo } from "react";
import { Badge, Tooltip, mergeClasses } from "@fluentui/react-components";
import { Edit16Regular, Record16Regular } from "@fluentui/react-icons";

import { displayKey } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export type ComboBadgeState = "static" | "recording" | "conflict";

export interface ComboBadgeProps {
  /** 修饰键序列（顺序敏感）。可为空数组 = 无修饰键。 */
  modifiers: string[];
  triggerKey: string;
  state: ComboBadgeState;
  /** 录制态下，已按下但还在等触发键的修饰键集合。 */
  pendingModifiers?: string[];
  /** conflict 态时显示的 tooltip 文案 */
  conflictHint?: string;
  /**
   * `interactive=true`（默认）：可点击；static 态默认不显示图标，hover 时
   * 浮现编辑图标（不引起 layout shift——图标默认 visibility:hidden 占位）。
   * `interactive=false`：纯展示，无图标 / 无 hover / 无 tooltip / 不响应点击；
   * 用于展开态把 ComboBadge 当作"快捷键值显示"使用。
   */
  interactive?: boolean;
  /** 点击徽章；仅 interactive=true 时生效 */
  onClick?: () => void;
  size?: "small" | "medium" | "large";
}

/**
 * 快捷键徽章：折叠态承担「显示 / 编辑入口 / 冲突警示」；展开态可降级为纯显示。
 */
function ComboBadgeBase({
  modifiers,
  triggerKey,
  state,
  pendingModifiers = [],
  conflictHint,
  interactive = true,
  onClick,
  size = "medium",
}: ComboBadgeProps) {
  const styles = useStyles();

  const recordingContent =
    pendingModifiers.length > 0
      ? `${pendingModifiers.join(" + ")} + …`
      : "按下快捷键 · Esc 取消";

  const staticContent =
    modifiers.length === 0
      ? displayKey(triggerKey)
      : `${modifiers.join(" + ")} + ${displayKey(triggerKey)}`;

  const content = state === "recording" ? recordingContent : staticContent;

  // 三态都用 tint 外观（淡底+柔色字），仅靠 color 区分：
  //   static / recording -> brand（淡蓝）
  //   conflict           -> severe（淡橙，比 warning 黄更醒目，又不刺眼）
  const appearance = state === "recording" ? "outline" : "tint";
  const color = state === "conflict" ? "severe" : "brand";

  // 图标策略：
  //   - interactive=false：完全没有图标
  //   - recording / conflict：始终显示对应图标（明确语义）
  //   - static + interactive：渲染编辑图标但默认 visibility:hidden 占位，
  //     hover 时由 CSS 切到 visible，避免 layout shift
  let icon: JSX.Element | undefined;
  if (interactive) {
    if (state === "recording") icon = <Record16Regular />;
    else if (state === "conflict") icon = <Edit16Regular />;
    else
      icon = (
        <Edit16Regular data-combo-hover-icon style={{ visibility: "hidden" }} />
      );
  }

  const className = mergeClasses(
    styles.comboBadge,
    !interactive && styles.comboBadgeStatic,
    state === "recording" && styles.comboBadgeRecording,
    state === "conflict" && styles.comboBadgeConflict,
  );

  const ariaLabel = interactive
    ? state === "recording"
      ? "正在录制快捷键，按 Esc 取消"
      : `快捷键 ${staticContent}，点击修改`
    : `快捷键 ${staticContent}`;

  const badge = (
    <Badge
      appearance={appearance}
      color={color}
      size={size}
      shape="rounded"
      icon={icon}
      iconPosition="before"
      className={className}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onClick?.();
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={ariaLabel}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {content}
    </Badge>
  );

  // tooltip 只在 interactive 时附加
  const tooltip =
    interactive && state === "conflict" && conflictHint
      ? conflictHint
      : interactive && state === "static"
        ? "点击修改快捷键"
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
