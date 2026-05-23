use crate::loop_runtime::LoopRuntime;
use gamemacro_core::{Config, Profile};
use lazy_static::lazy_static;
use rdev::Key as RdevKey;
use std::{
    collections::HashMap,
    sync::{
        Mutex, OnceLock,
        atomic::{AtomicBool, AtomicI64, Ordering},
    },
};

/// 给 GUI 接口用的状态快照。
pub struct StateSnapshot {
    pub active: bool,
    pub enabled: bool,
    pub profile_name: Option<String>,
    pub profile_index: Option<usize>,
}

lazy_static! {
    // 当前是否有任意 profile 命中（即"激活"）
    pub static ref WARCRAFT_ACTIVE: AtomicBool = AtomicBool::new(false);

    // 当前激活的 profile 在 Config.profiles 中的索引；-1 表示没有命中
    pub static ref ACTIVE_PROFILE_INDEX: AtomicI64 = AtomicI64::new(-1);

    // 修饰键状态
    pub static ref MODIFIER_KEYS_PRESSED: Mutex<HashMap<RdevKey, bool>> = Mutex::new(HashMap::new());

    // 全局配置
    pub static ref CONFIG: Mutex<Config> = Mutex::new(Config::default());

    // 用户开关：是否启用热键监听（false 时 hotkey 回调短路，且 cancel_all）
    pub static ref ENABLED: AtomicBool = AtomicBool::new(true);
}

/// 全局唯一的 LoopRuntime。daemon 启动时通过 `init_loop_runtime` 注入；
/// 此后通过 `with_loop_runtime` 在锁的保护下访问。
static LOOP_RUNTIME: OnceLock<Mutex<LoopRuntime>> = OnceLock::new();

pub struct AppState;

impl AppState {
    pub fn is_active() -> bool {
        WARCRAFT_ACTIVE.load(Ordering::SeqCst)
    }

    pub fn is_enabled() -> bool {
        ENABLED.load(Ordering::SeqCst)
    }

    pub fn set_enabled(enabled: bool) {
        ENABLED.store(enabled, Ordering::SeqCst);
    }

    pub fn set_active(active: bool) {
        let last_status = WARCRAFT_ACTIVE.load(Ordering::SeqCst);
        WARCRAFT_ACTIVE.store(active, Ordering::SeqCst);

        if active != last_status {
            if active {
                log_info!("window is active");
            } else {
                log_info!("window is inactive");
            }
        }
    }

    /// 设置当前激活的 profile 索引；-1 表示无
    pub fn set_active_profile(index: Option<usize>) {
        let prev = ACTIVE_PROFILE_INDEX.load(Ordering::SeqCst);
        let next = index.map(|i| i as i64).unwrap_or(-1);
        ACTIVE_PROFILE_INDEX.store(next, Ordering::SeqCst);

        if prev != next {
            match index {
                Some(i) => {
                    if let Some(p) = CONFIG.lock().unwrap().profiles.get(i) {
                        log_info!("Profile activated: {} (#{})", p.name, i);
                    }
                }
                None => log_info!("No profile active"),
            }
        }
    }

    /// 取出当前激活的 Profile（克隆出来，避免持锁）
    pub fn get_active_profile() -> Option<Profile> {
        let idx = ACTIVE_PROFILE_INDEX.load(Ordering::SeqCst);
        if idx < 0 {
            return None;
        }
        CONFIG
            .lock()
            .unwrap()
            .profiles
            .get(idx as usize)
            .cloned()
    }

    pub fn update_modifier_key_state(key: RdevKey, pressed: bool) {
        match key {
            RdevKey::Alt
            | RdevKey::ControlLeft
            | RdevKey::ControlRight
            | RdevKey::ShiftLeft
            | RdevKey::ShiftRight
            | RdevKey::MetaLeft
            | RdevKey::MetaRight => {
                let mut modifier_keys = MODIFIER_KEYS_PRESSED.lock().unwrap();
                modifier_keys.insert(key, pressed);
            }
            _ => {}
        }
    }

    pub fn get_modifier_keys_state() -> HashMap<RdevKey, bool> {
        MODIFIER_KEYS_PRESSED.lock().unwrap().clone()
    }

    pub fn get_config() -> Config {
        CONFIG.lock().unwrap().clone()
    }

    pub fn set_config(config: Config) {
        let mut global_config = CONFIG.lock().unwrap();
        *global_config = config;
    }

    /// 给 GUI 用的轻量快照：当前是否启用 / 是否激活 / 激活的 profile 名/索引。
    pub fn snapshot() -> StateSnapshot {
        let active = WARCRAFT_ACTIVE.load(Ordering::SeqCst);
        let enabled = ENABLED.load(Ordering::SeqCst);
        let idx_raw = ACTIVE_PROFILE_INDEX.load(Ordering::SeqCst);
        let (profile_name, profile_index) = if idx_raw < 0 {
            (None, None)
        } else {
            let i = idx_raw as usize;
            let name = CONFIG
                .lock()
                .ok()
                .and_then(|c| c.profiles.get(i).map(|p| p.name.clone()));
            (name, Some(i))
        };
        StateSnapshot {
            active,
            enabled,
            profile_name,
            profile_index,
        }
    }

    /// 在 engine 启动时调用一次。重复调用会返回错误。
    pub fn init_loop_runtime() -> std::io::Result<()> {
        let rt = LoopRuntime::new()?;
        LOOP_RUNTIME
            .set(Mutex::new(rt))
            .map_err(|_| std::io::Error::other("LoopRuntime already initialized"))?;
        Ok(())
    }

    /// 在锁的保护下访问 LoopRuntime。若尚未初始化则返回 None（理论上不会发生）。
    pub fn with_loop_runtime<R>(f: impl FnOnce(&mut LoopRuntime) -> R) -> Option<R> {
        LOOP_RUNTIME.get().map(|m| f(&mut m.lock().unwrap()))
    }
}
