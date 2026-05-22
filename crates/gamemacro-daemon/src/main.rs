use rdev::listen;

mod auto_input;
mod elevation;
mod hotkey;
mod input;
mod state;
mod window;

use auto_input::AutoInputManager;
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
                println!("Configuration changed, reloading...");
                return;
            }
            HotkeyManager::print_hotkey_configs();
        }
        Err(e) => {
            eprintln!("Failed to reload configuration: {:?}", e);
        }
    }
}

/// 一次性迁移：若工作目录下存在旧的 hotkeys.toml 而新的 gamemacro.toml 不存在，
/// 重命名旧文件为新名字并打印迁移日志。重命名失败仅警告，不阻止启动。
fn migrate_legacy_config(new_path: &str, old_path: &str) {
    let new_p = Path::new(new_path);
    let old_p = Path::new(old_path);
    if !new_p.exists() && old_p.exists() {
        match std::fs::rename(old_p, new_p) {
            Ok(()) => println!("Migrated config: {} -> {}", old_path, new_path),
            Err(e) => eprintln!(
                "Warning: failed to migrate {} -> {}: {}",
                old_path, new_path, e
            ),
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("========================================");
    println!("    GameMacro Daemon v{}    ", env!("CARGO_PKG_VERSION"));
    println!("========================================");
    println!();

    ensure_elevated();
    println!();

    let config_path = "gamemacro.toml";
    migrate_legacy_config(config_path, "hotkeys.toml");
    load_config(config_path, false);

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
                        load_config(&config_path_clone, true);
                    }
                }
                Err(e) => eprintln!("Watch error: {:?}", e),
            }
        }
    });

    println!("==========================================");
    println!("    Program is running...                  ");
    println!("    Waiting for window activation          ");
    println!("    Press Ctrl + C to exit                 ");
    println!("==========================================");
    println!();

    // Initialize window monitoring
    WindowManager::init_window_hook()?;

    // Start auto input
    AutoInputManager::start();
    WindowManager::refresh_state();

    // Start listening for global keyboard events
    println!("Starting global hotkey listener...");
    if let Err(error) = listen(HotkeyManager::handle_key_event) {
        eprintln!("Listening error: {:?}", error);
    }

    Ok(())
}
