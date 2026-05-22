use rdev::Key;

/// 修饰键候选（GUI 下拉框使用）。
pub const ALL_MODIFIERS: &[&str] = &["Ctrl", "Alt", "Shift", "Meta"];

/// 触发键候选（GUI 下拉框使用）。按"特殊键、数字键、功能键、字母键"分组。
pub const ALL_TRIGGERS: &[&str] = &[
    "BackQuote",
    "Num0", "Num1", "Num2", "Num3", "Num4", "Num5", "Num6", "Num7", "Num8", "Num9",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

/// 把配置字符串转成 rdev::Key。
pub fn string_to_rdev_key(key_str: &str) -> Option<Key> {
    match key_str {
        "Alt" => Some(Key::Alt),
        "ControlLeft" | "Ctrl" => Some(Key::ControlLeft),
        "ControlRight" => Some(Key::ControlRight),
        "ShiftLeft" | "Shift" => Some(Key::ShiftLeft),
        "ShiftRight" => Some(Key::ShiftRight),
        "MetaLeft" | "Meta" => Some(Key::MetaLeft),
        "MetaRight" => Some(Key::MetaRight),
        "BackQuote" => Some(Key::BackQuote),
        "Num1" => Some(Key::Num1),
        "Num2" => Some(Key::Num2),
        "Num3" => Some(Key::Num3),
        "Num4" => Some(Key::Num4),
        "Num5" => Some(Key::Num5),
        "Num6" => Some(Key::Num6),
        "Num7" => Some(Key::Num7),
        "Num8" => Some(Key::Num8),
        "Num9" => Some(Key::Num9),
        "Num0" => Some(Key::Num0),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        "A" => Some(Key::KeyA),
        "B" => Some(Key::KeyB),
        "C" => Some(Key::KeyC),
        "D" => Some(Key::KeyD),
        "E" => Some(Key::KeyE),
        "F" => Some(Key::KeyF),
        "G" => Some(Key::KeyG),
        "H" => Some(Key::KeyH),
        "I" => Some(Key::KeyI),
        "J" => Some(Key::KeyJ),
        "K" => Some(Key::KeyK),
        "L" => Some(Key::KeyL),
        "M" => Some(Key::KeyM),
        "N" => Some(Key::KeyN),
        "O" => Some(Key::KeyO),
        "P" => Some(Key::KeyP),
        "Q" => Some(Key::KeyQ),
        "R" => Some(Key::KeyR),
        "S" => Some(Key::KeyS),
        "T" => Some(Key::KeyT),
        "U" => Some(Key::KeyU),
        "V" => Some(Key::KeyV),
        "W" => Some(Key::KeyW),
        "X" => Some(Key::KeyX),
        "Y" => Some(Key::KeyY),
        "Z" => Some(Key::KeyZ),
        _ => None,
    }
}

/// 把 rdev::Key 反查成配置字符串。
/// 仅覆盖 [`ALL_TRIGGERS`] 中的键，其它返回 `None`。
pub fn key_to_string(key: Key) -> Option<&'static str> {
    let s = match key {
        Key::BackQuote => "BackQuote",
        Key::Num0 => "Num0",
        Key::Num1 => "Num1",
        Key::Num2 => "Num2",
        Key::Num3 => "Num3",
        Key::Num4 => "Num4",
        Key::Num5 => "Num5",
        Key::Num6 => "Num6",
        Key::Num7 => "Num7",
        Key::Num8 => "Num8",
        Key::Num9 => "Num9",
        Key::F1 => "F1",
        Key::F2 => "F2",
        Key::F3 => "F3",
        Key::F4 => "F4",
        Key::F5 => "F5",
        Key::F6 => "F6",
        Key::F7 => "F7",
        Key::F8 => "F8",
        Key::F9 => "F9",
        Key::F10 => "F10",
        Key::F11 => "F11",
        Key::F12 => "F12",
        Key::KeyA => "A",
        Key::KeyB => "B",
        Key::KeyC => "C",
        Key::KeyD => "D",
        Key::KeyE => "E",
        Key::KeyF => "F",
        Key::KeyG => "G",
        Key::KeyH => "H",
        Key::KeyI => "I",
        Key::KeyJ => "J",
        Key::KeyK => "K",
        Key::KeyL => "L",
        Key::KeyM => "M",
        Key::KeyN => "N",
        Key::KeyO => "O",
        Key::KeyP => "P",
        Key::KeyQ => "Q",
        Key::KeyR => "R",
        Key::KeyS => "S",
        Key::KeyT => "T",
        Key::KeyU => "U",
        Key::KeyV => "V",
        Key::KeyW => "W",
        Key::KeyX => "X",
        Key::KeyY => "Y",
        Key::KeyZ => "Z",
        _ => return None,
    };
    Some(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_triggers_roundtrip() {
        for &name in ALL_TRIGGERS {
            let key = string_to_rdev_key(name)
                .unwrap_or_else(|| panic!("string_to_rdev_key failed for {name}"));
            let back = key_to_string(key)
                .unwrap_or_else(|| panic!("key_to_string failed for {name}"));
            assert_eq!(back, name, "roundtrip mismatch for {name}");
        }
    }

    #[test]
    fn all_modifiers_resolve() {
        for &name in ALL_MODIFIERS {
            assert!(
                string_to_rdev_key(name).is_some(),
                "modifier {name} should resolve"
            );
        }
    }
}
