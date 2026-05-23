import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  tokens,
} from "@fluentui/react-components";
import { Record20Filled } from "@fluentui/react-icons";

import { displayKey } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export interface RecorderDialogProps {
  open: boolean;
  /** 已按下并仍按住的修饰键序列（顺序敏感） */
  pendingModifiers: string[];
  /** 上次成功录入的组合键（用于 footer 展示"当前值"），传入 null = 还没值 */
  current?: { modifiers: string[]; trigger: string } | null;
  onCancel: () => void;
}

/**
 * 快捷键录制专用 Dialog。
 *
 * 设计动机：原本 ComboBadge 内联点击进入录制态，对没看过文档的用户太隐晦——
 * 弹窗形式让"现在正在录制"这件事一目了然，并以大字号实时反馈用户按键序列。
 *
 * 真实录制由 App 顶层的 useRecorder hook 完成；本 Dialog 仅负责显示状态。
 * 录制结束（成功 / 取消）由 onCancel 路径关闭 Dialog；成功路径会先 patch hotkey
 * 再走相同的关闭。
 */
export function RecorderDialog({
  open,
  pendingModifiers,
  current,
  onCancel,
}: RecorderDialogProps) {
  const styles = useStyles();

  const liveLabel =
    pendingModifiers.length > 0
      ? pendingModifiers.join(" + ") + " + …"
      : "请按下修饰键 (Ctrl / Alt / Shift / Meta)…";

  const currentLabel =
    current && current.trigger
      ? current.modifiers.length > 0
        ? `${current.modifiers.join(" + ")} + ${displayKey(current.trigger)}`
        : displayKey(current.trigger)
      : "（暂无）";

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => !d.open && onCancel()}
      modalType="alert"
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>录制快捷键</DialogTitle>
          <DialogContent>
            <div className={styles.recorderBox}>
              <div className={styles.recorderDot}>
                <Record20Filled
                  style={{ color: tokens.colorPaletteRedForeground1 }}
                />
                <span>正在录制…</span>
              </div>
              <div className={styles.recorderLive}>{liveLabel}</div>
              <Caption1 className={styles.hkMuted}>
                按下任意字母 / 数字 / F1-F12 / 反引号完成录制；按 Esc 或点取消放弃。
              </Caption1>
              <Caption1 className={styles.hkMuted}>
                当前值：<code>{currentLabel}</code>
              </Caption1>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              取消
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
