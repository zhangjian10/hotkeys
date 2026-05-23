//! Tauri 后端：把 gamemacro-core 的 Config + gamemacro-engine 的运行状态
//! 暴露成 invoke 命令。整合后 engine 与 GUI 同进程，无 IPC。

use std::path::PathBuf;

use enigo::{Enigo, Keyboard, Settings};
use gamemacro_core::Config;
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

/// 解析配置文件路径：优先 GUI exe 同目录的 gamemacro.toml。
/// engine 的配置 watcher 与 load 用同一个路径。
fn resolve_config_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        return parent.join("gamemacro.toml");
    }
    PathBuf::from("gamemacro.toml")
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

/// 取当前前台窗口的标题；用于 GUI 在"窗口匹配"页实时显示活动窗口。
#[tauri::command]
fn current_foreground_title() -> Result<String, String> {
    foreground_title_impl().map_err(|e| format!("读取前台窗口失败：{e}"))
}

/// 试一下：把 input_string 通过 enigo 敲到当前焦点窗口。
///
/// 注意：调用前需要让用户切换到目标窗口（GUI 端通常配合一个倒计时）。
/// 与 engine 行为保持一致：原样输入，不自动加首尾回车。
#[tauri::command]
fn try_input(text: String) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.text(&text).map_err(|e| e.to_string())?;
    Ok(())
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

    extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            if IsWindowVisible(hwnd) == 0 {
                return TRUE;
            }
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return TRUE;
            }
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
        return Err("EnumWindows 返回失败".into());
    }

    list.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    list.dedup_by(|a, b| a.title == b.title);
    Ok(list)
}

#[cfg(not(target_os = "windows"))]
fn list_windows_impl() -> Result<Vec<WindowInfo>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
fn foreground_title_impl() -> Result<String, String> {
    use std::{ffi::OsString, os::windows::ffi::OsStringExt};
    use winapi::shared::minwindef::MAX_PATH;
    use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return Ok(String::new());
        }
        let mut buf: Vec<u16> = vec![0; MAX_PATH];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len <= 0 {
            return Ok(String::new());
        }
        Ok(OsString::from_wide(&buf[..len as usize])
            .to_string_lossy()
            .into_owned())
    }
}

#[cfg(not(target_os = "windows"))]
fn foreground_title_impl() -> Result<String, String> {
    Ok(String::new())
}

/* ============================================================================
 * Engine 状态 / 控制（进程内直调，无 IPC）
 * ========================================================================== */

#[derive(Serialize, Default)]
pub struct EngineStatus {
    /// 命中某 profile（窗口聚焦匹配）
    pub active: bool,
    /// 用户开关：是否启用热键监听
    pub enabled: bool,
    /// 激活的 profile 名；未激活 = None
    pub profile: Option<String>,
    /// 激活的 profile 在 Config.profiles 中的索引
    pub profile_index: Option<usize>,
}

#[tauri::command]
fn engine_status() -> EngineStatus {
    let snap = gamemacro_engine::AppState::snapshot();
    EngineStatus {
        active: snap.active,
        enabled: snap.enabled,
        profile: snap.profile_name,
        profile_index: snap.profile_index,
    }
}

#[tauri::command]
fn set_engine_enabled(enabled: bool) {
    gamemacro_engine::set_enabled(enabled);
}

#[tauri::command]
fn engine_enabled() -> bool {
    gamemacro_engine::is_enabled()
}

/// 在资源管理器中定位日志文件：`%LOCALAPPDATA%\GameMacro\gamemacro.log`。
/// engine 启动时已确保文件存在。
#[tauri::command]
fn reveal_log() -> Result<(), String> {
    let path = log_file_path().ok_or_else(|| "无法定位日志路径".to_string())?;
    let target: &std::path::Path = if path.exists() {
        path.as_path()
    } else {
        path.parent().unwrap_or(std::path::Path::new("."))
    };
    open_in_explorer(target).map_err(|e| format!("打开失败：{e}"))
}

fn log_file_path() -> Option<PathBuf> {
    // 优先用 engine 自己暴露的真实路径；engine 未初始化时回退到约定路径。
    if let Some(p) = gamemacro_engine::log_path() {
        return Some(p.clone());
    }
    let base = std::env::var_os("LOCALAPPDATA")?;
    let mut p = PathBuf::from(base);
    p.push("GameMacro");
    p.push("gamemacro.log");
    Some(p)
}

/* ============================================================================
 * Tauri 启动
 * ========================================================================== */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 1) 拉起 engine：所有后台线程（hotkey / watcher / loop runtime / input worker）
            //    在此 spawn。失败 = engine 不可用，但 GUI 仍然可以编辑配置。
            //    （理论上失败极少：input worker 起不来 / win event hook 失败 / hotkey 线程 spawn 失败）
            if let Err(e) = gamemacro_engine::start(resolve_config_path()) {
                eprintln!("engine start failed: {e:?}");
            }

            // 2) 兜底：窗口启动时 visible:false，由前端在首屏 paint 后 show()。
            //    万一前端没能调用 show，3s 后强制显示，避免"进程在跑但界面永不出现"。
            use tauri::Manager;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                if let Some(win) = handle.get_webview_window("main") {
                    if let Ok(visible) = win.is_visible() {
                        if !visible {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            reveal_config,
            list_windows,
            current_foreground_title,
            try_input,
            engine_status,
            engine_enabled,
            set_engine_enabled,
            reveal_log,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 失败");
}
