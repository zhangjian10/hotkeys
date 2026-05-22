import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  Search20Regular,
  Window20Regular,
} from "@fluentui/react-icons";
import { listWindows, type WindowInfo } from "../lib/api";
import { useStyles } from "../styles/useStyles";

export interface WindowPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (title: string) => void;
}

export function WindowPickerDialog({
  open,
  onOpenChange,
  onPick,
}: WindowPickerDialogProps) {
  const styles = useStyles();
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  /** 仅首次加载时显示占位；手动刷新不影响列表渲染 */
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("");
  /** 用 hwnd 跟踪选中项，刷新后仍能保持选中 */
  const [selectedHwnd, setSelectedHwnd] = useState<number | null>(null);

  const fetchWindows = useCallback(async (kind: "initial" | "refresh") => {
    if (kind === "initial") setInitialLoading(true);
    else setRefreshing(true);
    try {
      const list = await listWindows();
      setWindows(list);
      setSelectedHwnd((cur) => {
        // 首次加载默认选第一个；刷新尽量保留原选中项
        if (kind === "initial") return list[0]?.hwnd ?? null;
        if (cur !== null && list.some((w) => w.hwnd === cur)) return cur;
        return list[0]?.hwnd ?? null;
      });
    } finally {
      if (kind === "initial") setInitialLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFilter("");
      setWindows([]);
      setSelectedHwnd(null);
      void fetchWindows("initial");
    }
  }, [open, fetchWindows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return windows;
    return windows.filter((w) => w.title.toLowerCase().includes(q));
  }, [windows, filter]);

  const submit = () => {
    if (selectedHwnd === null) return;
    const w = filtered.find((x) => x.hwnd === selectedHwnd);
    if (w) onPick(w.title);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      modalType="modal"
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>从当前窗口中选择</DialogTitle>
          <DialogContent className={styles.windowPickerBody}>
            <div className={styles.windowPickerRow}>
              <Input
                style={{ flex: 1 }}
                contentBefore={<Search20Regular />}
                placeholder="过滤窗口标题…"
                value={filter}
                onChange={(_, d) => setFilter(d.value)}
              />
              <Button
                appearance="secondary"
                icon={
                  refreshing ? (
                    <Spinner size="tiny" />
                  ) : (
                    <ArrowClockwise20Regular />
                  )
                }
                onClick={() => void fetchWindows("refresh")}
                disabled={initialLoading || refreshing}
              >
                刷新
              </Button>
            </div>

            <div className={styles.windowList}>
              {initialLoading ? (
                <div className={styles.empty}>
                  <Caption1>正在枚举窗口…</Caption1>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                  <Caption1>
                    {windows.length === 0 ? "没有可见窗口" : "没有匹配的窗口"}
                  </Caption1>
                </div>
              ) : (
                filtered.map((w) => (
                  <div
                    key={w.hwnd}
                    className={`${styles.windowItem} ${
                      selectedHwnd === w.hwnd ? styles.windowItemActive : ""
                    }`}
                    onClick={() => setSelectedHwnd(w.hwnd)}
                    onDoubleClick={() => onPick(w.title)}
                    role="option"
                    aria-selected={selectedHwnd === w.hwnd}
                  >
                    <Window20Regular />
                    <span className={styles.windowItemTitle} title={w.title}>
                      {w.title}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              提示：将使用窗口标题作为关键词；如要支持多个版本，可以在添加后手动改成
              <code> %关键字% </code>形式以模糊匹配。
            </Caption1>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle">取消</Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={selectedHwnd === null}
              onClick={submit}
            >
              使用此窗口标题
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
