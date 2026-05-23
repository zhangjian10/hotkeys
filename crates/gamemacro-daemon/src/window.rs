use crate::hotkey::HotkeyManager;
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

    /// 刷新激活状态：根据当前前台窗口标题在所有 profile 中找匹配。
    /// 失活时（任何 profile 都不命中）顺手取消所有进行中的循环——
    /// 用户切到别的窗口不应继续被自动输入打扰。
    pub fn refresh_state() {
        let was_active = AppState::is_active();
        let title = Self::current_title_lower();
        let cfg = AppState::get_config();
        let active_idx = title.as_deref().and_then(|t| cfg.active_profile_index(t));
        let now_active = active_idx.is_some();

        AppState::set_active(now_active);
        AppState::set_active_profile(active_idx);

        if was_active && !now_active {
            HotkeyManager::cancel_all();
        }
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
