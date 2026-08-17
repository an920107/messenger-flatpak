// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Notification Bridge
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing background keep-alive and notification hooks...');

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

    // 2. 偽裝 Notification.permission 為 granted
    try {
        if (window.Notification) {
            Object.defineProperty(Notification, 'permission', {
                get: () => 'granted',
                configurable: true
            });
            Notification.requestPermission = async () => 'granted';
        }
    } catch (err) {
        console.error('[Preload] Notification hook error:', err);
    }

    // 3. 攔截 document.title 變化（包含 React / SPA 標題更新與輪詢備援）
    let lastKnownTitle = document.title;

    function handleTitleChange(newTitle) {
        if (!newTitle || newTitle === lastKnownTitle) return;
        lastKnownTitle = newTitle;

        console.log('[Messenger Preload] Title changed to:', newTitle);

        // 匹配 Facebook Messenger 標題通知格式：
        // 例如 "(1) Messenger"、"(2) 小明 傳送了一則訊息"、"小明 傳送了一則訊息"
        if (/^\(\d+\)/.test(newTitle) || /傳送了一則訊息|sent a message|說：|said:/i.test(newTitle)) {
            console.log('[Messenger Preload] Unread message detected from title! Triggering notification...');
            try {
                const cleanBody = newTitle.replace(/^\(\d+\)\s*/, '');
                new Notification('Messenger', {
                    body: cleanBody || '您收到了一則新訊息',
                    icon: 'com.squidspirit.Messenger'
                });
            } catch (e) {
                console.error('[Preload] Notification trigger error:', e);
            }
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

    // 4. 攔截 Facebook 提示音效播放（當有新訊息音效時，觸發通知）
    try {
        const originalAudioPlay = HTMLAudioElement.prototype.play;
        HTMLAudioElement.prototype.play = function () {
            console.log('[Messenger Preload] Audio play intercepted:', this.src);
            // 只要不是背景持續播放的長音訊（一般通知音效短於 5 秒）
            if (this.duration && this.duration < 5) {
                console.log('[Messenger Preload] Short notification sound detected!');
            }
            return originalAudioPlay.apply(this, arguments);
        };
    } catch (err) {
        console.error('[Preload] Audio hook error:', err);
    }

    console.log('[Messenger Preload] All hooks registered successfully.');
})();
