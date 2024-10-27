import { hdom } from "./hdom.js";

/**
 * @param {import('./ui.js').UI} ui
 * @param {string} title
 * @param {string} fileName
 * @param {function():string} getData
 * @returns {Element}
 */
export function createDownloadLink(ui, title, fileName, getData) {
    function setHref() {
        var file = new Blob([getData()], { type: "text/plain" });
        dlLink.setAttribute("href", URL.createObjectURL(file));
    }

    const dlImg = hdom.createElement("img", {
        src: ui.getPathPrefix() + "img/icon/download.svg",
        title: title,
    });
    const dlLink = hdom.createLinkElement("", dlImg, { download: fileName });
    dlLink.addEventListener("click", () => setHref());

    return dlLink;
}
