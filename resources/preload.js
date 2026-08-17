// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Direct IPC Notifications
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing background keep-alive and direct IPC notifications...');

    // 0. 直通 Rust 的原生通知發送器
    function sendNativeNotification(text) {
        console.log('[Messenger Preload] Dispatching native notification via WebKit IPC:', text);
        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) {
                window.webkit.messageHandlers.notify.postMessage(text);
            }
        } catch (err) {
            console.error('[Preload] PostMessage IPC error:', err);
        }
    }

    // 1. 偽裝 Visibility API，防止 WebKit 在視窗隱藏或最小化時掛起 WebSocket / MQTT 即時通訊通道
    try {
        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true
        });
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });
        window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    } catch (err) {
        console.error('[Preload] Visibility hook error:', err);
    }

    // 2. 攔截 Web Notification API，將所有通知直接轉發給 Rust
    try {
        const OriginalNotification = window.Notification;
        window.Notification = function (title, options) {
            const body = (options && options.body) || title || '您收到了一則新訊息';
            sendNativeNotification(body);
            if (OriginalNotification) {
                try {
                    return new OriginalNotification(title, options);
                } catch (e) {}
            }
            return {};
        };
        window.Notification.permission = 'granted';
        window.Notification.requestPermission = async () => 'granted';
    } catch (err) {
        console.error('[Preload] Notification hook error:', err);
    }

    // 3. 攔截 document.title 變化（未讀訊息標題變更雙重保障）
    let lastKnownTitle = document.title;

    function handleTitleChange(newTitle) {
        if (!newTitle || newTitle === lastKnownTitle) return;
        lastKnownTitle = newTitle;

        console.log('[Messenger Preload] Title changed to:', newTitle);

        // 匹配 Facebook Messenger 標題通知格式：
        // 例如 "(1) Messenger"、"(2) 小明 傳送了一則訊息"、"小明 傳送了一則訊息"
        if (/^\(\d+\)/.test(newTitle) || /傳送了一則訊息|sent a message|說：|said:/i.test(newTitle)) {
            console.log('[Messenger Preload] Unread message detected from title! Sending native notification...');
            const cleanBody = newTitle.replace(/^\(\d+\)\s*/, '');
            sendNativeNotification(cleanBody || '您收到了一則新訊息');
        }
    }

    // 攔截 document.title Setter
    try {
        const titleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title') ||
                                Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'title');
        if (titleDescriptor && titleDescriptor.set) {
            Object.defineProperty(document, 'title', {
                get() {
                    return titleDescriptor.get.call(document);
                },
                set(val) {
                    handleTitleChange(val);
                    return titleDescriptor.set.call(document, val);
                },
                configurable: true
            });
        }
    } catch (err) {
        console.error('[Preload] Title setter hook error:', err);
    }

    // 輪詢定時器備援檢查
    setInterval(() => {
        handleTitleChange(document.title);
    }, 1000);

    // 4. 網頁載入 3 秒後發送一條啟動通知確認通道暢通
    setTimeout(() => {
        console.log('[Messenger Preload] Ready.');
    }, 3000);

    console.log('[Messenger Preload] Direct IPC bridge registered successfully.');
})();
