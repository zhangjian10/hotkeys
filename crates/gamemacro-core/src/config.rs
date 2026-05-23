use std::{fmt, fs, io, path::Path};

use serde::{Deserialize, Deserializer, Serialize};

const DEFAULT_CONFIG_TOML: &str = include_str!("../default_config.toml");

fn default_true() -> bool {
    true
}

/// 标准修饰键集合（与 GUI ALL_MODIFIERS 保持一致）。
const KNOWN_MODIFIERS: &[&str] = &["Alt", "Ctrl", "Meta", "Shift"];

/// 自定义反序列化：兼容三种历史/新格式
/// - `modifiers = ["Ctrl", "Shift"]`（新）
/// - `modifier_key = "Ctrl"`         （旧字段名，单值）
/// - 缺省：返回空 Vec
///
/// 同时把结果按字典序排序去重，保证 (modifiers, trigger) 是稳定的"组合键身份"。
fn modifiers_de<'de, D>(d: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OneOrMany {
        One(String),
        Many(Vec<String>),
    }
    let raw: OneOrMany = OneOrMany::deserialize(d)?;
    let mut v = match raw {
        OneOrMany::One(s) => vec![s],
        OneOrMany::Many(xs) => xs,
    };
    v.retain(|m| !m.is_empty());
    v.sort();
    v.dedup();
    Ok(v)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HotkeyConfig {
    /// 修饰键集合（"Alt" / "Ctrl" / "Shift" / "Meta"）。
    /// 反序列化时同时接受旧字段名 `modifier_key`（单值字符串）。
    /// 永远按字典序排序去重，便于做"组合键身份"比较。
    #[serde(
        default,
        alias = "modifier_key",
        deserialize_with = "modifiers_de"
    )]
    pub modifiers: Vec<String>,
    pub trigger_key: String,         // "BackQuote", "Num1", "F1", etc.
    pub input_string: String,        // String to be input
    pub description: Option<String>, // Optional description
    /// 按一次开始循环输入、再按一次停止；缺省 true（与历史行为一致）。
    /// 若为 false，按一次只输入一次，不入循环。
    #[serde(default = "default_true")]
    pub repeat: bool,
    /// 覆盖此条热键专属的循环间隔（秒）。None 时使用 profile 的 auto_input_interval_secs。
    /// 仅在 `repeat = true` 时生效。
    #[serde(default)]
    pub interval_secs_override: Option<u64>,
}

impl HotkeyConfig {
    /// 计算本条热键真实生效的循环间隔（秒）。
    /// 优先使用 `interval_secs_override`，否则回退到 profile 的 `auto_input_interval_secs`。
    /// 下限固定为 1 秒——0 会让 tokio interval 退化为 100% CPU 自旋，必须夹住。
    pub fn effective_interval_secs(&self, profile: &Profile) -> u64 {
        self.interval_secs_override
            .unwrap_or(profile.auto_input_interval_secs)
            .max(1)
    }

    /// 把修饰键集合规范化（排序+去重）。在反序列化路径以外的写入路径调用以保证不变量。
    pub fn normalize(&mut self) {
        self.modifiers.sort();
        self.modifiers.dedup();
    }

    /// "组合键身份"字符串：用于查重 / 作为 active loop map 的 key。
    /// 形如 `"Alt+Ctrl+Shift::F1"`；modifiers 已是字典序，输出稳定。
    pub fn combo_signature(&self) -> String {
        if self.modifiers.is_empty() {
            self.trigger_key.clone()
        } else {
            format!("{}::{}", self.modifiers.join("+"), self.trigger_key)
        }
    }
}

/// 旁路：判断字符串是否是已知修饰键名（GUI / daemon 两侧都需要的小工具）。
pub fn is_known_modifier(s: &str) -> bool {
    KNOWN_MODIFIERS.contains(&s)
}

/// 一个 Profile：通常对应某一款游戏 / 某一类窗口
///
/// 顶层 `Config` 包含多个 Profile；运行时根据当前前台窗口标题，按数组顺序匹配
/// 第一个 `window_keywords` 命中的 Profile 作为"激活" Profile。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    /// 显示用名称（"魔兽争霸"、"真三国无双" 等）
    pub name: String,
    /// 命中此 Profile 的窗口标题关键词
    pub window_keywords: Vec<String>,
    /// 此 Profile 内的热键
    pub hotkeys: Vec<HotkeyConfig>,
    /// 持续按住时的重发间隔（秒）
    pub auto_input_interval_secs: u64,
    /// 模拟按键之间的延迟（毫秒）
    pub input_delay_millis: u64,
}

impl Profile {
    /// 标题（小写化后）是否命中本 profile 的任一关键词
    pub fn matches_title(&self, title_lower: &str) -> bool {
        for keyword in &self.window_keywords {
            if keyword.contains('%') {
                let fuzzy = keyword.replace('%', "").to_lowercase();
                if title_lower.contains(&fuzzy) {
                    return true;
                }
            } else if title_lower.eq(&keyword.to_lowercase()) {
                return true;
            }
        }
        false
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    /// 所有 Profile，按数组顺序作为匹配优先级
    #[serde(default, rename = "profiles")]
    pub profiles: Vec<Profile>,
}

impl Config {
    /// 找到第一个能匹配指定窗口标题的 profile，返回其在数组中的索引
    pub fn active_profile_index(&self, title: &str) -> Option<usize> {
        let lower = title.to_lowercase();
        self.profiles.iter().position(|p| p.matches_title(&lower))
    }

