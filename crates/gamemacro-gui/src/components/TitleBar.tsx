import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStyles } from "../styles/useStyles";

/**
 * 自绘标题栏 —— 1:1 还原 Windows 11 原生窗口按钮：
 *
 * - 容器高度 32px，每个按钮 46×32（Win11 系统默认 caption button 尺寸）
 * - 图标使用 10×10 viewBox + 1px stroke 手绘 SVG，避免 Fluent 12px 字形 icon 偏粗
 * - 颜色 / hover 严格按 WinUI Caption Button 资源字典：
 *   · min/max hover  : rgba(0,0,0,0.0578)
 *   · min/max active : rgba(0,0,0,0.0373)
 *   · close hover    : #C42B1C  + #FFFFFF icon
 *   · close active   : #B5271B  + #FFFFFF icon
 * - 与 tauri.conf.json 的 decorations:false 配合
 *   · header 整条 = data-tauri-drag-region（webview 把 mousedown 转给原生窗口）
 *   · 三个按钮显式标记 data-tauri-drag-region="false" 避免被当成拖拽区
 *   · 双击拖拽区切换最大化由系统提供
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
          {/* 应用图标，14×14 */}
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
        <CaptionButton
          ariaLabel="最小化"
          className={styles.captionBtn}
          onClick={minimize}
        >
          <MinimizeGlyph />
        </CaptionButton>
        <CaptionButton
          ariaLabel={maximized ? "还原" : "最大化"}
          className={styles.captionBtn}
          onClick={toggleMax}
        >
          {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
        </CaptionButton>
        <CaptionButton
          ariaLabel="关闭"
          className={`${styles.captionBtn} ${styles.captionBtnClose}`}
          onClick={close}
        >
          <CloseGlyph />
        </CaptionButton>
      </div>
    </header>
  );
}

/* ============================================================================
 * Win11 caption button —— 用原生 <button> 而非 Fluent Button，避免任何额外 padding
 * / focus ring / min-size。data-tauri-drag-region="false" 避免吃掉点击事件。
 * ========================================================================== */
function CaptionButton({
  className,
  ariaLabel,
  onClick,
  children,
}: {
  className: string;
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      data-tauri-drag-region="false"
    >
      {children}
    </button>
  );
}

/* ============================================================================
 * 三个 glyph：完全模拟 WinUI Caption Glyph（Segoe Fluent Icons 中的对应字符）
 * 用 10×10 viewBox + 1px stroke 还原"细线"风格。
 * currentColor 让按钮 hover 状态切换颜色时图标随动。
 * ========================================================================== */

function MinimizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <line
        x1="0"
        y1="5"
        x2="10"
        y2="5"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function MaximizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Win11 还原按钮：两个错位方块（后景方框 + 前景方框） */
function RestoreGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      {/* 后方块（右上） */}
      <path
        d="M2.5 2.5 H9.5 V9.5 H8.5 V3.5 H2.5 Z"
        fill="currentColor"
      />
      {/* 前方块（左下，描边） */}
      <rect
        x="0.5"
        y="2.5"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* 用背景色擦除前方块与后方块的重叠角，让它看起来是错位两层 */}
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <line
        x1="0.5"
        y1="0.5"
        x2="9.5"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="1"
      />
      <line
        x1="9.5"
        y1="0.5"
        x2="0.5"
        y2="9.5"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
