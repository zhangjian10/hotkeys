use std::{fmt, fs, io, path::Path};

use serde::{Deserialize, Serialize};

const DEFAULT_CONFIG_TOML: &str = include_str!("../default_hotkeys.toml");

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub modifier_key: String,        // "Alt", "Ctrl", "Shift", "Meta"
    pub trigger_key: String,         // "BackQuote", "Num1", "F1", etc.
    pub input_string: String,        // String to be input
    pub description: Option<String>, // Optional description
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
}
