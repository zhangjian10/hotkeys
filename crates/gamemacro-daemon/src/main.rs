// release build 走 windows 子系统：双击 exe 无控制台窗口；
// debug build 仍带控制台，便于 cargo run。
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

use rdev::listen;

mod elevation;
mod hotkey;
mod input;
mod ipc;
mod logging;
mod loop_runtime;
mod state;
mod window;

use elevation::ensure_elevated;
use gamemacro_core::Config;
use hotkey::HotkeyManager;
use notify::{EventKind, RecursiveMode, Watcher};
use state::AppState;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use window::WindowManager;

fn load_config(config_path: &str, is_watcher: bool) {
    match Config::load_or_create(config_path) {
        Ok(new_config) => {
            AppState::set_config(new_config);
            if is_watcher {
                log_info!("Configuration changed, reloading...");
                return;
            }
            HotkeyManager::print_hotkey_configs();
        }
        Err(e) => {
            log_error!("Failed to reload configuration: {:?}", e);
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    logging::init();
    log_info!("GameMacro Daemon v{} starting", env!("CARGO_PKG_VERSION"));

    ensure_elevated();

    let config_path = "gamemacro.toml";
    load_config(config_path, false);

    // 启动循环输入运行时（tokio runtime + 单 std input worker）
    AppState::init_loop_runtime()?;

    // 启动 IPC 服务（命名管道：状态查询 / 远程停止）
    ipc::spawn_server();

    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx)?;
    watcher.watch(Path::new(config_path), RecursiveMode::NonRecursive)?;

    let last_reload = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
    let config_path_clone = config_path.to_string();

    std::thread::spawn(move || {
        let last_reload = last_reload.clone();
        for res in rx {
            match res {
                Ok(event) => {
                    if matches!(event.kind, EventKind::Modify(_)) {
                        let mut last = last_reload.lock().unwrap();
                        if last.elapsed() < Duration::from_millis(500) {
                            continue;
                        }
                        *last = Instant::now();
                        // 旧配置下进行中的循环按旧 interval 继续是错的：先取消再 reload
                        HotkeyManager::cancel_all();
                        load_config(&config_path_clone, true);
                    }
                }
                Err(e) => log_error!("Watch error: {:?}", e),
            }
        }
    });

    log_info!("Listening for hotkeys; waiting for window activation");

    // Initialize window monitoring
    WindowManager::init_window_hook()?;
    WindowManager::refresh_state();

    // Start listening for global keyboard events
    if let Err(error) = listen(HotkeyManager::handle_key_event) {
        log_error!("Listening error: {:?}", error);
    }

    Ok(())
}
