// ==========================================================================
// Messenger Preload Script - Background Keep-Alive & Rich Notifications
// ==========================================================================

(function () {
    'use strict';

    console.log('[Messenger Preload] Initializing rich notification engine with avatar & clean body...');

    let isReady = false;
    let lastUnreadCount = 0;
    let lastKnownTitle = document.title;

    // 啟動緩衝期（6秒）
    setTimeout(() => {
        isReady = true;
        const match = document.title.match(/^\((\d+)\)/);
        if (match) {
            lastUnreadCount = parseInt(match[1], 10);
        }
        lastKnownTitle = document.title;
        console.log('[Messenger Preload] Ready. Initial unread count:', lastUnreadCount);
    }, 6000);

    let lastSentKey = '';
    async function sendNativeNotification(sender, body, avatarUrl) {
        if (!isReady) return;

        const title = (sender || 'Messenger').trim();
        const content = (body || '您收到了一則新訊息').trim();
        const key = `${title}:::${content}`;

        if (key === lastSentKey) return;
        lastSentKey = key;
        setTimeout(() => {
            if (lastSentKey === key) lastSentKey = '';
        }, 2500);

        console.log('[Messenger Notification Triggered]', { sender: title, body: content, avatar: avatarUrl });

        let base64Avatar = '';
        if (avatarUrl) {
            try {
                const res = await fetch(avatarUrl);
                const blob = await res.blob();
                base64Avatar = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1] || '');
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(blob);
                });
            } catch (e) {}
        }

        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) {
                window.webkit.messageHandlers.notify.postMessage(`${title}\n${content}\n${base64Avatar}`);
            }
        } catch (e) {
            console.error('[Messenger Preload] IPC Error:', e);
        }
    }

    // 從 DOM 對話列表中精確抓取最新一則訊息的寄件者、乾淨內文與頭像
    function extractLatestChatFromDOM() {
        try {
            const rows = document.querySelectorAll(
                'div[role="row"], div[role="listitem"], a[role="link"][href*="/messages/t/"], a[href*="/messages/t/"]'
            );
            for (const row of rows) {
                // 提取頭像
                let avatarUrl = '';
                const img = row.querySelector('img[src*="fbcdn"], img[src*="http"]');
                if (img && img.src) {
                    avatarUrl = img.src;
                }

                const text = row.innerText || '';
                const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
                if (lines.length >= 2) {
                    const sender = lines[0];
                    const contentLines = [];
                    for (let i = 1; i < lines.length; i++) {
                        const l = lines[i]
                            .replace(/^(未讀訊息[：:]*|Unread message[：:]*|Unread[：:]*)/i, '')
                            .trim();
                        if (!l) continue;
                        // 忽略純時間與狀態標記
                        if (/^(\d{1,2}:\d{2}|\d+\s*(秒|分|小時|天|週|年|s|m|h|d|w|y)|剛剛|昨天|前天)$/i.test(l)) continue;
                        if (['已傳送', '已送達', '已看過', 'Sent', 'Delivered', 'Seen'].includes(l)) continue;
                        contentLines.push(l);
                    }

                    const body = contentLines.join(' ') || '您收到了一則新訊息';
                    const ignored = ['Messenger', '搜尋', 'Search', 'Chats', '對話', '收件匣', 'Inbox', '訊息', 'Messages', '隱藏的聊天室'];
                    if (sender && !ignored.includes(sender) && !sender.startsWith('http')) {
                        return { sender, body, avatarUrl };
                    }
                }
            }
        } catch (e) {
            console.error('[Messenger Preload] DOM extract error:', e);
        }
        return null;
    }

    // 1. 偽裝 Visibility API 保活
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

    // 4. 監聽 Document Title 與未讀計數變化
    function handleTitleChange(newTitle) {
        if (!newTitle || newTitle === lastKnownTitle) return;
        lastKnownTitle = newTitle;

        if (!isReady) return;

        console.log('[Messenger Preload] Title changed to:', newTitle);

        // 格式 A：標題包含寄件者與動作，例如 "小明 傳送了一則訊息"
        if (/傳送了一則訊息|sent a message|說：|said:/i.test(newTitle)) {
            const cleanTitle = newTitle.replace(/^\(\d+\)\s*/, '');
            const colonIndex = cleanTitle.indexOf('：') !== -1 ? cleanTitle.indexOf('：') : cleanTitle.indexOf(':');
            if (colonIndex !== -1) {
                const sender = cleanTitle.substring(0, colonIndex);
                const body = cleanTitle.substring(colonIndex + 1);
                sendNativeNotification(sender, body, '');
                return;
            }
            sendNativeNotification('Messenger', cleanTitle, '');
            return;
        }

        // 格式 B：未讀計數增加（例如 (4) 變 (5)）
        const match = newTitle.match(/^\((\d+)\)/);
        if (match) {
            const currentUnread = parseInt(match[1], 10);
            if (currentUnread > lastUnreadCount) {
                lastUnreadCount = currentUnread;
                const domData = extractLatestChatFromDOM();
                if (domData) {
                    sendNativeNotification(domData.sender, domData.body, domData.avatarUrl);
                } else {
                    sendNativeNotification('Messenger', '您收到了一則新訊息', '');
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

    setInterval(() => {
        handleTitleChange(document.title);
    }, 1000);
})();
