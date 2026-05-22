use crate::{input::InputManager, state::AppState, window::WindowManager};
use std::{thread, time::Duration};

pub struct AutoInputManager;

impl AutoInputManager {
    pub fn start() {
        thread::spawn(|| {
            // 默认参数（无 profile 命中时使用）
            const FALLBACK_INTERVAL_SECS: u64 = 3;
            const FALLBACK_DELAY_MS: u64 = 50;

            loop {
                // 每次循环都从当前激活 profile 拿最新参数；不命中时退回默认值
                let (interval, delay) = match AppState::get_active_profile() {
                    Some(p) => (p.auto_input_interval_secs, p.input_delay_millis),
                    None => (FALLBACK_INTERVAL_SECS, FALLBACK_DELAY_MS),
                };

                thread::sleep(Duration::from_secs(interval.max(1)));

                let is_active = AppState::is_active();
                let auto_input_list = AppState::get_auto_input_list();

                if is_active {
                    if !auto_input_list.is_empty() {
                        if let Ok(mut input_manager) = InputManager::new() {
                            for input_str in auto_input_list.iter() {
                                input_manager.input_text(input_str);
                                thread::sleep(Duration::from_millis(delay));
                            }
                        }
                    }
                } else if !auto_input_list.is_empty() {
                    AppState::clear_auto_input();
                    println!("Target window is not active. Cleared auto input.");
                }

                // 防止 daemon 启动时尚未触发 SetWinEventHook 回调
                let _ = WindowManager::refresh_state;
            }
        });
    }
}
