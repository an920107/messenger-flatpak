use gtk4::glib;
use gtk4::prelude::*;
use libadwaita::{Application, ApplicationWindow, HeaderBar, WindowTitle};
use webkit6::prelude::*;
use webkit6::{
    CookieAcceptPolicy, CookiePersistentStorage, NetworkSession, PermissionRequest, Settings,
    UserContentInjectedFrames, UserContentManager, UserStyleLevel, UserStyleSheet, WebView,
};

const APP_ID: &str = "com.squidspirit.Messenger";
const TARGET_URL: &str = "https://www.facebook.com/messages";
const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const HIDE_NAV_CSS: &str = include_str!("../resources/hide-nav.css");

fn main() -> glib::ExitCode {
    let app = Application::builder()
        .application_id(APP_ID)
        .build();

    app.connect_activate(build_ui);
    app.run()
}

fn build_ui(app: &Application) {
    if let Some(window) = app.active_window() {
        window.present();
        return;
    }

    // 1. 設定持久化資料與快取目錄 (XDG Data & Cache)
    let data_dir = glib::user_data_dir().join("messenger");
    let cache_dir = glib::user_cache_dir().join("messenger");

    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::create_dir_all(&cache_dir);

    let data_dir_str = data_dir.to_str().unwrap();
    let cache_dir_str = cache_dir.to_str().unwrap();

    // 建立持久化網路會話 (包含 LocalStorage, IndexedDB, Cookies, HSTS, 磁碟快取等)
    let network_session = NetworkSession::new(Some(data_dir_str), Some(cache_dir_str));

    // 關鍵設定 1：關閉 ITP (Intelligent Tracking Prevention)，防止 Facebook 認證 Cookie 被當成第三方追蹤清除
    network_session.set_itp_enabled(false);

    // 關鍵設定 2：啟用持久化憑證儲存 (Persistent Credential Storage)
    network_session.set_persistent_credential_storage_enabled(true);

    // 關鍵設定 3：設定 SQLite 檔案路徑與允許跨域認證 Cookie
    if let Some(cookie_manager) = network_session.cookie_manager() {
        let cookie_file = data_dir.join("cookies.sqlite");
        cookie_manager.set_accept_policy(CookieAcceptPolicy::Always);
        cookie_manager.set_persistent_storage(
            cookie_file.to_str().unwrap(),
            CookiePersistentStorage::Sqlite,
        );
    }

    // 2. WebKit Settings
    let settings = Settings::builder()
        .enable_html5_local_storage(true)
        .enable_html5_database(true)
        .enable_javascript(true)
        .enable_webaudio(true)
        .enable_media_stream(true)
        .enable_developer_extras(true)
        .enable_write_console_messages_to_stdout(true)
        .user_agent(USER_AGENT)
        .build();

    // 3. WebKit User Content Manager - 注入 CSS
    let content_manager = UserContentManager::new();
    let stylesheet = UserStyleSheet::new(
        HIDE_NAV_CSS,
        UserContentInjectedFrames::AllFrames,
        UserStyleLevel::User,
        &[],
        &[],
    );
    content_manager.add_style_sheet(&stylesheet);

    // 4. Web View
    let web_view = WebView::builder()
        .user_content_manager(&content_manager)
        .network_session(&network_session)
        .settings(&settings)
        .hexpand(true)
        .vexpand(true)
        .build();

    web_view.load_uri(TARGET_URL);

    // 自動允許桌面通知與多媒體音訊權限
    web_view.connect_permission_request(|_, req: &PermissionRequest| {
        req.allow();
        true
    });

    // 5. Libadwaita 原生 HeaderBar (GTK4 / Libadwaita 樣式)
    let header_bar = HeaderBar::new();
    let window_title = WindowTitle::new("Messenger", "");
    header_bar.set_title_widget(Some(&window_title));

    // 6. 垂直佈局容器
    let main_box = gtk4::Box::new(gtk4::Orientation::Vertical, 0);
    main_box.append(&header_bar);
    main_box.append(&web_view);

    // 7. Libadwaita 原生視窗
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Messenger")
        .default_width(1100)
        .default_height(780)
        .content(&main_box)
        .build();

    let window_title_clone = window_title.clone();
    let window_clone = window.clone();
    web_view.connect_title_notify(move |_| {
        window_title_clone.set_title("Messenger");
        window_clone.set_title(Some("Messenger"));
    });

    // 8. 點擊 x 關閉按鈕時，隱藏視窗並在 GNOME 50 Background Apps 背景常駐
    window.connect_close_request(|w| {
        w.set_visible(false);
        glib::Propagation::Stop
    });

    window.present();
}
