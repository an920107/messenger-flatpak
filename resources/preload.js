// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Notification Bridge
// ==========================================================================

(function () {
    'use strict';

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
        console.error('[Preload] Visibility hook failed:', err);
    }

    // 2. 偽裝 Notification.permission 為 granted，讓網頁無縫啟用桌面通知
    try {
        if (window.Notification) {
            Object.defineProperty(Notification, 'permission', {
                get: () => 'granted',
                configurable: true
            });
            Notification.requestPermission = async () => 'granted';
        }
    } catch (err) {
        console.error('[Preload] Notification hook failed:', err);
    }

    // 3. 監聽 Document Title 變化作為通知後備保障（當網頁以標題提示新訊息時）
    let lastTitle = document.title;
    const titleObserver = new MutationObserver(() => {
        const currentTitle = document.title;
        if (currentTitle !== lastTitle) {
            // 匹配 Facebook Messenger 訊息標題格式，例如："(1) Messenger" 或 "某某 傳送了一則訊息"
            if (/^\(\d+\)/.test(currentTitle) || /傳送了一則訊息|sent a message/i.test(currentTitle)) {
                if (window.Notification && Notification.permission === 'granted') {
                    try {
                        new Notification('Messenger', {
                            body: currentTitle,
                            icon: 'com.squidspirit.Messenger'
                        });
                    } catch (e) {
                        console.error('[Preload] Fallback notification failed:', e);
                    }
                }
            }
            lastTitle = currentTitle;
        }
    });

    // 確保 DOM 載入後掛載 Observer
    window.addEventListener('DOMContentLoaded', () => {
        const titleElem = document.querySelector('title');
        if (titleElem) {
            titleObserver.observe(titleElem, { subtree: true, characterData: true, childList: true });
        }
    });
})();
