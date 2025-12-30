const API_URL = "https://geminiapi.zssdmrofficial.workers.dev/"; 
const CHAT_STATE_KEY = 'chat_state_v1';

function isHardReload() {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation');
    if (nav && nav.length) return nav[0].type === 'reload';
    if (performance.navigation) return performance.navigation.type === 1;
    return false;
}

let __restored = false;
try {
    const raw = sessionStorage.getItem(CHAT_STATE_KEY);
    if (raw && !isHardReload()) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.history) && saved.history.length) {
            window.__CHAT_HISTORY__ = saved.history;
            window.__CHAT_OPEN__ = !!saved.open;
            __restored = true;
        }
    } else if (isHardReload()) {
        sessionStorage.removeItem(CHAT_STATE_KEY);
    }
} catch (e) {
    console.warn('恢復聊天狀態失敗：', e);
}

if (!__restored) {
    window.__CHAT_HISTORY__ = window.__CHAT_HISTORY__ || [
        { role: "user", parts: [{ text: SYSTEM_INSTRUCTION + "請根據這個設定，對使用者說一個友善的開場白。" }] },
        { role: "model", parts: [{ text: "同志您好！我是思想小助手，很高興能為您服務。本共和國以厚道為核心，請問您有什麼疑問或需要協助的地方嗎？" }] },
    ];
}
let history = window.__CHAT_HISTORY__;

const chatToggleEl = document.getElementById("chat-toggle");
const chatWidgetEl = document.getElementById("chat-widget");
const inputEl = document.getElementById("user-input");
const chatBoxEl = document.getElementById("chat-box");
const sendButtonEl = document.getElementById("send-button");

if (chatWidgetEl && typeof window.__CHAT_OPEN__ === 'boolean') {
    chatWidgetEl.style.display = window.__CHAT_OPEN__ ? "block" : "none";
}

function escapeHtml(text) {
    if (typeof text !== "string") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtml(text) {
    if (typeof text !== "string") return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function markdownToHtml(mdText) {
    if (typeof mdText !== "string") return "";

    const rawHtml = marked.parse(mdText, {
        gfm: true,
        breaks: true,
    });

    const finalHtml = rawHtml.replace(
        /<pre><code(?:\s+class="language-([^"]*)")?>((?:.|\n|\r)*?)<\/code><\/pre>/gi,
        (match, lang, code) => {
            const language = lang ? escapeHtml(lang) : "";
            return (
                `<div class="code-container">` +
                `<button type="button" class="copy-button">複製</button>` +
                `<pre><code class="code-content"${language ? ` data-lang="${language}"` : ""}>${code}</code></pre>` +
                `</div>`
            );
        }
    );

    return finalHtml;
}

function fallbackCopyTextToClipboard(text) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.setAttribute("readonly", "");
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return !!successful;
    } catch (err) {
        try {
            const textArea2 = document.createElement("textarea");
            textArea2.value = text;
            textArea2.style.position = "fixed";
            textArea2.style.left = "-9999px";
            textArea2.style.top = "0";
            document.body.appendChild(textArea2);
            textArea2.select();
            const successful2 = document.execCommand('copy');
            document.body.removeChild(textArea2);
            return !!successful2;
        } catch (err2) {
            console.error('[fallbackCopy] 兩種傳統複製方式皆失敗', err2);
            return false;
        }
    }
}

function initCopyHandler(chatBoxEl) {
    if (!chatBoxEl) {
        console.warn('[initCopyHandler] chatBoxEl 為空，請傳入 chatBoxEl DOM 節點');
        return;
    }

    if (chatBoxEl.__copyHandlerBound__) return;
    chatBoxEl.__copyHandlerBound__ = true;

    chatBoxEl.addEventListener('click', async (ev) => {
        const btn = ev.target.closest ? ev.target.closest('.copy-button') : null;
        if (!btn) return;

        const container = btn.closest('.code-container');
        if (!container) {
            console.warn('[copyHandler] 找不到 .code-container');
            return;
        }
        const codeEl = container.querySelector('.code-content');
        const textToCopy = (codeEl && codeEl.textContent) ? codeEl.textContent : '';

        const origText = btn.textContent;
        btn.disabled = true;

        let done = false;
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(textToCopy);
                btn.textContent = '已複製!';
                done = true;
            }
        } catch (err) {
            console.warn('[copyHandler] navigator.clipboard.writeText 失敗，改用 fallback', err);
            done = false;
        }

        if (!done) {
            try {
                const ok = fallbackCopyTextToClipboard(textToCopy);
                if (ok) {
                    btn.textContent = '已複製!';
                    done = true;
                } else {
                    btn.textContent = '複製失敗';
                }
            } catch (err) {
                console.error('[copyHandler] fallbackCopy 發生例外', err);
                btn.textContent = '複製失敗';
            }
        }

        if (!done) {
            console.log('[copyHandler] 最後降級處理，請手動複製');
        }

        setTimeout(() => {
            btn.textContent = origText || '複製';
            btn.disabled = false;
        }, 1800);
    });

    const existingContainers = chatBoxEl.querySelectorAll('.code-container');
    existingContainers.forEach((c) => {
        if (!c.querySelector('.copy-button')) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'copy-button';
            b.textContent = '複製';
            c.insertBefore(b, c.firstChild);
        }
    });
}

