//! Tauri 后端：把 gamemacro-core 的 Config 暴露成 invoke 命令。

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
/// 与 daemon 行为保持一致：原样输入，不自动加首尾回车。
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
 * Tauri 启动
 * ========================================================================== */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 兜底：窗口启动时 visible:false，由前端在首屏 paint 后 show()。
            // 万一前端因任何原因（权限缺失 / JS 异常 / loadConfig 死循环）没能调用 show，
            // 这里 3s 后强制把主窗口显示出来，避免"进程在跑但界面永不出现"。
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
            daemon_status,
            daemon_stop,
            daemon_spawn,
            reveal_log,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 失败");
}

/* ============================================================================
 * Daemon IPC（命名管道：\\.\pipe\gamemacro-daemon）
 * ========================================================================== */

#[derive(Serialize, Default)]
pub struct DaemonStatus {
    /// 进程在跑且 IPC 应答正常
    pub running: bool,
    /// 当前是否激活了某 profile（窗口命中）
    pub active: bool,
    /// 激活的 profile 名；未激活或未运行 = None
    pub profile: Option<String>,
    /// 进程 PID（仅 running 时有意义）
    pub pid: Option<u32>,
}

/// 查询 daemon 状态。失败（连接不上 / 解析失败）= 视作 not running。
/// 不抛 Err，方便前端 2 秒一次轮询不刷红。
#[tauri::command]
fn daemon_status() -> Result<DaemonStatus, String> {
    match query_daemon_status() {
        Some(s) => Ok(s),
        None => Ok(DaemonStatus::default()),
    }
}

/// 远程停止 daemon。
#[tauri::command]
fn daemon_stop() -> Result<(), String> {
    let resp = ipc_round_trip("STOP\n").map_err(|e| format!("发送 STOP 失败：{e}"))?;
    if resp.trim() == "OK" {
        Ok(())
    } else {
        Err(format!("daemon 拒绝停止：{resp:?}"))
    }
}

/// 启动 daemon：ShellExecute runas 同目录的 gamemacro-daemon.exe。
/// daemon 自带 manifest requireAdministrator，所以一定会触发 UAC。
#[tauri::command]
fn daemon_spawn() -> Result<(), String> {
    let exe = daemon_exe_path().ok_or_else(|| "找不到 gamemacro-daemon.exe".to_string())?;
    spawn_elevated(&exe).map_err(|e| format!("启动后端失败：{e}"))
}

/// 在资源管理器中定位 daemon 日志：`%LOCALAPPDATA%\GameMacro\daemon.log`。
#[tauri::command]
fn reveal_log() -> Result<(), String> {
    let path = log_file_path().ok_or_else(|| "无法定位 LOCALAPPDATA".to_string())?;
    let target: &std::path::Path = if path.exists() {
        path.as_path()
    } else {
        path.parent().unwrap_or(std::path::Path::new("."))
    };
    open_in_explorer(target).map_err(|e| format!("打开失败：{e}"))
}

fn log_file_path() -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")?;
    let mut p = PathBuf::from(base);
    p.push("GameMacro");
    p.push("daemon.log");
    Some(p)
}

fn daemon_exe_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let parent = exe.parent()?;
    let candidate = parent.join("gamemacro-daemon.exe");
    if candidate.exists() {
        return Some(candidate);
    }
    // 开发期 fallback：cargo target/debug 同目录
    Some(candidate)
}

#[cfg(target_os = "windows")]
fn query_daemon_status() -> Option<DaemonStatus> {
    let resp = ipc_round_trip("STATUS\n").ok()?;
    parse_status_json(resp.trim())
}

#[cfg(not(target_os = "windows"))]
fn query_daemon_status() -> Option<DaemonStatus> {
    None
}

/// 用最朴素的方式从 daemon 返回的 JSON 里抠出几个字段。
/// daemon 端格式固定，不需要完整 JSON 解析器。
fn parse_status_json(s: &str) -> Option<DaemonStatus> {
    let active = json_bool(s, "active").unwrap_or(false);
    let running = json_bool(s, "running").unwrap_or(false);
    let profile = json_string(s, "profile");
    let pid = json_number(s, "pid").and_then(|n| u32::try_from(n).ok());
    Some(DaemonStatus {
        running,
        active,
        profile,
        pid,
    })
}

