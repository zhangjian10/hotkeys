use crate::{input::InputManager, state::AppState, window::WindowManager};
use std::{thread, time::Duration};

pub struct AutoInputManager;

impl AutoInputManager {
    pub fn start() {
        thread::spawn(|| {
            let delay = {
                let config = AppState::get_config();
                config.input_delay_millis
            };

            let interval = {
                let config = AppState::get_config();
                config.auto_input_interval_secs
            };

            let mut is_active = WindowManager::is_window_active();

            loop {
                thread::sleep(Duration::from_secs(interval));

                let current_active = WindowManager::is_window_active();
                if current_active == is_active && !current_active {
                    continue;
                }

                let auto_input_list = AppState::get_auto_input_list();
                if current_active && let Ok(mut input_manager) = InputManager::new() {
                    for input_str in auto_input_list.iter() {
                        input_manager.input_text(input_str);
                        thread::sleep(Duration::from_millis(delay));
                    }
                } else if auto_input_list.len() > 0 {
                    AppState::clear_auto_input();
                    println!("Target window is not active. Clear auto input to stop this message.");
                }

                is_active = current_active;
            }
        });
    }
}