    /// 安全获取 profile 引用
    pub fn profile(&self, index: usize) -> Option<&Profile> {
        self.profiles.get(index)
    }
}

#[derive(Debug)]
pub enum ConfigError {
    Io(io::Error),
    Parse(toml::de::Error),
    Serialize(toml::ser::Error),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::Io(e) => write!(f, "IO error: {}", e),
            ConfigError::Parse(e) => write!(f, "Failed to parse config: {}", e),
            ConfigError::Serialize(e) => write!(f, "Failed to serialize config: {}", e),
        }
    }
}

impl std::error::Error for ConfigError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ConfigError::Io(e) => Some(e),
            ConfigError::Parse(e) => Some(e),
            ConfigError::Serialize(e) => Some(e),
        }
    }
}

impl From<io::Error> for ConfigError {
    fn from(e: io::Error) -> Self {
        ConfigError::Io(e)
    }
}

impl From<toml::de::Error> for ConfigError {
    fn from(e: toml::de::Error) -> Self {
        ConfigError::Parse(e)
    }
}

impl From<toml::ser::Error> for ConfigError {
    fn from(e: toml::ser::Error) -> Self {
        ConfigError::Serialize(e)
    }
}

impl Default for Config {
    fn default() -> Self {
        toml::from_str(DEFAULT_CONFIG_TOML).expect("Failed to parse default config")
    }
}

impl Config {
    pub fn load_or_create<P: AsRef<Path>>(config_path: P) -> Result<Self, ConfigError> {
        let path = config_path.as_ref();
        if path.exists() {
            let content = fs::read_to_string(path)?;
            let config: Config = toml::from_str(&content)?;
            Ok(config)
        } else {
            let default_config = Config::default();
            default_config.save(path)?;
            println!(
                "Config file not found, created default config at {}",
                path.display()
            );
            Ok(default_config)
        }
    }

