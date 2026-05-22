import { useEffect, useState } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import {
  Dismiss12Regular,
  Square12Regular,
  SquareMultipleRegular,
  Subtract12Regular,
} from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStyles } from "../styles/useStyles";

/**
 * 自绘标题栏（Fluent UI 风）：
 * - 配合 tauri.conf.json 的 decorations:false
 * - 拖拽：data-tauri-drag-region 让 webview 把 mousedown 转发给原生窗口
 * - 双击拖拽区切换最大化（系统默认行为）
 * - 三个窗口按钮使用 Fluent UI Button + 图标，颜色 / hover 走 Fluent token
 *   关闭按钮单独用 className 覆盖为 Win11 红
 */
export function TitleBar({ title }: { title: string }) {
  const styles = useStyles();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const promise = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      void promise.then((un) => un());
    };
  }, []);

  const minimize = () => void getCurrentWindow().minimize();
  const toggleMax = () => void getCurrentWindow().toggleMaximize();
  const close = () => void getCurrentWindow().close();

  return (
    <header className={styles.titleBar} data-tauri-drag-region>
      <div className={styles.titleBarLeft} data-tauri-drag-region>
        <div className={styles.titleBarIcon} data-tauri-drag-region>
          {/* Inline SVG，避免再加资源依赖 */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <rect
              x="1.5"
              y="1.5"
              width="13"
              height="13"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M5 7h2v3M9 5v3h2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className={styles.titleBarTitle} data-tauri-drag-region>
          {title}
        </span>
      </div>

      <div className={styles.titleBarSpacer} data-tauri-drag-region />

      <div className={styles.titleBarActions}>
        <Tooltip content="最小化" relationship="label" withArrow={false}>
          <Button
            appearance="subtle"
            shape="square"
            size="small"
            icon={<Subtract12Regular />}
            className={styles.titleBarBtn}
            onClick={minimize}
            aria-label="最小化"
          />
        </Tooltip>
        <Tooltip
          content={maximized ? "还原" : "最大化"}
          relationship="label"
          withArrow={false}
        >
          <Button
            appearance="subtle"
            shape="square"
            size="small"
            icon={
              maximized ? (
                <SquareMultipleRegular fontSize={12} />
              ) : (
                <Square12Regular />
              )
            }
            className={styles.titleBarBtn}
            onClick={toggleMax}
            aria-label={maximized ? "还原" : "最大化"}
          />
        </Tooltip>
        <Tooltip content="关闭" relationship="label" withArrow={false}>
          <Button
            appearance="subtle"
            shape="square"
            size="small"
            icon={<Dismiss12Regular />}
            className={`${styles.titleBarBtn} ${styles.titleBarClose}`}
            onClick={close}
            aria-label="关闭"
          />
        </Tooltip>
      </div>
    </header>
  );
}
