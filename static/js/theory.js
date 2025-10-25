// static/js/quotes-router.js
async function loadMarkdown(path, containerId) {
    try {
        // 1️⃣ 取得 Markdown 檔案
        const res = await fetch(path);
        if (!res.ok) throw new Error("Fetch failed: " + res.status);
        const text = await res.text();

        // 2️⃣ 轉成 HTML 並插入頁面
        const container = document.getElementById(containerId);
        container.innerHTML = marked.parse(text);

        // 3️⃣ 若有 Liquid Glass Scroll 系統，重新計算高度
        if (window.LGScroll && window.LGScroll.quotes) {
            window.LGScroll.quotes.measure();
        }
    } catch (err) {
        console.error("載入 Markdown 時發生錯誤：", err);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML =
                "<p style='color:red;'>紅色宇宙論載入失敗 (｡>﹏<｡)</p>";
        }
    }
}

// ✅ 當頁面載入完成時立即渲染 Markdown
window.addEventListener("DOMContentLoaded", () => {
    loadMarkdown("/assets/紅色宇宙論.md", "quotes-text-container");
});
