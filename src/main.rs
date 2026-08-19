mod config;
mod notifications;
mod preferences;
mod webview;
mod window;

use gtk4::glib;
use libadwaita as adw;
use adw::prelude::*;
use crate::config::ConfigManager;

const APP_ID: &str = "com.squidspirit.Messenger";

fn main() -> glib::ExitCode {
    adw::init().expect("Failed to initialize Libadwaita");

    let app = adw::Application::builder()
        .application_id(APP_ID)
        .build();

    let config_manager = ConfigManager::new();

    app.connect_activate(move |app| {
        if let Some(w) = app.windows().first() {
            w.set_visible(true);
            w.present();
            return;
        }
        window::build_ui(app, &config_manager);
    });

    app.run()
}

