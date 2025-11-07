use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

const CONFIG_TOML: &str = include_str!("../hotkeys.toml");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub modifier_key: String,        // "Alt", "Ctrl", "Shift", "Meta"
    pub trigger_key: String,         // "BackQuote", "Num1", "F1", etc.
    pub input_string: String,        // String to be input
    pub description: Option<String>, // Optional description
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub window_keywords: Vec<String>,
    pub hotkeys: Vec<HotkeyConfig>,
    pub auto_input_interval_secs: u64,
    pub input_delay_millis: u64,
}

impl Default for Config {
    fn default() -> Self {
        toml::from_str(CONFIG_TOML).expect("Failed to parse default config")
    }
}

impl Config {
    pub fn load_or_create(config_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        if Path::new(config_path).exists() {
            let content = fs::read_to_string(config_path)?;
            let config: Config = toml::from_str(&content)?;
            Ok(config)
        } else {
            let default_config = Config::default();
            default_config.save(config_path)?;
            println!(
                "Config file not found, created default config at {}",
                config_path
            );
            Ok(default_config)
        }
    }

    pub fn save(&self, config_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.clone();
        let toml_string = toml::to_string(&config)?;
        fs::write(config_path, toml_string)?;
        Ok(())
    }
}

pub fn string_to_rdev_key(key_str: &str) -> Option<rdev::Key> {
    use rdev::Key;
    let key = match key_str {
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
    };
    key
}
