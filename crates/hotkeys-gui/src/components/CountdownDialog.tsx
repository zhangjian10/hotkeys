import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import { useStyles } from "../styles/useStyles";

export interface CountdownDialogProps {
  open: boolean;
  left: number;
  onCancel: () => void;
}

/**
 * 「试一下」倒计时对话框：
 * 用户切换到目标窗口期间，弹出一个非阻塞的倒计时提示。
 */
export function CountdownDialog({
  open,
  left,
  onCancel,
}: CountdownDialogProps) {
  const styles = useStyles();
  return (
    <Dialog open={open} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>切换到目标窗口</DialogTitle>
          <DialogContent>
            <div className={styles.countdownBox}>
              <span className={styles.countdownNum}>{left}</span>
              <Caption1>
                请立即把鼠标点到目标输入框（聊天框、记事本…），
                <br />
                倒计时结束后会把内容自动敲进去。
              </Caption1>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onCancel}>
              取消
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
