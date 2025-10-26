/**
 * ----------------------------------------------------
 * Liquid Glass 自製捲動軸 (LGScroll Class 重構版)
 * ----------------------------------------------------
 * 核心原理: 禁用原生滾動，透過 requestAnimationFrame 
 * 使用 CSS transform 實現平滑滾動。
 *
 * @class LGScroll
 * @author Bing AI (Refactored by Assistant)
 * @version 2.0.0
 */

class LGScroll {
    /**
     * @param {object} opts - 選項
     * @param {HTMLElement} opts.root - 滾動的根容器 (viewport)
     * @param {HTMLElement} opts.content - 滾動的內容元素
     * @param {HTMLElement} opts.bar - 整個滾動條容器
     * @param {HTMLElement} opts.track - 滾動條軌道
     * @param {HTMLElement} opts.thumb - 滾動條把手
     * @param {boolean} [opts.stopBubbleOnWheel=false] - 滾動到底/頂時是否阻止事件冒泡
     * @param {number} [opts.minThumb=32] - 把手最小高度 (px)
     * @param {number} [opts.wheelStep=60] - 滾輪滾動一次的距離 (px)
     * @param {number} [opts.easing=0.18] - 滾動平滑動畫的緩動係數 (0-1)
     * @param {number} [opts.autoHideMs=1600] - 停止活動後自動隱藏滾動條的延遲 (ms)
     */
    constructor(opts) {
        // 確保所有必要的 DOM 元素存在
        if (!opts.root || !opts.content || !opts.bar || !opts.track || !opts.thumb) {
            console.error('LGScroll: 缺少必要的 DOM 元素:', opts);
            return;
        }

        this.root = opts.root;
        this.content = opts.content;
        this.bar = opts.bar;
        this.track = opts.track;
        this.thumb = opts.thumb;

        // 設定
        this.stopBubbleOnWheel = opts.stopBubbleOnWheel || false;
        this.minThumb = opts.minThumb || 32;
        this.wheelStep = opts.wheelStep || 60;
        this.easing = opts.easing || 0.18;
        this.autoHideMs = opts.autoHideMs || 1600;

        // 內部狀態
        this.viewportH = 0;
        this.contentH = 0;
        this.maxScroll = 0;
        this.trackH = 0;
        this.thumbH = 0;
        this.scrollY = 0;    // 當前實際滾動位置 (被動畫影響)
        this.targetY = 0;    // 目標滾動位置 (平滑動畫的終點)
        this.rafId = null;
        this.lastActiveTs = 0;
        this.dragging = false;
        this.dragStartY = 0;
        this.dragStartScroll = 0;

        // 檢查使用者是否偏好減少動態效果
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 初始化
        this.bindEvents();
        this.measure();
        this.maybeAutoHideSoon();
    }

    /**
     * 將一個值限制在指定的範圍內
     */
    clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    /**
     * 測量所有尺寸並更新滾動條狀態
     */
    measure = () => {
        this.viewportH = this.root.clientHeight;
        this.contentH = this.content.scrollHeight;
        this.maxScroll = Math.max(0, this.contentH - this.viewportH);
        this.trackH = this.track.clientHeight;

        const ratio = this.viewportH / Math.max(1, this.contentH);
        this.thumbH = this.clamp(this.minThumb, Math.round(this.trackH * ratio), this.trackH);
        this.thumb.style.height = this.thumbH + 'px';

        // 決定滾動條是否可見 (內容不需滾動時隱藏)
        this.bar.classList.toggle('lg-hidden', this.maxScroll <= 1);

        // 校正目標位置，防止內容變短時滾動位置溢出
        this.setTarget(this.targetY, true);
        this.updateThumb();
    }

    /**
     * 根據 scrollY 更新滾動條把手的位置
     */
    updateThumb() {
        if (this.maxScroll <= 0) return;
        const range = this.trackH - this.thumbH;
        const thumbPos = (range * (this.scrollY / this.maxScroll));
        // 使用 translate 比 top/left 性能更好
        this.thumb.style.transform = `translateY(${thumbPos}px)`;
    }

    /**
     * 立即應用滾動位置，繞過平滑動畫
     * @param {number} next - 新的滾動位置
     */
    applyScrollImmediate(next) {
        this.scrollY = this.clamp(next, 0, this.maxScroll);
        this.content.style.transform = `translate3d(0, ${-this.scrollY}px, 0)`;
        this.updateThumb();
    }

    /**
     * 設定滾動目標位置並啟動平滑動畫
     * @param {number} y - 目標滾動位置
     * @param {boolean} [immediate=false] - 是否立即應用，不啟動動畫
     */
    setTarget(y, immediate = false) {
        this.targetY = this.clamp(y, 0, this.maxScroll);

        if (immediate || this.prefersReducedMotion) {
            this.applyScrollImmediate(this.targetY);
            this.stopRAF();
        } else {
            this.lastActiveTs = performance.now();
            this.bar.classList.add('lg-visible');
            this.startRAF();
        }
    }

