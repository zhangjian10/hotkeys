//! GameMacro engine：全局热键监听 + 循环输入运行时 + 窗口检测。
//!
//! 由 GUI 在启动时通过 [`start`] 调用，所有工作在后台线程进行：
//! - 一个独占的 rdev hook thread（必须独占，因为 listen 阻塞 + GetMessage 泵）
//! - notify config watcher thread
//! - tokio multi-thread runtime（per-hotkey 循环 task）
//! - enigo input worker thread（串行化输入）
//!
//! 进程退出时这些线程随之被 OS 清理；engine 本身不暴露 stop。

#[macro_use]
pub mod logging;

mod hotkey;
mod input;
mod loop_runtime;
mod state;
mod window;

pub use logging::log_path;
pub use state::{AppState, StateSnapshot};

use gamemacro_core::Config;
use hotkey::HotkeyManager;
use notify::{EventKind, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use window::WindowManager;

/// 启动 engine 全部后台工作。返回后立刻可用：
/// 配置文件已加载、watcher 已挂、热键 hook 线程已 spawn。
///
/// 失败仅在不可恢复时（input worker 起不来 / hook 线程 spawn 失败 / SetWinEventHook 失败）；
/// 配置文件不存在时会调用 `Config::load_or_create` 自动创建并继续。
///
/// 必须在管理员权限上下文调用（Windows 全局键盘 hook 限制）。
pub fn start(config_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    logging::init();
    log_info!("GameMacro engine v{} starting", env!("CARGO_PKG_VERSION"));

    load_config(&config_path, false);

    // 启动循环输入运行时（tokio runtime + 单 std input worker）
    AppState::init_loop_runtime()?;

    // 配置文件 watcher：单独线程持有 Watcher，事件通道驱动 reload
    spawn_config_watcher(config_path);

    // 窗口前台变化监听：SetWinEventHook(WINEVENT_OUTOFCONTEXT) 不占线程
    WindowManager::init_window_hook()?;
    WindowManager::refresh_state();

    // rdev hook 必须独占一个线程：内部跑 GetMessage 消息泵
    std::thread::Builder::new()
        .name("gamemacro-hotkey".into())
        .spawn(|| {
            if let Err(error) = rdev::listen(HotkeyManager::handle_key_event) {
                log_error!("rdev listen error: {:?}", error);
            }
        })?;

    log_info!("engine ready");
    Ok(())
}

/// 全局开关。false 时：
/// - 后续 hotkey 事件被短路（hotkey.rs 入口检查）
/// - 立即 cancel 所有正在跑的循环
///
/// 用户在设置弹窗里手动 toggle；engine 内部不会自己改这个值。
pub fn set_enabled(enabled: bool) {
    let prev = AppState::is_enabled();
    AppState::set_enabled(enabled);
    if !enabled && prev {
        HotkeyManager::cancel_all();
    }
    log_info!("engine enabled = {}", enabled);
}

pub fn is_enabled() -> bool {
    AppState::is_enabled()
}

fn load_config(config_path: &Path, is_reload: bool) {
    match Config::load_or_create(config_path) {
        Ok(new_config) => {
            AppState::set_config(new_config);
            if is_reload {
                log_info!("Configuration changed, reloading...");
                return;
            }
            HotkeyManager::print_hotkey_configs();
        }
        Err(e) => {
            log_error!("Failed to (re)load configuration: {:?}", e);
        }
    }
}

fn spawn_config_watcher(config_path: PathBuf) {
    std::thread::Builder::new()
        .name("gamemacro-config-watcher".into())
        .spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel();
            let mut watcher = match notify::recommended_watcher(tx) {
                Ok(w) => w,
                Err(e) => {
                    log_error!("watcher init failed: {:?}", e);
                    return;
                }
            };
            if let Err(e) = watcher.watch(&config_path, RecursiveMode::NonRecursive) {
                log_error!("watcher.watch failed: {:?}", e);
                return;
            }

            let last_reload = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
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
                            load_config(&config_path, true);
                        }
                    }
                    Err(e) => log_error!("Watch error: {:?}", e),
                }
            }
        })
        .ok();
}