    pub fn load<P: AsRef<Path>>(config_path: P) -> Result<Self, ConfigError> {
        let content = fs::read_to_string(config_path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn save<P: AsRef<Path>>(&self, config_path: P) -> Result<(), ConfigError> {
        let toml_string = toml::to_string(self)?;
        fs::write(config_path, toml_string)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_roundtrip() {
        let cfg = Config::default();
        let s = toml::to_string(&cfg).expect("serialize");
        let parsed: Config = toml::from_str(&s).expect("parse");
        assert_eq!(cfg, parsed);
    }

    #[test]
    fn matches_title_keyword() {
        let p = Profile {
            name: "WC3".into(),
            window_keywords: vec!["warcraft iii".into()],
            hotkeys: vec![],
            auto_input_interval_secs: 3,
            input_delay_millis: 50,
        };
        assert!(p.matches_title("warcraft iii"));
        assert!(!p.matches_title("starcraft"));
    }

    #[test]
    fn matches_title_fuzzy() {
        let p = Profile {
            name: "DOTA".into(),
            window_keywords: vec!["%dota%".into()],
            hotkeys: vec![],
            auto_input_interval_secs: 3,
            input_delay_millis: 50,
        };
        assert!(p.matches_title("warcraft iii - dota allstars"));
    }

    #[test]
    fn first_match_wins() {
        let cfg = Config {
            profiles: vec![
                Profile {
                    name: "A".into(),
                    window_keywords: vec!["%foo%".into()],
                    hotkeys: vec![],
                    auto_input_interval_secs: 3,
                    input_delay_millis: 50,
                },
                Profile {
                    name: "B".into(),
                    window_keywords: vec!["%bar%".into()],
                    hotkeys: vec![],
                    auto_input_interval_secs: 3,
                    input_delay_millis: 50,
                },
            ],
        };
        assert_eq!(cfg.active_profile_index("hello bar"), Some(1));
        assert_eq!(cfg.active_profile_index("foo bar"), Some(0));
        assert_eq!(cfg.active_profile_index("nothing"), None);
    }

    #[test]
    fn hotkey_repeat_defaults_to_true_for_legacy_toml() {
        // 模拟阶段 1 之前的 toml（无 repeat 字段，且使用旧字段 modifier_key）
        let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifier_key = "Ctrl"
trigger_key = "X"
input_string = "-ss"
"#;
        let cfg: Config = toml::from_str(toml_str).expect("parse");
        let hk = &cfg.profiles[0].hotkeys[0];
        assert!(hk.repeat, "repeat should default to true for legacy configs");
        assert_eq!(hk.modifiers, vec!["Ctrl".to_string()]);
    }

    #[test]
    fn hotkey_repeat_can_be_false_explicitly() {
        let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifiers = ["Ctrl"]
trigger_key = "X"
input_string = "-ss"
repeat = false
"#;
        let cfg: Config = toml::from_str(toml_str).expect("parse");
        assert!(!cfg.profiles[0].hotkeys[0].repeat);
    }

    #[test]
    fn hotkey_interval_override_defaults_to_none() {
        let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifiers = ["Ctrl"]
trigger_key = "X"
input_string = "-ss"
"#;
        let cfg: Config = toml::from_str(toml_str).expect("parse");
        assert_eq!(cfg.profiles[0].hotkeys[0].interval_secs_override, None);
    }

    #[test]
    fn hotkey_interval_override_can_be_set() {
        let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifiers = ["Ctrl"]
trigger_key = "X"
input_string = "-ss"
interval_secs_override = 10
"#;
        let cfg: Config = toml::from_str(toml_str).expect("parse");
        assert_eq!(cfg.profiles[0].hotkeys[0].interval_secs_override, Some(10));
    }

    #[test]
    fn hotkey_effective_interval_falls_back_to_profile() {
        let p = Profile {
            name: "T".into(),
            window_keywords: vec!["x".into()],
            hotkeys: vec![HotkeyConfig {
                modifiers: vec!["Ctrl".into()],
                trigger_key: "X".into(),
                input_string: "-ss".into(),
                description: None,
                repeat: true,
                interval_secs_override: None,
            }],
            auto_input_interval_secs: 7,
            input_delay_millis: 50,
        };
        assert_eq!(p.hotkeys[0].effective_interval_secs(&p), 7);
    }

    #[test]
    fn hotkey_effective_interval_uses_override_when_present() {
        let p = Profile {
            name: "T".into(),
            window_keywords: vec!["x".into()],
            hotkeys: vec![HotkeyConfig {
                modifiers: vec!["Ctrl".into()],
                trigger_key: "X".into(),
                input_string: "-ss".into(),
                description: None,
                repeat: true,
                interval_secs_override: Some(2),
            }],
            auto_input_interval_secs: 7,
            input_delay_millis: 50,
        };
        assert_eq!(p.hotkeys[0].effective_interval_secs(&p), 2);
    }

    #[test]
    fn hotkey_effective_interval_clamps_zero_to_one() {
        let p = Profile {
            name: "T".into(),
            window_keywords: vec!["x".into()],
            hotkeys: vec![HotkeyConfig {
                modifiers: vec!["Ctrl".into()],
                trigger_key: "X".into(),
                input_string: "-ss".into(),
                description: None,
                repeat: true,
                interval_secs_override: Some(0),
            }],
            auto_input_interval_secs: 7,
            input_delay_millis: 50,
        };
        // 0 秒会让 tokio interval panic / 100% CPU；必须夹到至少 1 秒
        assert_eq!(p.hotkeys[0].effective_interval_secs(&p), 1);
    }

    #[test]
    fn hotkey_modifiers_accepts_multi_key_array() {
        let toml_str = r#"
[[profiles]]
name = "T"
window_keywords = ["x"]
auto_input_interval_secs = 3
input_delay_millis = 50

[[profiles.hotkeys]]
modifiers = ["Shift", "Ctrl"]
trigger_key = "S"
input_string = "save"
"#;
        let cfg: Config = toml::from_str(toml_str).expect("parse");
        // 必须排序去重后是 [Ctrl, Shift]
        assert_eq!(
            cfg.profiles[0].hotkeys[0].modifiers,
            vec!["Ctrl".to_string(), "Shift".to_string()]
        );
    }

    #[test]
    fn hotkey_combo_signature_is_stable_across_modifier_input_order() {
        let a = HotkeyConfig {
            modifiers: vec!["Shift".into(), "Ctrl".into(), "Alt".into()],
            trigger_key: "F1".into(),
            input_string: String::new(),
            description: None,
            repeat: true,
            interval_secs_override: None,
        };
        let mut a = a;
        a.normalize();
        assert_eq!(a.combo_signature(), "Alt+Ctrl+Shift::F1");

        // 不同输入顺序但同一组合键应得到相同 signature
        let b = HotkeyConfig {
            modifiers: vec!["Alt".into(), "Shift".into(), "Ctrl".into()],
            trigger_key: "F1".into(),
            input_string: String::new(),
            description: None,
            repeat: true,
            interval_secs_override: None,
        };
        let mut b = b;
        b.normalize();
        assert_eq!(a.combo_signature(), b.combo_signature());
    }

    #[test]
    fn hotkey_no_modifiers_serializes_as_empty_array() {
        let hk = HotkeyConfig {
            modifiers: vec![],
            trigger_key: "F12".into(),
            input_string: "x".into(),
            description: None,
            repeat: true,
            interval_secs_override: None,
        };
        let s = toml::to_string(&hk).expect("serialize");
        assert!(s.contains("modifiers = []"), "got: {s}");
        let parsed: HotkeyConfig = toml::from_str(&s).expect("parse");
        assert_eq!(parsed.modifiers, Vec::<String>::new());
    }
}
