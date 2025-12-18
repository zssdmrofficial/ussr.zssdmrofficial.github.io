async function loadMarkdownContent(path, containerId) {
    try {

        const res = await fetch(path);
        if (!res.ok) throw new Error("Fetch failed: " + res.status);
        const text = await res.text();


        const container = document.getElementById(containerId);
        container.innerHTML = marked.parse(text);


    } catch (err) {
        console.error("載入 Markdown 時發生錯誤：", err);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML =
                "<p style='color:red;'>紅色宇宙論載入失敗</p>";
        }
    }
}


window.addEventListener("DOMContentLoaded", () => {
    loadMarkdownContent("/static/md/紅色宇宙論.md", "theory-text-container");
});