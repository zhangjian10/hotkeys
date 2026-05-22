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
                AppState::update_modifier_key_state(key, true);

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
                AppState::update_modifier_key_state(key, false);
            }
            _ => {}
        }
    }

    fn find_matching_hotkey(trigger_key: RdevKey) -> Option<String> {
        let profile = AppState::get_active_profile()?;
        let modifier_keys = AppState::get_modifier_keys_state();

        for hotkey_config in &profile.hotkeys {
            if let (Some(config_modifier), Some(config_trigger)) = (
                string_to_rdev_key(&hotkey_config.modifier_key),
                string_to_rdev_key(&hotkey_config.trigger_key),
            ) {
                if config_trigger == trigger_key {
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
        println!("loaded {} profile(s):", config.profiles.len());
        for (pi, profile) in config.profiles.iter().enumerate() {
            println!();
            println!(
                "  [{}] {}  (keywords: {:?})",
                pi, profile.name, profile.window_keywords
            );
            println!(
                "      auto interval: {}s, key delay: {}ms",
                profile.auto_input_interval_secs, profile.input_delay_millis
            );
            for (i, hk) in profile.hotkeys.iter().enumerate() {
                let desc = hk.description.as_deref().unwrap_or("no description");
                println!(
                    "      {}. {} + {} -> {} ({})",
                    i + 1,
                    hk.modifier_key,
                    hk.trigger_key,
                    hk.input_string.replace('\n', " "),
                    desc
                );
            }
        }
        println!();
    }
}
