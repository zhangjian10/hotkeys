use hotkeys_core::Config;
use lazy_static::lazy_static;
use rdev::Key as RdevKey;
use std::{
    collections::HashMap,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

lazy_static! {
    // 使用静态变量存储魔兽窗口状态
    pub static ref WARCRAFT_ACTIVE: AtomicBool = AtomicBool::new(false);

    // 如果需要存储上一次状态，可以使用 Mutex
    pub static ref LAST_STATUS: Mutex<bool> = Mutex::new(false);

    // 使用 Mutex 来存储自动输入的字符串
    pub static ref AUTO_INPUT: Mutex<Vec<String>> = Mutex::new(vec![]);

    // 标志位，用于检测 Alt 键是否被按下
    pub static ref ALT_PRESSED: AtomicBool = AtomicBool::new(false);

    // 修饰键状态映射
    pub static ref MODIFIER_KEYS_PRESSED: Mutex<HashMap<RdevKey, bool>> = Mutex::new(HashMap::new());

    // 全局配置
    pub static ref CONFIG: Mutex<Config> = Mutex::new(Config::default());
}

pub struct AppState;

#[warn(dead_code)]
impl AppState {
    pub fn is_active() -> bool {
        WARCRAFT_ACTIVE.load(Ordering::SeqCst)
    }

    pub fn set_active(active: bool) {
        let last_status = WARCRAFT_ACTIVE.load(Ordering::SeqCst);
        WARCRAFT_ACTIVE.store(active, Ordering::SeqCst);

        // 如果状态发生变化，打印提示信息
        if active != last_status {
            if active {
                println!("window is active");
            } else {
                println!("window is inactive");
            }
        }
    }

    pub fn update_modifier_key_state(key: RdevKey, pressed: bool) {
        // 检查是否是修饰键
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
