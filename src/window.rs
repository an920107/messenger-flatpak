use gtk4::gio;
use gtk4::glib;
use libadwaita as adw;
use adw::prelude::*;
use adw::{ApplicationWindow, HeaderBar, WindowTitle};
use webkit6::prelude::*;

use crate::config::ConfigManager;
use crate::notifications;
use crate::preferences;
use crate::webview;

pub fn build_ui(app: &adw::Application, config: &ConfigManager) {
    // 1. 初始化 WebKitGTK 核心組件
    let webview_components = webview::create_web_view();
    let web_view = webview_components.web_view;
    let content_manager = webview_components.content_manager;

    // 2. Libadwaita 原生 HeaderBar
    let header_bar = HeaderBar::new();
    let window_title = WindowTitle::new("Messenger", "");
    header_bar.set_title_widget(Some(&window_title));

    // 3. 右上角主選單按鈕 (MenuButton + open-menu-symbolic)
    let menu = gio::Menu::new();
    menu.append(Some("偏好設定"), Some("win.preferences"));
    menu.append(Some("完全結束"), Some("app.quit"));

    let menu_button = gtk4::MenuButton::builder()
        .icon_name("open-menu-symbolic")
        .menu_model(&menu)
        .tooltip_text("選單")
        .build();
    header_bar.pack_end(&menu_button);

    // 4. 垂直佈局容器
    let main_box = gtk4::Box::new(gtk4::Orientation::Vertical, 0);
    main_box.append(&header_bar);
    main_box.append(&web_view);

    // 5. Libadwaita 原生視窗
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Messenger")
        .default_width(1100)
        .default_height(780)
        .content(&main_box)
        .build();

    // 註冊視窗級 Action: "win.preferences"
    let action_prefs = gio::SimpleAction::new("preferences", None);
    let window_clone_prefs = window.clone();
    let config_clone_prefs = config.clone();
    action_prefs.connect_activate(move |_, _| {
        preferences::show_preferences_window(&window_clone_prefs, &config_clone_prefs);
    });
    window.add_action(&action_prefs);

    // 註冊應用級 Action: "app.open-window" 供桌面通知點擊喚醒視窗
    let action_open = gio::SimpleAction::new("open-window", None);
    let window_clone_open = window.clone();
    action_open.connect_activate(move |_, _| {
        window_clone_open.set_visible(true);
        window_clone_open.present();
    });
    app.add_action(&action_open);

    // 註冊應用級 Action: "app.quit" 供選單完全結束應用程式
    let action_quit = gio::SimpleAction::new("quit", None);
    let app_clone_quit = app.clone();
    action_quit.connect_activate(move |_, _| {
        println!("[Application] 'Quit' action triggered. Terminating...");
        app_clone_quit.quit();
    });
    app.add_action(&action_quit);

    // 6. 設定桌面通知監聽
    notifications::setup_notifications(app, &window, &web_view, &content_manager);

    // 7. 鎖定標題列名稱為 Messenger
    let window_title_clone = window_title.clone();
    let window_clone_title = window.clone();
    web_view.connect_title_notify(move |_| {
        window_title_clone.set_title("Messenger");
        window_clone_title.set_title(Some("Messenger"));
    });

    // 8. 關閉視窗 (X) 行為處理：根據設定動態判斷是「背景常駐」還是「完全退出」
    let config_clone_close = config.clone();
    window.connect_close_request(move |w| {
        let run_in_bg = config_clone_close.get().run_in_background;
        if run_in_bg {
            println!("[Window] Close requested: hiding window and keeping alive in background.");
            w.set_visible(false);
            glib::Propagation::Stop
        } else {
            println!("[Window] Close requested: run_in_background is false. Proceeding to exit.");
            glib::Propagation::Proceed
        }
    });

    window.present();
}
