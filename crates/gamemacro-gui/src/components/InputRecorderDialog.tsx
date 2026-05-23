import { useEffect, useRef, useState } from "react";
import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Record20Filled } from "@fluentui/react-icons";

import { engineEnabled, setEngineEnabled } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export interface InputRecorderDialogProps {
  open: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

function appendKey(value: string, e: KeyboardEvent): string {
  if (e.key === "Enter") return `${value}\n`;
  if (e.key === "Tab") return `${value}\t`;
  if (e.key === "Backspace") return value.slice(0, -1);
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) return `${value}${e.key}`;
  return value;
}

export function InputRecorderDialog({
  open,
  initialValue,
  onCancel,
  onSave,
}: InputRecorderDialogProps) {
  const styles = useStyles();
  const [draft, setDraft] = useState(initialValue);
  const engineWasEnabledRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!open) return;

    setDraft(initialValue);
    let alive = true;

    void engineEnabled()
      .then((enabled) => {
        if (!alive) return;
        engineWasEnabledRef.current = enabled;
        if (enabled) return setEngineEnabled(false);
      })
      .catch(() => {
        engineWasEnabledRef.current = null;
      });

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      setDraft((cur) => appendKey(cur, e));
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData("text") ?? "";
      if (text) setDraft((cur) => cur + text);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste, true);

    return () => {
      alive = false;
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("paste", onPaste, true);
      const shouldRestore = engineWasEnabledRef.current;
      engineWasEnabledRef.current = null;
      if (shouldRestore) void setEngineEnabled(true);
    };
  }, [open, initialValue, onCancel]);

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => !d.open && onCancel()}
      modalType="alert"
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>录制输入内容</DialogTitle>
          <DialogContent>
            <div className={styles.inputRecorderBox}>
              <div className={styles.recorderDot}>
                <Record20Filled
                  style={{ color: tokens.colorPaletteRedForeground1 }}
                />
                <span>正在录制输入…</span>
              </div>
              <Textarea
                value={draft}
                readOnly
                rows={6}
                resize="vertical"
                className={styles.inputRecorderTextarea}
              />
              <Caption1 className={styles.hkMuted}>
                会记录键盘输入的字符；Enter 记录换行，Backspace 删除，Esc 取消。
              </Caption1>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setDraft("")}>
              清空
            </Button>
            <Button appearance="secondary" onClick={onCancel}>
              取消
            </Button>
            <Button appearance="primary" onClick={() => onSave(draft)}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
