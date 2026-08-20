use libadwaita as adw;
use adw::prelude::*;
use crate::config::ConfigManager;

pub fn show_preferences_window(parent: &adw::ApplicationWindow, config: &ConfigManager) {
    let prefs_window = adw::PreferencesWindow::builder()
        .transient_for(parent)
        .modal(true)
        .title("Preferences")
        .default_width(560)
        .default_height(400)
        .build();

    let page = adw::PreferencesPage::builder()
        .title("General")
        .icon_name("preferences-other-symbolic")
        .build();

    let group = adw::PreferencesGroup::builder()
        .title("Behavior")
        .description("Configure application behavior when the window is closed.")
        .build();

    let action_row = adw::ActionRow::builder()
        .title("Run in Background When Closed")
        .subtitle("Keep the app running in the background to receive real-time notifications.")
        .activatable(true)
        .build();

    let switch = gtk4::Switch::builder()
        .active(config.get().run_in_background)
        .valign(gtk4::Align::Center)
        .build();

    let config_clone = config.clone();
    switch.connect_active_notify(move |s| {
        let active = s.is_active();
        println!("[Preferences] 'run_in_background' toggled to: {}", active);
        config_clone.set_run_in_background(active);
    });

    action_row.add_suffix(&switch);
    action_row.set_activatable_widget(Some(&switch));

    group.add(&action_row);
    page.add(&group);
    prefs_window.add(&page);

    prefs_window.present();
}
