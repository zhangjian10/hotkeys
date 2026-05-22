//! 热键录制状态机。
//!
//! 使用 egui 内建的输入事件，仅在窗口聚焦时工作；
//! 不开全局 hook，因此不与 daemon 抢键盘事件。

use std::time::{Duration, Instant};

use egui::{Context, Event, Key, Modifiers};
use hotkeys_core::Config;

use crate::app::ToastKind;

/// 录制最长持续时间，超过则自动取消。
const RECORD_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone)]
pub struct RecorderState {
    /// 正在为哪条 hotkey 录制。
    pub target_index: usize,
    /// 录制开始时间。
    pub started_at: Instant,
}

impl RecorderState {
    pub fn new(target_index: usize) -> Self {
        Self {
            target_index,
            started_at: Instant::now(),
        }
    }

    pub fn elapsed(&self) -> Duration {
        self.started_at.elapsed()
    }
}

/// 推进录制状态机。
///
/// 返回 `Some(state)` 表示仍在录制；返回 `None` 表示已结束（成功捕获、Esc 取消、超时）。
pub fn tick(
    ctx: &Context,
    state: RecorderState,
    config: &mut Config,
    toast: &mut dyn FnMut(String, ToastKind),
) -> Option<RecorderState> {
    // 超时
    if state.elapsed() >= RECORD_TIMEOUT {
        toast("录制超时已取消".into(), ToastKind::Info);
        return None;
    }

    // 录制时持续重绘以及时检测超时与按键
    ctx.request_repaint_after(Duration::from_millis(100));

    let events = ctx.input(|i| i.events.clone());
    for event in events {
        if let Event::Key {
            key,
            pressed: true,
            modifiers,
            ..
        } = event
        {
            // Esc 取消
            if key == Key::Escape {
                return None;
            }
            // 跳过纯修饰键事件（egui 不会单独把 Ctrl/Shift 作为 Key 触发，但保险起见）
            if is_modifier_key(key) {
                continue;
            }
            // 把 egui::Key 反查成配置字符串
            let trigger_str = match egui_key_to_trigger_string(key) {
                Some(s) => s,
                None => {
                    toast(format!("不支持的按键: {:?}", key), ToastKind::Error);
                    return None;
                }
            };
            let modifier_str = pick_modifier(modifiers);
            // 写入到目标 hotkey
            if let Some(hk) = config.hotkeys.get_mut(state.target_index) {
                hk.trigger_key = trigger_str.to_string();
                if let Some(m) = modifier_str {
                    hk.modifier_key = m.to_string();
                }
            }
            return None;
        }
    }

    Some(state)
}

fn is_modifier_key(k: Key) -> bool {
    // egui 0.32 中没有专门的 Ctrl/Shift/Alt/Meta Key 枚举值（修饰键通过 Modifiers 反映），
    // 这里仅作占位，未来若 egui 增加相关 Key，可在此过滤。
    let _ = k;
    false
}

/// 从 `Modifiers` 中按优先级选一个修饰键名称。
/// Ctrl > Alt > Shift > Meta（日常游戏热键习惯）。
fn pick_modifier(m: Modifiers) -> Option<&'static str> {
    if m.ctrl || m.command {
        Some("Ctrl")
    } else if m.alt {
        Some("Alt")
    } else if m.shift {
        Some("Shift")
    } else if m.mac_cmd {
        Some("Meta")
    } else {
        None
    }
}

/// 把 `egui::Key` 直接映射成 `ALL_TRIGGERS` 中的字符串。
/// 不通过 rdev 中转，避免 GUI crate 引入 rdev 依赖。
fn egui_key_to_trigger_string(k: Key) -> Option<&'static str> {
    use egui::Key as K;
    let s = match k {
        K::A => "A", K::B => "B", K::C => "C", K::D => "D", K::E => "E",
        K::F => "F", K::G => "G", K::H => "H", K::I => "I", K::J => "J",
        K::K => "K", K::L => "L", K::M => "M", K::N => "N", K::O => "O",
        K::P => "P", K::Q => "Q", K::R => "R", K::S => "S", K::T => "T",
        K::U => "U", K::V => "V", K::W => "W", K::X => "X", K::Y => "Y",
        K::Z => "Z",
        K::Num0 => "Num0", K::Num1 => "Num1", K::Num2 => "Num2",
        K::Num3 => "Num3", K::Num4 => "Num4", K::Num5 => "Num5",
        K::Num6 => "Num6", K::Num7 => "Num7", K::Num8 => "Num8",
        K::Num9 => "Num9",
        K::F1 => "F1", K::F2 => "F2", K::F3 => "F3", K::F4 => "F4",
        K::F5 => "F5", K::F6 => "F6", K::F7 => "F7", K::F8 => "F8",
        K::F9 => "F9", K::F10 => "F10", K::F11 => "F11", K::F12 => "F12",
        K::Backtick => "BackQuote",
        _ => return None,
    };
    Some(s)
}
