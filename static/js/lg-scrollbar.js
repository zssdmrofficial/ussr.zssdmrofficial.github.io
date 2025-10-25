/* 自製 Liquid Glass 虛擬捲動軸（可重複實例：主頁面 + 聊天室 + 紅色宇宙論文字版） */
(function () {
    'use strict';

    function createLGScroll(opts) {
        const {
            root, content, bar, track, thumb,
            stopBubbleOnWheel = false,
            minThumb = 32,
            wheelStep = 60,
            easing = 0.18,
            autoHideMs = 1600,
        } = opts;

        if (!root || !content || !bar || !track || !thumb) return null;

        let viewportH = 0, contentH = 0, maxScroll = 0, trackH = 0, thumbH = 0;
        let scrollY = 0, targetY = 0;
        let rafId = null, lastActiveTs = 0;
        let dragging = false, dragStartY = 0, dragStartScroll = 0;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

        function measure() {
            viewportH = root.clientHeight;
            contentH = content.scrollHeight;
            maxScroll = Math.max(0, contentH - viewportH);
            trackH = track.clientHeight;

            const ratio = viewportH / Math.max(1, contentH);
            thumbH = Math.max(minThumb, Math.round(trackH * ratio));
            thumb.style.height = thumbH + 'px';

            bar.classList.toggle('lg-hidden', maxScroll <= 1);
            updateThumb();
        }

        function applyScrollImmediate(next) {
            scrollY = clamp(next, 0, maxScroll);
            content.style.transform = `translate3d(0, ${-scrollY}px, 0)`;
            updateThumb();
        }

        function updateThumb() {
            const range = Math.max(1, trackH - thumbH);
            const t = (range * (scrollY / Math.max(1, maxScroll)));
            thumb.style.transform = `translateY(${t}px)`;
        }

        function animate() {
            if (prefersReducedMotion) {
                applyScrollImmediate(targetY);
                stopRAF();
                maybeAutoHideSoon();
                return;
            }
            const diff = targetY - scrollY;
            if (Math.abs(diff) < 0.5) {
                applyScrollImmediate(targetY);
                stopRAF();
                maybeAutoHideSoon();
                return;
            }
            applyScrollImmediate(scrollY + diff * easing);
            rafId = requestAnimationFrame(animate);
        }

        function startRAF() {
            if (!rafId) rafId = requestAnimationFrame(animate);
        }
        function stopRAF() {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }
        function setTarget(y) {
            targetY = clamp(y, 0, maxScroll);
            lastActiveTs = performance.now();
            bar.classList.add('lg-visible');
            startRAF();
        }
        function maybeAutoHideSoon() {
            const now = performance.now();
            const left = autoHideMs - (now - lastActiveTs);
            if (left <= 0) {
                bar.classList.remove('lg-visible');
                return;
            }
            setTimeout(() => {
                const nnow = performance.now();
                if (nnow - lastActiveTs >= autoHideMs) {
                    bar.classList.remove('lg-visible');
                }
            }, Math.ceil(left) + 10);
        }

        const wheelHandler = (e) => {
            e.preventDefault();
            if (stopBubbleOnWheel) e.stopPropagation();
            const delta = (e.deltaY || 0);
            const base = e.ctrlKey ? wheelStep * 3 : wheelStep;
            const step = base * Math.max(1, Math.min(3, Math.abs(delta) / 100));
            setTarget(targetY + (delta > 0 ? step : -step));
        };
        root.addEventListener('wheel', wheelHandler, { passive: false });

        window.addEventListener('keydown', (e) => {
            const ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
            const hovered = root.matches(':hover');
            if (!hovered) return;

            let handled = true;
            switch (e.key) {
                case 'ArrowDown': setTarget(targetY + wheelStep); break;
                case 'ArrowUp': setTarget(targetY - wheelStep); break;
                case 'PageDown': setTarget(targetY + viewportH * 0.9); break;
                case 'PageUp': setTarget(targetY - viewportH * 0.9); break;
                case 'Home': setTarget(0); break;
                case 'End': setTarget(maxScroll); break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
        }, { passive: false });

        let touchStartY = 0;
        let touchStartScroll = 0;
        root.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            touchStartY = e.touches[0].clientY;
            touchStartScroll = targetY;
            bar.classList.add('lg-visible');
        }, { passive: true });

        root.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const dy = touchStartY - e.touches[0].clientY;
            setTarget(touchStartScroll + dy);
            if (stopBubbleOnWheel) e.stopPropagation();
        }, { passive: true });

        track.addEventListener('mousedown', (e) => {
            if (e.target === thumb) return;
            const rect = track.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const thumbRect = thumb.getBoundingClientRect();
            if (y < thumbRect.top - rect.top) {
                setTarget(targetY - viewportH * 0.9);
            } else {
                setTarget(targetY + viewportH * 0.9);
            }
            e.preventDefault();
        });

        thumb.addEventListener('mousedown', (e) => {
            dragging = true;
            dragStartY = e.clientY;
            dragStartScroll = scrollY;
            bar.classList.add('lg-visible');
            document.documentElement.classList.add('lg-dragging');
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dy = e.clientY - dragStartY;
            const range = Math.max(1, trackH - thumbH);
            const ratio = dy / range;
            setTarget(dragStartScroll + ratio * maxScroll);
        });
        window.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.documentElement.classList.remove('lg-dragging');
            maybeAutoHideSoon();
        });

        window.addEventListener('resize', measure);
        const ro = new ResizeObserver(measure);
        ro.observe(content);

        measure();
        applyScrollImmediate(0);
        maybeAutoHideSoon();

        return {
            measure,
            scrollTo: (y) => setTarget(y),
            scrollToEnd: () => setTarget(maxScroll),
            getMaxScroll: () => maxScroll,
            getScrollY: () => scrollY,
            teardown: () => {
                root.removeEventListener('wheel', wheelHandler);
                stopRAF();
                ro.disconnect();
            },
        };
    }

    // ==== 主頁面實例 ====
    const main = createLGScroll({
        root: document.getElementById('lg-scroll-root'),
        content: document.getElementById('lg-scroll-content'),
        bar: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat)'),
        track: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat) .lg-scrollbar-track'),
        thumb: document.querySelector('.lg-scrollbar:not(.lg-scrollbar--chat) .lg-scrollbar-thumb'),
        stopBubbleOnWheel: false,
    });

    // ==== 聊天室實例 ====
    const chatRoot = document.getElementById('chat-scroll-root');
    const chat = createLGScroll({
        root: chatRoot,
        content: document.getElementById('chat-scroll-content'),
        bar: chatRoot ? chatRoot.querySelector('.lg-scrollbar--chat') : null,
        track: chatRoot ? chatRoot.querySelector('.lg-scrollbar--chat .lg-scrollbar-track') : null,
        thumb: chatRoot ? chatRoot.querySelector('.lg-scrollbar--chat .lg-scrollbar-thumb') : null,
        stopBubbleOnWheel: true,
        minThumb: 24,
    });

    // ==== 紅色宇宙論（theory）文字版實例 ====
    const theoryRoot = document.getElementById('theory-text-root');
    const theory = createLGScroll({
        root: theoryRoot,
        content: theoryRoot ? theoryRoot.querySelector('.lg-scroll-content') : null,
        bar: theoryRoot ? theoryRoot.querySelector('.lg-scrollbar') : null,
        track: theoryRoot ? theoryRoot.querySelector('.lg-scrollbar .lg-scrollbar-track') : null,
        thumb: theoryRoot ? theoryRoot.querySelector('.lg-scrollbar .lg-scrollbar-thumb') : null,
        stopBubbleOnWheel: false,
    });

    (function autoStickBottom() {
        if (!chatRoot || !chat) return;
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;

        const mo = new MutationObserver(() => {
            chat.measure();
            chat.scrollToEnd();
        });
        mo.observe(chatBox, { childList: true, subtree: true, characterData: true });

        const widget = document.getElementById('chat-widget');
        if (widget) {
            const io = new IntersectionObserver(() => {
                chat.measure();
            });
            io.observe(widget);
        }
    })();

    // ✅ 對外暴露（已改為 theory）
    window.LGScroll = { main, chat, theory };
})();
