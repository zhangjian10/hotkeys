use crate::state::AppState;
use std::{ffi::OsString, os::windows::ffi::OsStringExt};
use winapi::{
    shared::minwindef::MAX_PATH,
    um::winuser::{EVENT_SYSTEM_FOREGROUND, SetWinEventHook, WINEVENT_OUTOFCONTEXT},
    um::winuser::{GetForegroundWindow, GetWindowTextW},
};

pub struct WindowManager;

impl WindowManager {
    pub fn init_window_hook() -> Result<(), Box<dyn std::error::Error>> {
        unsafe {
            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                std::ptr::null_mut(),
                Some(foreground_window_change_callback),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            );
        }
        Ok(())
    }

    pub fn is_window_active() -> bool {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return false;
            }

            // 获取窗口标题
            let mut title: Vec<u16> = vec![0; MAX_PATH];
            let len = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
            if len > 0 {
                let title = OsString::from_wide(&title[..len as usize]);
                let title_str = title.to_string_lossy().to_lowercase();

                // 从配置中获取关键词
                let config = AppState::get_config();
                for keyword in &config.window_keywords {
                    if keyword.contains('%') {
                        // 模糊匹配：只要标题包含去掉%的关键字即可
                        let fuzzy_keyword = keyword.replace('%', "").to_lowercase();
                        if title_str.contains(&fuzzy_keyword) {
                            return true;
                        }
                    } else {
                        // 精确匹配
                        if title_str.eq(&keyword.to_lowercase()) {
                            return true;
                        }
                    }
                }
            }
            false
        }
    }

    pub fn refresh_state() {
        let current_status = Self::is_window_active();
        AppState::set_active(current_status);
    }
}

unsafe extern "system" fn foreground_window_change_callback(
    _hwineventhook: winapi::shared::windef::HWINEVENTHOOK,
    _event: u32,
    _hwnd: winapi::shared::windef::HWND,
    _idobject: i32,
    _idchild: i32,
    _ideventthread: u32,
    _dwmstime: u32,
) {
    WindowManager::refresh_state();
}
