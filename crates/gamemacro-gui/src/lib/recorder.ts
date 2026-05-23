// 通过浏览器 keydown 事件捕获组合键。
//
// 设计：
// - 用户点录制按钮进入录制态，对 `window` 临时挂载 keydown 监听
// - 按下纯修饰键时**按按下顺序**追加到数组（已在数组中则跳过），
//   并通过 onProgress 实时回报当前序列
// - 按下非纯修饰键时根据当时的 modifier 序列 + 该键作为 trigger 完成捕获
// - Esc 取消、Tab/Enter 等会被 preventDefault 吞掉避免焦点切换

import { ALL_MODIFIERS, ALL_TRIGGERS } from "./api";

export interface RecordedCombo {
  /** 修饰键序列（按按下顺序，可能为空） */
  modifiers: string[];
  /** 触发键（必定来自 ALL_TRIGGERS） */
  trigger: (typeof ALL_TRIGGERS)[number];
}

export type RecordResult =
  | { kind: "captured"; combo: RecordedCombo }
  | { kind: "cancelled" }
  | { kind: "unsupported"; raw: string };

export interface StartOptions {
  /** 用户按下纯修饰键时实时回调当前序列；UI 用于显示已按下的徽章。 */
  onProgress?: (modifiers: string[]) => void;
}

/** 把 KeyboardEvent.code 映射到 ALL_TRIGGERS 中的字符串 */
function codeToTrigger(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6)
    return "Num" + code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (code === "Backquote") return "BackQuote";
  return null;
}

/** 纯修饰键 KeyboardEvent.code → ALL_MODIFIERS 中的标准名。 */
function codeToModifier(code: string): (typeof ALL_MODIFIERS)[number] | null {
  if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
  if (code === "AltLeft" || code === "AltRight") return "Alt";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "MetaLeft" || code === "MetaRight") return "Meta";
  return null;
}

export function startRecording(
  onResult: (result: RecordResult) => void,
  opts: StartOptions = {},
): () => void {
  let done = false;
  /** 按按下顺序追加；不重复 */
  const sequence: string[] = [];

  const listener = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (done) return;

    if (e.code === "Escape") {
      finish({ kind: "cancelled" });
      return;
    }

    const mod = codeToModifier(e.code);
    if (mod) {
      if (!sequence.includes(mod)) {
        sequence.push(mod);
        opts.onProgress?.([...sequence]);
      }
      return;
    }

    const trigger = codeToTrigger(e.code);
    if (!trigger) {
      finish({ kind: "unsupported", raw: e.code });
      return;
    }

    finish({
      kind: "captured",
      combo: {
        modifiers: [...sequence],
        trigger: trigger as RecordedCombo["trigger"],
      },
    });
  };

  // keyup 时把松开的修饰键从序列里移除，并实时回报 UI
  const upListener = (e: KeyboardEvent) => {
    if (done) return;
    const mod = codeToModifier(e.code);
    if (!mod) return;
    const idx = sequence.indexOf(mod);
    if (idx >= 0) {
      sequence.splice(idx, 1);
      opts.onProgress?.([...sequence]);
    }
  };

  function finish(r: RecordResult) {
    if (done) return;
    done = true;
    window.removeEventListener("keydown", listener, true);
    window.removeEventListener("keyup", upListener, true);
    onResult(r);
  }

  window.addEventListener("keydown", listener, true);
  window.addEventListener("keyup", upListener, true);
  return () => finish({ kind: "cancelled" });
}

