// 通过浏览器 keydown 事件捕获组合键。
//
// 设计：
// - 用户点录制按钮进入录制态，对 `window` 临时挂载 keydown 监听
// - 按下纯修饰键时累积到 modifier set，并通过 onProgress 把当前集合回报给 UI
//   （不结束录制——继续等用户按非修饰键作为 trigger）
// - 按下非纯修饰键时根据当时的 modifier set + 该键作为 trigger 完成捕获
// - 也接受 e.ctrlKey/altKey/shiftKey/metaKey 作为补充：用户若一次性按下
//   Ctrl+Shift+S，单次事件就能拿到完整组合键
// - Esc 取消、Tab/Enter 等会被 preventDefault 吞掉避免焦点切换

import { ALL_MODIFIERS, ALL_TRIGGERS } from "./api";

export interface RecordedCombo {
  /** 修饰键集合（来自 ALL_MODIFIERS），已按字典序排序去重；可能为空。 */
  modifiers: string[];
  /** 触发键（必定来自 ALL_TRIGGERS） */
  trigger: (typeof ALL_TRIGGERS)[number];
}

export type RecordResult =
  | { kind: "captured"; combo: RecordedCombo }
  | { kind: "cancelled" }
  | { kind: "unsupported"; raw: string };

export interface StartOptions {
  /** 用户按下纯修饰键时实时回调当前 modifier set；UI 用于显示已按下的徽章。 */
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

/** 从一个 KeyboardEvent 的 ctrlKey/altKey/... 标志位收集修饰键。 */
function flagsToModifiers(e: KeyboardEvent): string[] {
  const out: string[] = [];
  if (e.ctrlKey) out.push("Ctrl");
  if (e.altKey) out.push("Alt");
  if (e.shiftKey) out.push("Shift");
  if (e.metaKey) out.push("Meta");
  return out;
}

function sortedUnique(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

export function startRecording(
  onResult: (result: RecordResult) => void,
  opts: StartOptions = {},
): () => void {
  let done = false;
  const held = new Set<string>();

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
      held.add(mod);
      opts.onProgress?.(sortedUnique([...held]));
      return;
    }

    const trigger = codeToTrigger(e.code);
    if (!trigger) {
      finish({ kind: "unsupported", raw: e.code });
      return;
    }

    // 合并"已累积按下的修饰键"与"事件 flag 上现存的修饰键"——后者能兜住
    // 用户先把 Ctrl 按下 + 在同一 keydown 里立刻按 S 这类极快情况
    const merged = sortedUnique([...held, ...flagsToModifiers(e)]);

    finish({
      kind: "captured",
      combo: {
        modifiers: merged,
        trigger: trigger as RecordedCombo["trigger"],
      },
    });
  };

  // keyup 时把松开的修饰键从 held 里抠掉，并实时回报 UI
  const upListener = (e: KeyboardEvent) => {
    if (done) return;
    const mod = codeToModifier(e.code);
    if (mod && held.delete(mod)) {
      opts.onProgress?.(sortedUnique([...held]));
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