fn json_bool(s: &str, key: &str) -> Option<bool> {
    let needle = format!("\"{key}\":");
    let i = s.find(&needle)?;
    let rest = &s[i + needle.len()..].trim_start();
    if rest.starts_with("true") {
        Some(true)
    } else if rest.starts_with("false") {
        Some(false)
    } else {
        None
    }
}

fn json_number(s: &str, key: &str) -> Option<i64> {
    let needle = format!("\"{key}\":");
    let i = s.find(&needle)?;
    let rest = s[i + needle.len()..].trim_start();
    let end = rest
        .find(|c: char| !c.is_ascii_digit() && c != '-')
        .unwrap_or(rest.len());
    rest[..end].parse().ok()
}

fn json_string(s: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\":");
    let i = s.find(&needle)?;
    let rest = s[i + needle.len()..].trim_start();
    if rest.starts_with("null") {
        return None;
    }
    if !rest.starts_with('"') {
        return None;
    }
    let body = &rest[1..];
    // 简化：daemon 这边不会写出转义为 \" 的合法标题（Windows 标题极少含 "），
    // 但仍处理一下 \" 与 \\ 以稳妥
    let mut out = String::with_capacity(body.len());
    let mut chars = body.chars();
    while let Some(c) = chars.next() {
        match c {
            '"' => return Some(out),
            '\\' => match chars.next()? {
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                other => out.push(other),
            },
            other => out.push(other),
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn ipc_round_trip(req: &str) -> Result<String, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use winapi::shared::minwindef::DWORD;
    use winapi::um::fileapi::{CreateFileW, OPEN_EXISTING, ReadFile, WriteFile};
    use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
    use winapi::um::winnt::{FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ, GENERIC_WRITE};

    const PIPE_NAME: &str = r"\\.\pipe\gamemacro-daemon";
    let wide: Vec<u16> = OsStr::new(PIPE_NAME)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            ptr::null_mut(),
            OPEN_EXISTING,
            0,
            ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err("管道未就绪（daemon 未运行？）".into());
    }

    // 写请求
    let mut written: DWORD = 0;
    let ok = unsafe {
        WriteFile(
            handle,
            req.as_ptr() as *const _,
            req.len() as DWORD,
            &mut written,
            ptr::null_mut(),
        )
    };
    if ok == 0 {
        unsafe { CloseHandle(handle) };
        return Err("WriteFile 失败".into());
    }

    // 读响应（读到 EOF / 第一行）
    let mut acc: Vec<u8> = Vec::with_capacity(256);
    let mut buf = [0u8; 512];
    loop {
        let mut read: DWORD = 0;
        let ok = unsafe {
            ReadFile(
                handle,
                buf.as_mut_ptr() as *mut _,
                buf.len() as DWORD,
                &mut read,
                ptr::null_mut(),
            )
        };
        if ok == 0 || read == 0 {
            break;
        }
        acc.extend_from_slice(&buf[..read as usize]);
        if acc.contains(&b'\n') || acc.len() > 8192 {
            break;
        }
    }

    unsafe { CloseHandle(handle) };
    String::from_utf8(acc).map_err(|e| format!("响应非 UTF-8：{e}"))
}

#[cfg(not(target_os = "windows"))]
fn ipc_round_trip(_req: &str) -> Result<String, String> {
    Err("仅 Windows 支持".into())
}

#[cfg(target_os = "windows")]
fn spawn_elevated(exe: &std::path::Path) -> std::io::Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use winapi::um::shellapi::ShellExecuteW;

    let verb: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file: Vec<u16> = exe
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let working = exe
        .parent()
        .map(|p| {
            p.as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect::<Vec<u16>>()
        })
        .unwrap_or_else(|| vec![0]);

    // ShellExecuteW 返回值 > 32 = 成功
    let h = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            ptr::null(),
            working.as_ptr(),
            1, // SW_SHOWNORMAL（windows 子系统的 daemon 实际上不会显示窗口）
        )
    };
    if (h as usize) > 32 {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "ShellExecuteW returned {}",
            h as usize
        )))
    }
}

#[cfg(not(target_os = "windows"))]
fn spawn_elevated(_exe: &std::path::Path) -> std::io::Result<()> {
    Err(std::io::Error::other("仅 Windows 支持"))
}
