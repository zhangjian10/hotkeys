//! Tauri 后端：把 hotkeys-core 的 Config 暴露成 invoke 命令。
//!
//! 设计要点：
//! - 配置文件路径选择优先级：
//!     1. 与 daemon exe（`hotkeys.exe`）同目录的 `hotkeys.toml`，便于"绿色版"分发
//!     2. 退化：与 GUI 自己 exe 同目录
//! - load 时如果文件不存在则用 `Config::default()` 填充，并把路径返回给前端，
//!   方便前端在状态栏显示"将创建于 …"
//! - save 时由前端发送整个 Config —— 后端不做合法性校验（hotkeys-core 的 serde
//!   反序列化已经做了类型校验）。

use std::path::PathBuf;

use hotkeys_core::Config;
use serde::Serialize;

#[derive(Serialize)]
pub struct ConfigBundle {
    /// 配置文件绝对路径（即使尚未存在）
    pub path: String,
    pub config: Config,
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
        // 文件不存在：返回默认值，但**不**立即写盘（让用户决定何时保存）
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

/// 在文件管理器中显示配置文件
#[tauri::command]
fn reveal_config() -> Result<(), String> {
    let path = resolve_config_path();
    let target: &std::path::Path = if path.exists() {
        path.as_path()
    } else {
        // 文件不存在时，定位到父目录
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

/// 应用启动：注册命令
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            reveal_config
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 失败");
}
