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
          <GameMacroIcon />
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

function GameMacroIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gamemacro-title-bg" x1="2" y1="2" x2="14" y2="14">
          <stop stopColor="#604EFF" />
          <stop offset="0.58" stopColor="#175ED2" />
          <stop offset="1" stopColor="#00B1D2" />
        </linearGradient>
        <linearGradient id="gamemacro-title-bolt" x1="8" y1="3" x2="8" y2="13">
          <stop stopColor="#FFE98A" />
          <stop offset="1" stopColor="#FFA500" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="14" height="14" rx="3.5" fill="url(#gamemacro-title-bg)" />
      <path
        d="M4.1 6.2c-.9 0-1.6 1-1.6 2.2 0 1.6 1 2.1 1.9 1.2l.8-.8h5.6l.8.8c.9.9 1.9.4 1.9-1.2 0-1.2-.7-2.2-1.6-2.2-.7 0-1.1.2-1.5.5H5.6c-.4-.3-.8-.5-1.5-.5Z"
        fill="#F7FBFF"
      />
      <path d="M4.4 8.1h1.8M5.3 7.2V9" stroke="#234A9B" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="10.3" cy="7.7" r="0.45" fill="#234A9B" />
      <circle cx="11.4" cy="8.55" r="0.45" fill="#234A9B" />
      <path
        d="M8.7 3.35 6.85 8.25h1.55L7.55 12.6l2.9-5.65H8.9l.9-3.6H8.7Z"
        fill="url(#gamemacro-title-bolt)"
        stroke="#965400"
        strokeWidth="0.35"
        strokeLinejoin="round"
      />
    </svg>
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
