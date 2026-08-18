// ==========================================================================
// Messenger Preload Script - High-Accuracy DOM & Multi-Message Notification Engine
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing high-accuracy notification engine...');

    let isReady = false;
    let lastSeenMessageKey = '';
    let lastKnownTitle = document.title;

    // 啟動緩衝期（6秒），並記錄開啟 App 時現有的最新訊息，避免啟動時對舊訊息彈窗
    setTimeout(() => {
        isReady = true;
        const initialChat = extractLatestChatFromDOM();
        if (initialChat) {
            lastSeenMessageKey = `${initialChat.sender}:::${initialChat.body}`;
        }
        lastKnownTitle = document.title;
        console.log('[Messenger Preload] Ready. Initial chat key:', lastSeenMessageKey);
    }, 6000);

    // 直通發送至 Rust 的原生通知函式
    function sendNativeNotification(sender, body, avatarUrl) {
        if (!isReady) return;

        const title = (sender || 'Messenger').trim();
        const content = (body || '您收到了一則新訊息').trim();

        console.log('[Messenger Notification Dispatched]', { sender: title, body: content, avatar: avatarUrl });

        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) {
                window.webkit.messageHandlers.notify.postMessage(`${title}\n${content}\n${avatarUrl || ''}`);
            }
        } catch (e) {
            console.error('[Messenger Preload] IPC Error:', e);
        }
    }

    // 從 Messenger 對話列表中精確抓取最新對話的寄件者、乾淨內文與頭像
    function extractLatestChatFromDOM() {
        try {
            // 專屬選取 Messenger 真實對話連結（頂部第一條即為最新活躍對話）
            const rows = document.querySelectorAll(
                'a[role="link"][href*="/messages/t/"], a[role="link"][href*="/messages/e2ee/t/"], a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"]'
            );

            if (!rows || rows.length === 0) return null;
            const topRow = rows[0];

            // 1. 抓取頭像 URL（支援 svg image xlink:href, href 與 img src）
            let avatarUrl = '';
            const imageEl = topRow.querySelector('image') || topRow.querySelector('img');
            if (imageEl) {
                avatarUrl = imageEl.getAttribute('xlink:href') || imageEl.getAttribute('href') || imageEl.src || '';
            }

            // 2. 提取 span[dir="auto"] 文字節點
            const textSpans = Array.from(topRow.querySelectorAll('span[dir="auto"]'))
                .map(s => s.innerText.trim())
                .filter(Boolean);

            if (textSpans.length === 0) return null;

            // 寄件者通常是第一個 span[dir="auto"]（或 <b> 標籤）
            const bEl = topRow.querySelector('b');
            let sender = (bEl && bEl.innerText) ? bEl.innerText.trim() : textSpans[0];

            // 訊息內容通常在第二個 span[dir="auto"]
            let rawBody = textSpans.length > 1 ? textSpans[1] : '';

            // 備援：若無第二個 span，檢查子文字
            if (!rawBody) {
                const rawLines = (topRow.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
                if (rawLines.length > 1) {
                    rawBody = rawLines[1];
                }
            }

            // 清理訊息內容
            let body = rawBody;
            // 去除無障礙標籤
            body = body.replace(/^(未讀訊息[：:]*|Unread message[：:]*|Unread[：:]*)/i, '').trim();
            // 去除時間後綴（如 " · 1 分鐘"、" • 剛剛"）
            body = body.replace(/\s*[·•・\-]\s*.*$/, '').trim();
            // 去除外圍引號與句號
            body = body.replace(/^["'“”„‟’‘\s]+|["'“”„‟’‘\s。]+$/g, '').trim();

            const ignored = ['Messenger', '搜尋', 'Search', 'Chats', '對話', '收件匣', 'Inbox', '訊息', 'Messages', '隱藏的聊天室'];
            if (sender && !ignored.includes(sender) && !sender.startsWith('http')) {
                return {
                    sender: sender,
                    body: body || '您收到了一則新訊息',
                    avatarUrl: avatarUrl
                };
            }
        } catch (e) {
            console.error('[Messenger Preload] DOM extract error:', e);
        }
        return null;
    }

    // 檢查是否有新抵達的訊息（支援同對話連續多次傳送通知）
    function checkIncomingMessages() {
        if (!isReady) return;

        const chat = extractLatestChatFromDOM();
        if (!chat) return;

        const currentKey = `${chat.sender}:::${chat.body}`;

        // 若使用者正聚焦在視窗內操作/打字/閱讀，同步更新記憶但不發送桌面通知
        if (typeof document.hasFocus === 'function' && document.hasFocus()) {
            lastSeenMessageKey = currentKey;
            return;
        }

        if (currentKey !== lastSeenMessageKey) {
            lastSeenMessageKey = currentKey;
            sendNativeNotification(chat.sender, chat.body, chat.avatarUrl);
        }
    }

    // 1. 偽裝 Visibility API 保活，防止 WebKit 背景斷線
    try {
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    } catch (err) {
        console.error('[Preload] Visibility hook error:', err);
    }

    // 2. 直通 window.Notification
    try {
        window.Notification = function (sender, options) {
            const body = (options && options.body) || '';
            const avatar = (options && options.icon) || '';
            sendNativeNotification(sender, body, avatar);
            return {};
        };
        window.Notification.permission = 'granted';
        window.Notification.requestPermission = async () => 'granted';
    } catch (err) {
        console.error('[Preload] Notification hook error:', err);
    }

    // 3. 直通 ServiceWorkerRegistration.showNotification
    try {
        if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
            ServiceWorkerRegistration.prototype.showNotification = function (sender, options) {
                const body = (options && options.body) || '';
                const avatar = (options && options.icon) || '';
                sendNativeNotification(sender, body, avatar);
                return Promise.resolve();
            };
        }
    } catch (err) {
        console.error('[Preload] ServiceWorker hook error:', err);
    }

    // 4. 定時（每 600ms）檢查新訊息變化（支援同一對話連續傳訊）
    setInterval(checkIncomingMessages, 600);

    // 5. 攔截 document.title 變化時立即檢查
    function handleTitleChange(newTitle) {
        if (!newTitle || newTitle === lastKnownTitle) return;
        lastKnownTitle = newTitle;
        checkIncomingMessages();
    }

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

    console.log('[Messenger Preload] All high-accuracy hooks registered.');
})();
