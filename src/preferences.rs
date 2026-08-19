use libadwaita as adw;
use adw::prelude::*;
use crate::config::ConfigManager;

pub fn show_preferences_window(parent: &adw::ApplicationWindow, config: &ConfigManager) {
    let prefs_window = adw::PreferencesWindow::builder()
        .transient_for(parent)
        .modal(true)
        .title("偏好設定")
        .default_width(560)
        .default_height(400)
        .build();

    let page = adw::PreferencesPage::builder()
        .title("一般")
        .icon_name("preferences-other-symbolic")
        .build();

    let group = adw::PreferencesGroup::builder()
        .title("背景與生命週期")
        .description("設定應用程式視窗關閉時的常駐行為")
        .build();

    let action_row = adw::ActionRow::builder()
        .title("關閉視窗時保留在背景運行")
        .subtitle("在背景常駐以持續接收即時訊息與桌面通知")
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
