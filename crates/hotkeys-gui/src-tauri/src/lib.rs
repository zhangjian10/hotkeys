//! Tauri 后端：把 hotkeys-core 的 Config 暴露成 invoke 命令。

use std::path::PathBuf;

use hotkeys_core::Config;
use serde::Serialize;

#[derive(Serialize)]
pub struct ConfigBundle {
    /// 配置文件绝对路径（即使尚未存在）
    pub path: String,
    pub config: Config,
}

#[derive(Serialize, Clone)]
pub struct WindowInfo {
    /// 窗口句柄（u64 表示，方便序列化）
    pub hwnd: u64,
    /// 窗口标题
    pub title: String,
}

/// 解析配置文件路径：优先 GUI exe 同目录的 hotkeys.toml。
fn resolve_config_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        return parent.join("hotkeys.toml");
    }
    PathBuf::from("hotkeys.toml")
}

#[tauri::command]
fn load_config() -> Result<ConfigBundle, String> {
    let path = resolve_config_path();
    let config = if path.exists() {
        Config::load(&path).map_err(|e| format!("加载配置失败：{e}"))?
    } else {
        Config::default()
    };
    Ok(ConfigBundle {
        path: path.to_string_lossy().into_owned(),
        config,
    })
}

#[tauri::command]
fn save_config(config: Config) -> Result<(), String> {
    let path = resolve_config_path();
    config
        .save(&path)
        .map_err(|e| format!("保存配置失败：{e}"))
}

#[tauri::command]
fn reveal_config() -> Result<(), String> {
    let path = resolve_config_path();
    let target: &std::path::Path = if path.exists() {
        path.as_path()
    } else {
        path.parent().unwrap_or(std::path::Path::new("."))
    };
    open_in_explorer(target).map_err(|e| format!("打开失败：{e}"))
}

#[cfg(target_os = "windows")]
fn open_in_explorer(path: &std::path::Path) -> std::io::Result<()> {
    use std::process::Command;
    if path.is_file() {
        Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()?;
    } else {
        Command::new("explorer").arg(path).spawn()?;
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn open_in_explorer(path: &std::path::Path) -> std::io::Result<()> {
    use std::process::Command;
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(target_os = "linux")]
    let cmd = "xdg-open";
    Command::new(cmd).arg(path).spawn()?;
    Ok(())
}

/* ============================================================================
 * 窗口枚举
 * ========================================================================== */

#[tauri::command]
fn list_windows() -> Result<Vec<WindowInfo>, String> {
    list_windows_impl().map_err(|e| format!("枚举窗口失败：{e}"))
}

#[cfg(target_os = "windows")]
fn list_windows_impl() -> Result<Vec<WindowInfo>, String> {
    use std::{ffi::OsString, os::windows::ffi::OsStringExt};
    use winapi::{
        shared::{
            minwindef::{BOOL, LPARAM, TRUE},
            windef::HWND,
        },
        um::winuser::{EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible},
    };

    // 在回调中收集窗口（指针由 EnumWindows 透传 lparam）
    extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            if IsWindowVisible(hwnd) == 0 {
                return TRUE;
            }
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return TRUE;
            }
            // 申请 len + 1（包含 null）
            let mut buf: Vec<u16> = vec![0; (len as usize) + 1];
            let read = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if read <= 0 {
                return TRUE;
            }
            let title = OsString::from_wide(&buf[..read as usize])
                .to_string_lossy()
                .into_owned();
            if title.trim().is_empty() {
                return TRUE;
            }
            let list = &mut *(lparam as *mut Vec<WindowInfo>);
            list.push(WindowInfo {
                hwnd: hwnd as usize as u64,
                title,
            });
            TRUE
        }
    }

    let mut list: Vec<WindowInfo> = Vec::with_capacity(64);
    let lparam = (&mut list as *mut Vec<WindowInfo>) as LPARAM;
    let ok = unsafe { EnumWindows(Some(enum_proc), lparam) };
    if ok == 0 {
        // EnumWindows 在回调返回 FALSE 时返回 0；这里我们一直返回 TRUE，理论不会
        // 但有些极端情况（Win32 错误）也会返回 0，按错误处理
        return Err("EnumWindows 返回失败".into());
    }

    // 去重：相同标题只保留一个
    list.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    list.dedup_by(|a, b| a.title == b.title);
    Ok(list)
}

#[cfg(not(target_os = "windows"))]
fn list_windows_impl() -> Result<Vec<WindowInfo>, String> {
    Ok(Vec::new())
}

/* ============================================================================
 * Tauri 启动
 * ========================================================================== */

/// 应用启动：注册命令
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            reveal_config,
            list_windows
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 失败");
}
