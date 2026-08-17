// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Direct Native Notifications
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing Messenger direct notification passthrough...');

    // 0. 直通發送至 Rust 的原生通知函式
    function postToRust(sender, body) {
        const title = (sender || 'Messenger').trim();
        const content = (body || '').trim();
        console.log('[Messenger Direct Notify]', { sender: title, body: content });
        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) {
                window.webkit.messageHandlers.notify.postMessage(`${title}\n${content}`);
            }
        } catch (e) {
            console.error('[Messenger Preload] IPC Error:', e);
        }
    }

    // 1. 偽裝 Visibility API，防止 WebKit 在視窗隱藏或最小化時掛起 WebSocket / MQTT 即時連線
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

    // 2. 100% 直通 Messenger 呼叫的 window.Notification（寄件者與訊息內文）
    try {
        window.Notification = function (sender, options) {
            const body = (options && options.body) || '';
            postToRust(sender, body);
            return {};
        };
        window.Notification.permission = 'granted';
        window.Notification.requestPermission = async () => 'granted';
    } catch (err) {
        console.error('[Preload] Notification hook error:', err);
    }

    // 3. 100% 直通 ServiceWorkerRegistration.prototype.showNotification（網頁背景推送）
    try {
        if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
            ServiceWorkerRegistration.prototype.showNotification = function (sender, options) {
                const body = (options && options.body) || '';
                postToRust(sender, body);
                return Promise.resolve();
            };
        }
    } catch (err) {
        console.error('[Preload] ServiceWorker hook error:', err);
    }

    console.log('[Messenger Preload] Direct notification passthrough registered successfully.');
})();
