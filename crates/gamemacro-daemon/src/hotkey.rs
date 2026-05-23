use crate::log_info;
use crate::loop_runtime::LoopHandle;
use crate::state::AppState;
use gamemacro_core::{HotkeyConfig, Profile, string_to_rdev_key};
use rdev::{Event, EventType, Key as RdevKey};
use std::collections::HashMap;
use std::sync::Mutex;

/// 已激活循环的热键 -> 它在 LoopRuntime 中的 handle。
/// key 用 "组合键 signature"（HotkeyConfig::combo_signature）来标识热键身份；
/// 这样 (Ctrl+Shift+S) 与 (Shift+Ctrl+S) 写法不同也能视为同一条。
static ACTIVE_LOOPS: Mutex<Option<HashMap<String, LoopHandle>>> = Mutex::new(None);

fn active_loops_lock() -> std::sync::MutexGuard<'static, Option<HashMap<String, LoopHandle>>> {
    let mut g = ACTIVE_LOOPS.lock().unwrap();
    if g.is_none() {
        *g = Some(HashMap::new());
    }
    g
}

pub struct HotkeyManager;

impl HotkeyManager {
    pub fn handle_key_event(event: Event) {
        if !AppState::is_active() {
            return;
        }

        match event.event_type {
            EventType::KeyPress(key) => {
                AppState::update_modifier_key_state(key, true);
                if let Some((hotkey, interval_secs, delay_ms)) = Self::find_match_with_context(key)
                {
                    Self::trigger_hotkey(hotkey, interval_secs, delay_ms);
                }
            }
            EventType::KeyRelease(key) => {
                AppState::update_modifier_key_state(key, false);
            }
            _ => {}
        }
    }

    /// 在当前激活 profile 下查找匹配的热键。返回 (hotkey, effective_interval_secs, delay_ms)。
    ///
    /// 多修饰键匹配规则：热键的全部 modifiers 必须都按下；其它修饰键无所谓。
    /// （这与 IDE / 系统级 hotkey 的"无关修饰键"语义略不同，但对游戏宏更友好——
    ///  按 Ctrl 同时再按 Ctrl+Shift+S 也应触发，避免抢键节奏。）
    fn find_match_with_context(trigger_key: RdevKey) -> Option<(HotkeyConfig, u64, u64)> {
        let profile: Profile = AppState::get_active_profile()?;
        let modifier_keys = AppState::get_modifier_keys_state();

        for hk in &profile.hotkeys {
            let Some(ct) = string_to_rdev_key(&hk.trigger_key) else {
                continue;
            };
            if ct != trigger_key {
                continue;
            }
            // 所有声明的 modifier 都需要处于按下态
            let all_held = hk.modifiers.iter().all(|m| {
                string_to_rdev_key(m)
                    .map(|rk| matches!(modifier_keys.get(&rk), Some(true)))
                    .unwrap_or(false)
            });
            if !all_held {
                continue;
            }
            return Some((
                hk.clone(),
                hk.effective_interval_secs(&profile),
                profile.input_delay_millis,
            ));
        }
        None
    }

    /// 处理一次匹配命中：根据 `repeat` 字段走单次或循环路径。
    fn trigger_hotkey(hotkey: HotkeyConfig, interval_secs: u64, delay_ms: u64) {
        let key = hotkey.combo_signature();
        let label = hotkey.input_string.replace('\n', " ");

        if !hotkey.repeat {
            log_info!("Hotkey (once): {}", label);
            AppState::with_loop_runtime(|rt| rt.submit_once(hotkey.input_string.clone(), delay_ms));
            return;
        }

        let mut guard = active_loops_lock();
        let map = guard.as_mut().expect("ACTIVE_LOOPS initialized");
        if let Some(handle) = map.remove(&key) {
            log_info!("stop {}", label);
            AppState::with_loop_runtime(|rt| rt.stop_loop(handle));
        } else {
            log_info!("start {} (every {}s)", label, interval_secs);
            if let Some(handle) = AppState::with_loop_runtime(|rt| {
                rt.start_loop(hotkey.input_string.clone(), interval_secs, delay_ms)
            }) {
                map.insert(key, handle);
            }
        }
    }

    /// 配置 reload / 窗口失活 时调用：清空所有进行中循环和映射
    pub fn cancel_all() {
        active_loops_lock()
            .as_mut()
            .expect("ACTIVE_LOOPS initialized")
            .clear();
        AppState::with_loop_runtime(|rt| rt.cancel_all_loops());
    }

    pub fn print_hotkey_configs() {
        let config = AppState::get_config();
        log_info!("loaded {} profile(s)", config.profiles.len());
        for (pi, profile) in config.profiles.iter().enumerate() {
            log_info!(
                "  [{}] {}  (keywords: {:?})",
                pi,
                profile.name,
                profile.window_keywords
            );
            log_info!(
                "      profile interval: {}s, key delay: {}ms",
                profile.auto_input_interval_secs,
                profile.input_delay_millis
            );
            for (i, hk) in profile.hotkeys.iter().enumerate() {
                let desc = hk.description.as_deref().unwrap_or("no description");
                let mode = if hk.repeat {
                    format!("loop {}s", hk.effective_interval_secs(profile))
                } else {
                    "once".to_string()
                };
                let combo = if hk.modifiers.is_empty() {
                    hk.trigger_key.clone()
                } else {
                    format!("{}+{}", hk.modifiers.join("+"), hk.trigger_key)
                };
                log_info!(
                    "      {}. {} -> {} ({}, {})",
                    i + 1,
                    combo,
                    hk.input_string.replace('\n', " "),
                    mode,
                    desc
                );
            }
        }
    }
}
