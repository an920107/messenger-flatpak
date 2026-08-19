use gtk4::glib;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::fs;
use std::path::PathBuf;
use std::rc::Rc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_run_in_background")]
    pub run_in_background: bool,
}

fn default_run_in_background() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            run_in_background: true,
        }
    }
}

#[derive(Clone)]
pub struct ConfigManager {
    config_path: PathBuf,
    config: Rc<RefCell<AppConfig>>,
}

impl ConfigManager {
    pub fn new() -> Self {
        let config_dir = glib::user_config_dir().join("com.squidspirit.Messenger");
        let config_path = config_dir.join("settings.json");

        let initial_config = if config_path.exists() {
            match fs::read_to_string(&config_path) {
                Ok(content) => serde_json::from_str::<AppConfig>(&content).unwrap_or_default(),
                Err(e) => {
                    eprintln!("[Config] Failed to read settings file: {}, using defaults", e);
                    AppConfig::default()
                }
            }
        } else {
            AppConfig::default()
        };

        Self {
            config_path,
            config: Rc::new(RefCell::new(initial_config)),
        }
    }

    pub fn get(&self) -> AppConfig {
        self.config.borrow().clone()
    }

    pub fn set_run_in_background(&self, enabled: bool) {
        self.config.borrow_mut().run_in_background = enabled;
        self.save();
    }

    fn save(&self) {
        if let Some(parent) = self.config_path.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        match serde_json::to_string_pretty(&*self.config.borrow()) {
            Ok(json_str) => {
                if let Err(e) = fs::write(&self.config_path, json_str) {
                    eprintln!("[Config] Failed to write settings file: {}", e);
                } else {
                    println!("[Config] Settings saved to {:?}", self.config_path);
                }
            }
            Err(e) => eprintln!("[Config] Failed to serialize settings: {}", e),
        }
    }
}