function displayInitialMessage() {
    if (chatBoxEl.children.length > 0) return;
    const initial = history.find((x) => x.role === "model")?.parts?.[0]?.text || "";
    if (!initial) return;
    const html = markdownToHtml(initial);
    chatBoxEl.innerHTML += `<p><b>小助手:</b> ${html}</p>`;
    chatBoxEl.scrollTo({ top: chatBoxEl.scrollHeight, behavior: 'smooth' });
}

function renderMessage(role, content, isError = false) {
    const who = role === "user" ? "你" : "小助手";
    let html;

    const messageEl = document.createElement('div');
    messageEl.className = 'message-wrapper';

    if (isError) {
        html = escapeHtml(content);
        messageEl.style.color = "var(--accent-color)";
        messageEl.innerHTML = `<b>${who} (錯誤):</b> ${html}`;
    } else if (role === "user") {
        html = escapeHtml(content);
        messageEl.innerHTML = `<b>${who}:</b> ${html}`;
    } else {
        html = markdownToHtml(content);
        messageEl.innerHTML = `<b>${who}:</b> ${html}`;
    }

    chatBoxEl.appendChild(messageEl);
    chatBoxEl.scrollTo({ top: chatBoxEl.scrollHeight, behavior: 'smooth' });
}

async function callApiWithRetry(body, maxRetries = Infinity) {
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        console.log(`[API] 嘗試第 ${attempt} 次呼叫...`);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.status === 503) {
                console.warn(`[API] 503 超載，第 ${attempt} 次 → 立即重試`);
                continue;
            }

            if (res.status === 429) {
                let retryAfter = parseInt(res.headers.get("Retry-After") || "0", 10);

                if (!retryAfter) {
                    const errData = await res.json().catch(() => ({}));
                    const msg = errData?.error?.message || "";
                    const match = msg.match(/retry in ([\d.]+)s/i);
                    if (match) retryAfter = Math.ceil(parseFloat(match[1]));
                }
                if (!retryAfter) retryAfter = 5;

                console.warn(`[API] 429 配額超限 → 等待 ${retryAfter} 秒再重試 (第 ${attempt} 次)`);

                await showCooldownCountdown(retryAfter);

                continue;
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error(`[API] 非 503/429 錯誤: ${res.status}`, err);
                throw new Error(`API 失敗: ${res.status} ${res.statusText} - ${err?.error?.message || "未知錯誤"}`);
            }

            console.log(`[API] 成功! 第 ${attempt} 次呼叫返回結果`);
            return await res.json();

        } catch (e) {
            console.error(`[API] 呼叫失敗 (第 ${attempt} 次):`, e);
            throw e;
        }
    }
    throw new Error("已達最大重試次數仍失敗");
}

async function showCooldownCountdown(seconds) {
    return new Promise((resolve) => {
        let remaining = seconds;
        const loadingEl = document.getElementById("loading-message");

        console.log(`[COOLDOWN] 進入冷卻，總共 ${seconds} 秒`);

        const timer = setInterval(() => {
            if (loadingEl) {
                loadingEl.innerHTML = `<b>小助手:</b> <i>思想小助手回應中...(等待 ${remaining} 秒冷卻)</i>`;
            }
            console.log(`[COOLDOWN] 剩餘 ${remaining} 秒`);
            remaining--;

            if (remaining <= 0) {
                clearInterval(timer);
                if (loadingEl) {
                    loadingEl.innerHTML = `<b>小助手:</b> <i>思想小助手回應中...</i>`;
                }
                console.log(`[COOLDOWN] 冷卻結束，準備重試 API`);
                resolve();
            }
        }, 1000);
    });
}