    // --- 動畫核心 ---
    animate = () => {
        const diff = this.targetY - this.scrollY;

        // 如果差距小於 0.5px，直接定位並停止動畫，避免無限循環
        if (Math.abs(diff) < 0.5) {
            this.applyScrollImmediate(this.targetY);
            this.stopRAF();
            this.maybeAutoHideSoon();
            return;
        }

        // 線性插值 (Lerp) 實現平滑效果
        this.applyScrollImmediate(this.scrollY + diff * this.easing);
        this.rafId = requestAnimationFrame(this.animate);
    }

    startRAF() {
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(this.animate);
        }
    }

    stopRAF() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * 檢查並在一段時間後自動隱藏滾動條
     */
    maybeAutoHideSoon() {
        // 如果正在拖曳，則不隱藏
        if (this.dragging) return;

        const now = performance.now();
        const timeSinceActive = now - this.lastActiveTs;

        if (timeSinceActive >= this.autoHideMs) {
            this.bar.classList.remove('lg-visible');
        } else {
            // 設定一個計時器以確保在延遲時間到達後隱藏
            setTimeout(() => {
                if (!this.dragging && performance.now() - this.lastActiveTs >= this.autoHideMs) {
                    this.bar.classList.remove('lg-visible');
                }
            }, this.autoHideMs - timeSinceActive + 10);
        }
    }


    // --- 事件處理器 ---

    handleWheel = (e) => {
        if (this.maxScroll <= 0) return; // 內容不可滾動時忽略

        e.preventDefault();
        if (this.stopBubbleOnWheel) {
            e.stopPropagation();
        }

        const delta = (e.deltaY || 0);
        // 按住 Ctrl 加速滾動
        const base = e.ctrlKey ? this.wheelStep * 3 : this.wheelStep;
        // 根據滾輪的 delta 值調整步長，以應對觸控板的平滑滾動
        const step = base * Math.max(1, Math.min(3, Math.abs(delta) / 100));

        this.setTarget(this.targetY + (delta > 0 ? step : -step));
    }

    handleKeyDown = (e) => {
        // 全局監聽，但只在特定條件下作用
        const isHovered = this.root.matches(':hover');
        // 對於聊天室，即使沒 hover，只要是開啟狀態就響應
        const isChatWidget = this.root.id === 'chat-scroll-root';
        const isChatOpen = isChatWidget && document.getElementById('chat-widget')?.classList.contains('is-open');

        if (!isHovered && !isChatOpen) return;

        // 如果焦點在輸入框內，則不觸發滾動
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

        let handled = true;
        switch (e.key) {
            case 'ArrowDown': this.setTarget(this.targetY + this.wheelStep); break;
            case 'ArrowUp': this.setTarget(this.targetY - this.wheelStep); break;
            case 'PageDown': this.setTarget(this.targetY + this.viewportH * 0.9); break;
            case 'PageUp': this.setTarget(this.targetY - this.viewportH * 0.9); break;
            case 'Home': this.setTarget(0); break;
            case 'End': this.setTarget(this.maxScroll); break;
            default: handled = false;
        }
        if (handled) e.preventDefault();
    }

    handleThumbMousedown = (e) => {
        if (this.maxScroll <= 0) return;
        e.preventDefault();
        e.stopPropagation();

        this.dragging = true;
        this.dragStartY = e.clientY;
        this.dragStartScroll = this.scrollY;

        this.bar.classList.add('lg-visible');
        document.documentElement.classList.add('lg-dragging'); // 讓鼠標在整個頁面都顯示為拖曳狀態
    }

    handleWindowMousemove = (e) => {
        if (!this.dragging) return;

        const dy = e.clientY - this.dragStartY;
        const range = Math.max(1, this.trackH - this.thumbH);

        // 計算把手位移對應的內容滾動量
        const scrollDelta = (dy / range) * this.maxScroll;

        // 拖曳時立即更新位置，不使用平滑動畫以獲得最佳響應
        this.setTarget(this.dragStartScroll + scrollDelta, true);
    }

    handleWindowMouseup = () => {
        if (!this.dragging) return;
        this.dragging = false;
        document.documentElement.classList.remove('lg-dragging');
        this.maybeAutoHideSoon();
    }

    handleTrackMousedown = (e) => {
        if (this.maxScroll <= 0 || e.target === this.thumb) return;
        e.preventDefault();

        const rect = this.track.getBoundingClientRect();
        const clickY = e.clientY - rect.top; // 點擊位置相對於 track 頂部
        const thumbHalf = this.thumbH / 2;

        // 計算點擊位置應該對應的滾動目標 (以把手中心對齊點擊處)
        const targetThumbY = clickY - thumbHalf;
        const scrollRatio = targetThumbY / (this.trackH - this.thumbH);

        this.setTarget(this.maxScroll * scrollRatio);
    }

    handleResize = () => {
        this.measure();
    }

    // --- 初始化綁定與銷毀 ---
    bindEvents() {
        this.root.addEventListener('wheel', this.handleWheel, { passive: false });
        // 將鍵盤事件綁定到 window，在處理函數內部判斷是否該響應
        window.addEventListener('keydown', this.handleKeyDown);

        // 拖曳事件
        this.thumb.addEventListener('mousedown', this.handleThumbMousedown);
        this.track.addEventListener('mousedown', this.handleTrackMousedown);
        // 在 window 上監聽 move 和 up，以防滑鼠移出元素時拖曳中斷
        window.addEventListener('mousemove', this.handleWindowMousemove);
        window.addEventListener('mouseup', this.handleWindowMouseup);

        // 使用 ResizeObserver 監聽內容和視窗尺寸變化
        this.ro = new ResizeObserver(this.handleResize);
        this.ro.observe(this.content);
        this.ro.observe(this.root);
    }

    /**
     * 銷毀實例，移除所有事件監聽器
     */
    teardown() {
        this.stopRAF();
        this.root.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('keydown', this.handleKeyDown);
        this.thumb.removeEventListener('mousedown', this.handleThumbMousedown);
        this.track.removeEventListener('mousedown', this.handleTrackMousedown);
        window.removeEventListener('mousemove', this.handleWindowMousemove);
        window.removeEventListener('mouseup', this.handleWindowMouseup);
        this.ro.disconnect();
        this.ro = null;
    }

    // --- 外部呼叫 API ---
    scrollTo(y) { this.setTarget(y); }
    scrollToEnd() { this.measure(); this.setTarget(this.maxScroll, this.prefersReducedMotion); } // 新增：滾動到底部前先測量
    forceMeasure() { this.measure(); } // 供異步載入內容後呼叫
}


