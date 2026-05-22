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

    /// 取当前前台窗口标题（小写化）
    fn current_title_lower() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut title: Vec<u16> = vec![0; MAX_PATH];
            let len = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
            if len <= 0 {
                return None;
            }
            let title = OsString::from_wide(&title[..len as usize]);
            Some(title.to_string_lossy().to_lowercase())
        }
    }

    /// 刷新激活状态：根据当前前台窗口标题在所有 profile 中找匹配
    pub fn refresh_state() {
        let title = Self::current_title_lower();
        let cfg = AppState::get_config();
        let active_idx = title.as_deref().and_then(|t| cfg.active_profile_index(t));
        AppState::set_active(active_idx.is_some());
        AppState::set_active_profile(active_idx);
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