async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) {
        inputEl.classList.add('shake');
        setTimeout(() => inputEl.classList.remove('shake'), 500);
        return;
    }

    renderMessage("user", text);
    history.push({ role: "user", parts: [{ text }] });
    persistChatState();

    inputEl.value = "";
    inputEl.disabled = true;
    sendButtonEl.disabled = true;

    const loadingEl = document.createElement("div");
    loadingEl.className = 'message-wrapper';
    loadingEl.id = "loading-message";
    loadingEl.innerHTML = `<b>小助手:</b> <i>思想小助手回應中...</i>`;
    chatBoxEl.appendChild(loadingEl);
    chatBoxEl.scrollTo({ top: chatBoxEl.scrollHeight, behavior: 'smooth' });

    try {
        const data = await callApiWithRetry({ contents: history });

        document.getElementById("loading-message")?.remove();

        if (data.candidates?.length) {
            const c = data.candidates[0];
            const parts = c.content?.parts || [];
            const reply = parts.map((p) => p.text || "").join(" ").trim();

            if (reply) {
                history.push({ role: "model", parts: [{ text: reply }] });
                persistChatState();

                renderMessage("model", reply);
            } else {
                renderMessage("model", `回傳沒有文字或被過濾 (finishReason: ${c.finishReason || "未知"})`, true);
            }
        } else if (data.error) {
            renderMessage("model", `API 錯誤: ${data.error.message}`, true);
        } else {
            renderMessage("model", `API 回傳格式不正確或無候選回覆`, true);
        }
    } catch (e) {
        console.error(e);
        document.getElementById("loading-message")?.remove();
        renderMessage("model", `請求失敗: ${e.message}`, true);
    } finally {
        inputEl.disabled = false;
        sendButtonEl.disabled = false;
        inputEl.focus();
    }
}

chatToggleEl?.addEventListener("click", () => {
    const isHidden = chatWidgetEl.style.display === "none" || chatWidgetEl.style.display === "";

    if (isHidden) {
        chatWidgetEl.style.opacity = '0';
        chatWidgetEl.style.transform = 'translateY(10px) scale(0.95)';
        chatWidgetEl.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        chatWidgetEl.style.display = "block";
        window.__CHAT_OPEN__ = true;
        persistChatState();

        setTimeout(() => {
            chatWidgetEl.style.opacity = '1';
            chatWidgetEl.style.transform = 'translateY(0) scale(1)';
        }, 10);

        inputEl.focus();
        displayInitialMessage();
    } else {
        chatWidgetEl.style.opacity = '0';
        chatWidgetEl.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => {
            chatWidgetEl.style.display = "none";
            chatWidgetEl.style.opacity = '';
            chatWidgetEl.style.transform = '';
            chatWidgetEl.style.transition = '';
            window.__CHAT_OPEN__ = false;
            persistChatState();
        }, 300);
    }
});

sendButtonEl?.addEventListener("click", sendMessage);

inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const hint = document.getElementById('chat-hint');
    if (!hint) return;

    if (!isHardReload()) return;

    setTimeout(() => hint.classList.add('show'), 500);
    setTimeout(() => hint.classList.remove('show'), 4500);
});

function persistChatState() {
    try {
        const payload = {
            history: window.__CHAT_HISTORY__ || [],
            open: !!window.__CHAT_OPEN__
        };
        sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('儲存聊天狀態失敗：', e);
    }
}

window.addEventListener('pagehide', persistChatState);
window.addEventListener('beforeunload', persistChatState);

function renderAllFromHistoryOnce() {
    if (!chatBoxEl) return;
    if (!Array.isArray(history) || !history.length) return;
    if (chatBoxEl.__hydrated__) return;
    chatBoxEl.__hydrated__ = true;

    chatBoxEl.innerHTML = '';
    for (const msg of history) {
        const text = (msg?.parts?.[0]?.text) || '';
        if (!text) continue;
        if (text.includes(SYSTEM_INSTRUCTION)) {
            continue;
        }
        renderMessage(msg.role === 'user' ? 'user' : 'model', text);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderAllFromHistoryOnce();

    if (chatWidgetEl && window.__CHAT_OPEN__) {
        inputEl?.focus?.();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initCopyHandler(document.getElementById('chat-box'));
});