// --- 實例化與啟動 ---
(function initLGScrollSystem() {
    // 延遲到 DOM 載入完成
    document.addEventListener('DOMContentLoaded', () => {

        // ==== 主頁面實例 (Main) ====
        const mainScroll = new LGScroll({
            root: document.getElementById('lg-scroll-root'),
            content: document.getElementById('lg-scroll-content'),
            bar: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat)'),
            track: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat) .lg-scrollbar-track'),
            thumb: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat) .lg-scrollbar-thumb'),
            stopBubbleOnWheel: false, // 主頁面滾動到底/頂時，允許事件冒泡 (雖然body也禁用了)
        });

        // ==== 聊天室實例 (Chat) ====
        const chatRoot = document.getElementById('chat-scroll-root');
        let chatScroll = null;
        if (chatRoot) {
            const chatBar = chatRoot.querySelector('.lg-scrollbar--chat');
            chatScroll = new LGScroll({
                root: chatRoot,
                content: document.getElementById('chat-scroll-content'),
                bar: chatBar,
                track: chatBar.querySelector('.lg-scrollbar-track'),
                thumb: chatBar.querySelector('.lg-scrollbar-thumb'),
                stopBubbleOnWheel: true, // 聊天室滾動到底/頂時，禁止事件冒泡到主頁面
                minThumb: 24,
                easing: 0.2, // 讓聊天室滾動更靈敏
                wheelStep: 40,
            });
        }

        // --- Chat 自動滾動邏輯 (調整為使用 Class API) ---
        if (chatScroll) {
            const chatBox = document.getElementById('chat-box');
            if (chatBox) {
                // 當聊天內容增加時，自動滾動到底部
                const mo = new MutationObserver(() => {
                    // 使用我們為 Class 設計的公開 API
                    chatScroll.scrollToEnd();
                });
                mo.observe(chatBox, { childList: true });

                // 觀察聊天視窗是否開啟 (確保捲軸在開啟時立即正確測量)
                const widget = document.getElementById('chat-widget');
                if (widget) {
                    new MutationObserver((mutations) => {
                        for (const mutation of mutations) {
                            if (mutation.attributeName === 'class' && widget.classList.contains('is-open')) {
                                chatScroll.forceMeasure();
                                chatScroll.scrollToEnd();
                            }
                        }
                    }).observe(widget, { attributes: true, attributeFilter: ['class'] });
                }
            }
        }

        // ✅ 將實例暴露到 window，方便在其他地方 (如 console) 調用和調試
        window.LGScrollInstances = { main: mainScroll, chat: chatScroll };

        // 提示: 如果主頁面內容是異步載入的，請在內容載入完成後調用:
        // window.LGScrollInstances.main.forceMeasure();
    });
})();