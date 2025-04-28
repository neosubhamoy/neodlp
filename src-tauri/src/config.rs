use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub port: u16,
}

impl Default for Config {
    fn default() -> Self {
        Self { port: 53511 }
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
