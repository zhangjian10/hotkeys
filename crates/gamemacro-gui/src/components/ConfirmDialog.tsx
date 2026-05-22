import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";

export interface ConfirmDialogProps {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

/** 通用二次确认对话框（破坏性操作） */
export function ConfirmDialog({
  open,
  label,
  onCancel,
  onConfirm,
  confirmText = "删除",
  cancelText = "取消",
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => !d.open && onCancel()}
      modalType="alert"
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>{label}</DialogContent>
          <DialogActions>
            <Button appearance="subtle" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button appearance="primary" onClick={onConfirm}>
              {confirmText}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
