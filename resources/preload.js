// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Rich Notifications
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing notification engine with startup grace period...');

    // 啟動緩衝期（啟動後前 6 秒不發送通知，避免對舊的未讀歷史訊息彈出通知）
    let isReady = false;
    let lastUnreadCount = 0;
    let lastKnownTitle = document.title;

    setTimeout(() => {
        isReady = true;
        const match = document.title.match(/^\((\d+)\)/);
        if (match) {
            lastUnreadCount = parseInt(match[1], 10);
        }
        lastKnownTitle = document.title;
        console.log('[Messenger Preload] Notification engine is active (initial unread:', lastUnreadCount, ')');
    }, 6000);

    // 直通發送至 Rust 的原生通知函式 (格式: "寄件者\n訊息內容")
    let lastSentKey = '';
    function sendNativeNotification(sender, body) {
        if (!isReady) return;

        const title = (sender || 'Messenger').trim();
        const content = (body || '您收到了一則新訊息').trim();
        const key = `${title}:::${content}`;

        if (key === lastSentKey) return;
        lastSentKey = key;
        setTimeout(() => {
            if (lastSentKey === key) lastSentKey = '';
        }, 2000);

        console.log('[Messenger Notification Triggered]', { sender: title, body: content });
        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) {
                window.webkit.messageHandlers.notify.postMessage(`${title}\n${content}`);
            }
        } catch (e) {
            console.error('[Messenger Preload] IPC Error:', e);
        }
    }

    // 從 DOM 對話列表中精確抓取最新一則訊息的寄件者與內文
    function extractLatestChatFromDOM() {
        try {
            const rows = document.querySelectorAll(
                'div[role="row"], div[role="listitem"], a[role="link"][href*="/messages/t/"], a[href*="/messages/t/"]'
            );
            for (const row of rows) {
                const text = row.innerText || '';
                const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
                if (lines.length >= 2) {
                    const sender = lines[0];
                    const body = lines[1];
                    const ignored = ['Messenger', '搜尋', 'Search', 'Chats', '對話', '收件匣', 'Inbox', '訊息', 'Messages'];
                    if (sender && body && !ignored.includes(sender) && !sender.startsWith('http')) {
                        return { sender, body };
                    }
                }
            }
        } catch (e) {
            console.error('[Messenger Preload] DOM extract error:', e);
        }
        return null;
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

    // 2. 第一層：直通 window.Notification
    try {
        window.Notification = function (sender, options) {
            const body = (options && options.body) || '';
            sendNativeNotification(sender, body);
            return {};
        };
        window.Notification.permission = 'granted';
        window.Notification.requestPermission = async () => 'granted';
    } catch (err) {
        console.error('[Preload] Notification hook error:', err);
    }

    // 3. 第二層：直通 ServiceWorkerRegistration.showNotification
    try {
        if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
            ServiceWorkerRegistration.prototype.showNotification = function (sender, options) {
                const body = (options && options.body) || '';
                sendNativeNotification(sender, body);
                return Promise.resolve();
            };
        }
    } catch (err) {
        console.error('[Preload] ServiceWorker hook error:', err);
    }

    // 4. 第三層：監聽 Document Title 變化（未讀增加或標題提醒）
    function handleTitleChange(newTitle) {
        if (!newTitle || newTitle === lastKnownTitle) return;
        lastKnownTitle = newTitle;

        if (!isReady) return;

        console.log('[Messenger Preload] Title changed to:', newTitle);

        // 格式 A：標題包含寄件者與動作，例如 "小明 傳送了一則訊息" 或 "小明：嗨你好"
        if (/傳送了一則訊息|sent a message|說：|said:/i.test(newTitle)) {
            const cleanTitle = newTitle.replace(/^\(\d+\)\s*/, '');
            const colonIndex = cleanTitle.indexOf('：') !== -1 ? cleanTitle.indexOf('：') : cleanTitle.indexOf(':');
            if (colonIndex !== -1) {
                const sender = cleanTitle.substring(0, colonIndex);
                const body = cleanTitle.substring(colonIndex + 1);
                sendNativeNotification(sender, body);
                return;
            }
            sendNativeNotification('Messenger', cleanTitle);
            return;
        }

        // 格式 B：未讀計數增加（例如從 (4) 變 (5)）
        const match = newTitle.match(/^\((\d+)\)/);
        if (match) {
            const currentUnread = parseInt(match[1], 10);
            if (currentUnread > lastUnreadCount) {
                lastUnreadCount = currentUnread;
                const domData = extractLatestChatFromDOM();
                if (domData) {
                    sendNativeNotification(domData.sender, domData.body);
                } else {
                    sendNativeNotification('Messenger', '您收到了一則新訊息');
                }
            } else {
                lastUnreadCount = currentUnread;
            }
        } else {
            lastUnreadCount = 0;
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
})();
