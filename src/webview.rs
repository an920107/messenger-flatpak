use gtk4::glib;
use webkit6::prelude::*;
use webkit6::{
    CookieAcceptPolicy, CookiePersistentStorage, NetworkSession, PermissionRequest, Settings,
    UserContentInjectedFrames, UserContentManager, UserScript, UserScriptInjectionTime,
    UserStyleLevel, UserStyleSheet, WebView,
};

const TARGET_URL: &str = "https://www.facebook.com/messages";
const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const HIDE_NAV_CSS: &str = include_str!("../resources/hide-nav.css");
const PRELOAD_JS: &str = include_str!("../resources/preload.js");

pub struct WebViewComponents {
    pub web_view: WebView,
    pub content_manager: UserContentManager,
}

pub fn create_web_view() -> WebViewComponents {
    // 1. 設定持久化儲存目錄 (Flatpak 內部 ~/.var/app/com.squidspirit.Messenger/data/messenger)
    let data_dir = glib::user_data_dir().join("messenger");
    let cache_dir = glib::user_cache_dir().join("messenger");

    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::create_dir_all(&cache_dir);

    let data_dir_str = data_dir.to_str().unwrap();
    let cache_dir_str = cache_dir.to_str().unwrap();

    // 建立持久化網路會話 (包含 LocalStorage, IndexedDB, Cookies, HSTS, 磁碟快取等)
    let network_session = NetworkSession::new(Some(data_dir_str), Some(cache_dir_str));

    // 關鍵設定 1：關閉 ITP (Intelligent Tracking Prevention)，防止認證 Cookie 被當成第三方追蹤清除
    network_session.set_itp_enabled(false);

    // 關鍵設定 2：啟用持久化憑證儲存
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

    // 3. WebKit User Content Manager - 注入 CSS 與 JavaScript 保活腳本 (僅注入頂層框架，防止污染 iframe)
    let content_manager = UserContentManager::new();
    let stylesheet = UserStyleSheet::new(
        HIDE_NAV_CSS,
        UserContentInjectedFrames::TopFrame,
        UserStyleLevel::User,
        &[],
        &[],
    );
    content_manager.add_style_sheet(&stylesheet);

    let script = UserScript::new(
        PRELOAD_JS,
        UserContentInjectedFrames::TopFrame,
        UserScriptInjectionTime::Start,
        &[],
        &[],
    );
    content_manager.add_script(&script);

    // 註冊 JavaScript -> Rust 的直通 IPC 訊息通道 "notify"
    content_manager.register_script_message_handler("notify", None);

    // 4. Web View 建構
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

    WebViewComponents {
        web_view,
        content_manager,
    }
}
