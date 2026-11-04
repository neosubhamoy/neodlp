use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// `msghost-config.json`. The native-messaging host reads only `port` from the same file.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub port: u16,
    /// Whether the extension WebSocket server should run (it starts at launch when set). Files
    /// written before this existed lack it and mean "run".
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
}

fn enabled_by_default() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self { port: 53511, enabled: enabled_by_default() }
    }
}

pub fn get_config_dir() -> Option<PathBuf> {
    ProjectDirs::from("com", "neosubhamoy", "neodlp")
        .map(|proj_dirs| proj_dirs.config_dir().to_path_buf())
}

pub fn get_config_path() -> Option<PathBuf> {
    get_config_dir().map(|dir| dir.join("msghost-config.json"))
}

pub fn load_config() -> Config {
    if let Some(config_path) = get_config_path() {
        if let Ok(content) = fs::read_to_string(config_path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    Config::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_config_from_before_the_enabled_flag_keeps_its_port_and_runs() {
        let config: Config = serde_json::from_str(r#"{"port": 55555}"#).unwrap();
        assert_eq!(config.port, 55555);
        assert!(config.enabled);
    }

    #[test]
    fn the_enabled_flag_round_trips() {
        let config = Config { port: 54000, enabled: false };
        let back: Config = serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!((back.port, back.enabled), (54000, false));
    }

    #[test]
    fn the_server_runs_by_default() {
        assert!(Config::default().enabled);
    }
}

pub fn save_config(config: &Config) -> Result<(), String> {
    let config_dir =
        get_config_dir().ok_or_else(|| "Could not determine config directory".to_string())?;

    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    let config_path = config_dir.join("msghost-config.json");
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(config_path, content).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}
