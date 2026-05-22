pub mod config;
pub mod keys;

pub use config::{Config, ConfigError, HotkeyConfig};
pub use keys::{ALL_MODIFIERS, ALL_TRIGGERS, key_to_string, string_to_rdev_key};
