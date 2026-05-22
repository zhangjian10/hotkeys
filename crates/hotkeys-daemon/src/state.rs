use hotkeys_core::{Config, Profile};
use lazy_static::lazy_static;
use rdev::Key as RdevKey;
use std::{
    collections::HashMap,
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicI64, Ordering},
    },
};

lazy_static! {
    // 当前是否有任意 profile 命中（即"激活"）
    pub static ref WARCRAFT_ACTIVE: AtomicBool = AtomicBool::new(false);

    // 当前激活的 profile 在 Config.profiles 中的索引；-1 表示没有命中
    pub static ref ACTIVE_PROFILE_INDEX: AtomicI64 = AtomicI64::new(-1);

    // 自动输入字符串列表
    pub static ref AUTO_INPUT: Mutex<Vec<String>> = Mutex::new(vec![]);

    // 修饰键状态
    pub static ref MODIFIER_KEYS_PRESSED: Mutex<HashMap<RdevKey, bool>> = Mutex::new(HashMap::new());

    // 全局配置
    pub static ref CONFIG: Mutex<Config> = Mutex::new(Config::default());
}

pub struct AppState;

impl AppState {
    pub fn is_active() -> bool {
        WARCRAFT_ACTIVE.load(Ordering::SeqCst)
    }

    pub fn set_active(active: bool) {
        let last_status = WARCRAFT_ACTIVE.load(Ordering::SeqCst);
        WARCRAFT_ACTIVE.store(active, Ordering::SeqCst);

        if active != last_status {
            if active {
                println!("window is active");
            } else {
                println!("window is inactive");
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
                        println!("Profile activated: {} (#{})", p.name, i);
                    }
                }
                None => println!("No profile active"),
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

    pub fn add_auto_input(input_str: String) {
        let mut auto_input = AUTO_INPUT.lock().unwrap();
        if !auto_input.contains(&input_str) {
            auto_input.push(input_str);
        }
    }

    pub fn remove_auto_input(input_str: &str) {
        let mut auto_input = AUTO_INPUT.lock().unwrap();
        auto_input.retain(|s| s != input_str);
    }

    pub fn clear_auto_input() {
        let mut auto_input = AUTO_INPUT.lock().unwrap();
        auto_input.clear();
    }

    pub fn contains_auto_input(input_str: &str) -> bool {
        let auto_input = AUTO_INPUT.lock().unwrap();
        auto_input.contains(&input_str.to_string())
    }

    pub fn get_auto_input_list() -> Vec<String> {
        AUTO_INPUT.lock().unwrap().clone()
    }
}
