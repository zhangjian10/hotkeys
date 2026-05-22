// 通过浏览器 keydown 事件捕获组合键。
//
// 设计：
// - 当用户点"录制"按钮时进入"录制态"，对 `window` 临时挂载 keydown 监听
// - 用户按下任意"非纯修饰键"时，把当前修饰键 + 触发键解析成 ALL_MODIFIERS / ALL_TRIGGERS
//   规定的字符串
// - Esc 取消、Tab/Enter 等会被 preventDefault 吞掉避免焦点切换

import { ALL_MODIFIERS, ALL_TRIGGERS } from "./api";

export interface RecordedCombo {
  /** 修饰键（"Ctrl" / "Alt" / "Shift" / "Meta"），允许 null 表示无修饰键 */
  modifier: (typeof ALL_MODIFIERS)[number] | null;
  /** 触发键（必定来自 ALL_TRIGGERS） */
  trigger: (typeof ALL_TRIGGERS)[number];
}

export type RecordResult =
  | { kind: "captured"; combo: RecordedCombo }
  | { kind: "cancelled" }
  | { kind: "unsupported"; raw: string };

/** 把 KeyboardEvent.code 映射到 ALL_TRIGGERS 中的字符串 */
function codeToTrigger(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6)
    return "Num" + code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (code === "Backquote") return "BackQuote";
  return null;
}

function isPureModifier(code: string): boolean {
  return (
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "AltLeft" ||
    code === "AltRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "MetaLeft" ||
    code === "MetaRight"
  );
}

function pickModifier(e: KeyboardEvent): RecordedCombo["modifier"] {
  if (e.ctrlKey) return "Ctrl";
  if (e.altKey) return "Alt";
  if (e.shiftKey) return "Shift";
  if (e.metaKey) return "Meta";
  return null;
}

export function startRecording(
  onResult: (result: RecordResult) => void,
): () => void {
  let done = false;
  const listener = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (done) return;

    if (e.code === "Escape") {
      finish({ kind: "cancelled" });
      return;
    }
    if (isPureModifier(e.code)) return;

    const trigger = codeToTrigger(e.code);
    if (!trigger) {
      finish({ kind: "unsupported", raw: e.code });
      return;
    }
    finish({
      kind: "captured",
      combo: {
        modifier: pickModifier(e),
        trigger: trigger as RecordedCombo["trigger"],
      },
    });
  };

  function finish(r: RecordResult) {
    if (done) return;
    done = true;
    window.removeEventListener("keydown", listener, true);
    onResult(r);
  }

  window.addEventListener("keydown", listener, true);
  return () => finish({ kind: "cancelled" });
}
