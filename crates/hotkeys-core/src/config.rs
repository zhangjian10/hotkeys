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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    pub window_keywords: Vec<String>,
    pub hotkeys: Vec<HotkeyConfig>,
    pub auto_input_interval_secs: u64,
    pub input_delay_millis: u64,
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
}
