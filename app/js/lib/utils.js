import { hdom } from "./hdom.js";

/**
 * @param {import('./ui.js').UI} ui
 * @param {string} title
 * @param {string} fileName
 * @param {function():{content:string,fileName?:string}} getData
 * @returns {Element}
 */
export function createDownloadLink(ui, title, fileName, getData) {
    function setHref() {
        const data = getData();
        var file = new Blob([data.content], { type: "text/plain" });
        if (data.fileName) {
            dlLink.setAttribute("download", data.fileName);
        }
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
