use crate::state::AppState;
use hotkeys_core::string_to_rdev_key;
use rdev::{Event, EventType, Key as RdevKey};

pub struct HotkeyManager;

impl HotkeyManager {
    pub fn handle_key_event(event: Event) {
        if !AppState::is_active() {
            return;
        }

        match event.event_type {
            EventType::KeyPress(key) => {
                // 更新修饰键状态
                AppState::update_modifier_key_state(key, true);

                // 检查是否匹配任何热键配置
                if let Some(input_str) = Self::find_matching_hotkey(key) {
                    println!("Hotkey triggered: {}", input_str.replace('\n', " "));
                    if AppState::contains_auto_input(&input_str) {
                        println!(
                            "stop {}",
                            &input_str.split('\n').collect::<Vec<_>>().join(" ")
                        );
                        AppState::remove_auto_input(&input_str);
                    } else {
                        println!(
                            "start {}",
                            &input_str.split('\n').collect::<Vec<_>>().join(" ")
                        );
                        AppState::add_auto_input(input_str);
                    }
                }
            }
            EventType::KeyRelease(key) => {
                // 更新修饰键状态
                AppState::update_modifier_key_state(key, false);
            }
            _ => {}
        }
    }

    fn find_matching_hotkey(trigger_key: RdevKey) -> Option<String> {
        let config = AppState::get_config();
        let modifier_keys = AppState::get_modifier_keys_state();

        for hotkey_config in &config.hotkeys {
            // 转换配置中的键名到 RdevKey
            if let (Some(config_modifier), Some(config_trigger)) = (
                string_to_rdev_key(&hotkey_config.modifier_key),
                string_to_rdev_key(&hotkey_config.trigger_key),
            ) {
                if config_trigger == trigger_key {
                    // 检查修饰键是否被按下
                    if let Some(&pressed) = modifier_keys.get(&config_modifier) {
                        if pressed {
                            return Some(hotkey_config.input_string.clone());
                        }
                    }
                }
            }
        }
        None
    }

    pub fn print_hotkey_configs() {
        let config = AppState::get_config();
        println!("current hotkey configurations:");
        println!("keywords to identify window: {:?}", config.window_keywords);
        println!(
            "auto input interval (secs): {}",
            config.auto_input_interval_secs
        );
        println!("input delay (millis): {}", config.input_delay_millis);
        println!("hotkeys:");
        for (i, hotkey) in config.hotkeys.iter().enumerate() {
            let description = hotkey.description.as_deref().unwrap_or("no description");
            println!(
                "  {}. {} + {} -> {} ({})",
                i + 1,
                hotkey.modifier_key,
                hotkey.trigger_key,
                hotkey.input_string.replace('\n', " "),
                description
            );
        }
        println!();
    }
}
