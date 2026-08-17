use gtk4::glib;
use gtk4::prelude::*;
use libadwaita::{Application, ApplicationWindow, HeaderBar, WindowTitle};
use webkit6::prelude::*;
use webkit6::{
    PermissionRequest, UserContentInjectedFrames, UserContentManager, UserStyleLevel,
    UserStyleSheet, WebView,
};

const APP_ID: &str = "com.squidspirit.Messenger";
const TARGET_URL: &str = "https://www.facebook.com/messages";
const HIDE_NAV_CSS: &str = include_str!("../resources/hide-nav.css");

fn main() -> glib::ExitCode {
    let app = Application::builder()
        .application_id(APP_ID)
        .build();

    app.connect_activate(build_ui);
    app.run()
}

fn build_ui(app: &Application) {
    // 若視窗已存在（處於背景隱藏狀態），直接喚醒至前景
    if let Some(window) = app.active_window() {
        window.present();
        return;
    }

    // 1. WebKit User Content Manager - 注入 CSS
    let content_manager = UserContentManager::new();
    let stylesheet = UserStyleSheet::new(
        HIDE_NAV_CSS,
        UserContentInjectedFrames::AllFrames,
        UserStyleLevel::User,
        &[],
        &[],
    );
    content_manager.add_style_sheet(&stylesheet);

    // 2. Web View
    let web_view = WebView::builder()
        .user_content_manager(&content_manager)
        .hexpand(true)
        .vexpand(true)
        .build();

    web_view.load_uri(TARGET_URL);

    // 自動允許桌面通知與多媒體音訊權限
    web_view.connect_permission_request(|_, req: &PermissionRequest| {
        req.allow();
        true
    });

    // 3. Libadwaita 原生 HeaderBar (GTK4 / Libadwaita 樣式)
    let header_bar = HeaderBar::new();
    let window_title = WindowTitle::new("Messenger", "");
    header_bar.set_title_widget(Some(&window_title));

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

    // 保持標題為 Messenger
    let window_title_clone = window_title.clone();
    let window_clone = window.clone();
    web_view.connect_title_notify(move |_| {
        window_title_clone.set_title("Messenger");
        window_clone.set_title(Some("Messenger"));
    });

    // 6. 點擊 x 關閉按鈕時，隱藏視窗並在 GNOME 50 Background Apps 背景常駐
    window.connect_close_request(|w| {
        w.set_visible(false);
        glib::Propagation::Stop
    });

    window.present();
}
