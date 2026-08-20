use gtk4::glib;
use libadwaita as adw;
use adw::prelude::*;
use soup::prelude::*;
use webkit6::prelude::*;
use webkit6::{UserContentManager, WebView};

pub fn setup_notifications(
    app: &adw::Application,
    window: &adw::ApplicationWindow,
    web_view: &WebView,
    content_manager: &UserContentManager,
) {
    // 1. 處理前端 JavaScript 直通發來的最新訊息通知 (支援大頭貼、焦點抑制與點擊喚醒)
    let app_notify = app.clone();
    let http_session = soup::Session::new();
    let window_for_notify = window.clone();

    content_manager.connect_script_message_received(Some("notify"), move |_, value| {
        // 若使用者正聚焦在視窗內（視窗可見且具有焦點），表示正看著畫面打字或閱讀，不發送重複桌面通知
        if window_for_notify.is_visible() && window_for_notify.is_active() {
            println!(">>> [Messenger Notification] Window is active and focused, suppressing notification.");
            return;
        }

        let raw = value.to_str();
        let mut parts = raw.splitn(3, '\n');
        let sender = parts.next().unwrap_or("Messenger").trim();
        let body = parts.next().unwrap_or("").trim();
        let avatar_url = parts.next().unwrap_or("").trim();

        let title = if sender.is_empty() { "Messenger" } else { sender };
        println!(
            ">>> [Messenger Native Notification] Sender: {}, Body: {}, Avatar URL: {}",
            title, body, avatar_url
        );

        let g_notif = gtk4::gio::Notification::new(title);
        if !body.is_empty() {
            g_notif.set_body(Some(body));
        }
        g_notif.set_default_action("app.open-window");

        // 若有寄件者頭像 URL，透過 Soup3 下載並封裝為 BytesIcon 傳入 D-Bus 通知
        if !avatar_url.is_empty() && avatar_url.starts_with("http") {
            if let Ok(msg) = soup::Message::new("GET", avatar_url) {
                if let Ok(bytes) = http_session.send_and_read(&msg, gtk4::gio::Cancellable::NONE) {
                    println!(
                        ">>> [Avatar Downloaded] Successfully fetched {} bytes",
                        bytes.len()
                    );
                    let g_bytes = glib::Bytes::from_owned(bytes);
                    let icon = gtk4::gio::BytesIcon::new(&g_bytes);
                    g_notif.set_icon(&icon);
                } else {
                    println!(
                        ">>> [Avatar Download] Failed to fetch avatar bytes from {}",
                        avatar_url
                    );
                }
            }
        }

        app_notify.send_notification(None, &g_notif);
    });

    // 2. 攔截 WebKit 原生 HTML5 Notification 事件作為備援
    let app_clone = app.clone();
    web_view.connect_show_notification(move |_, notif| {
        let title = notif.title().unwrap_or_else(|| glib::GString::from("Messenger"));
        let body = notif.body().unwrap_or_else(|| glib::GString::from("You received a new message"));
        println!(">>> [Messenger Notification Event] Title: {}, Body: {}", title, body);

        let g_notif = gtk4::gio::Notification::new(&title);
        g_notif.set_body(Some(&body));
        g_notif.set_default_action("app.open-window");
        let notif_id = format!("msg-{}", notif.id());
        app_clone.send_notification(Some(&notif_id), &g_notif);
        true
    });
}
