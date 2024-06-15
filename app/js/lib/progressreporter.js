import { DOMUtils } from "./domutils.js";

export class ProgressReporter {
    #api;

    /**
     * @param {INatAPI} api
     */
    constructor(api) {
        this.#api = api;
    }

    hide() {
        DOMUtils.showElement("progress", false);
        this.#api.cancelQuery(false);
    }

    /**
     * @param {string} msg
     */
    async modalAlert(msg) {
        alert(msg);
    }

    /**
     * @param {string} label
     */
    setLabel(label) {
        DOMUtils.setElementText("prog-label", label);
    }

    /**
     * @param {number} numPages
     */
    setNumPages(numPages) {
        DOMUtils.showElement("prog-page-of", numPages !== 0);
        DOMUtils.setElementText("prog-page-max", numPages.toString());
    }

    /**
     * @param {string} page
     */
    setPage(page) {
        DOMUtils.setElementText("prog-page", page);
    }

    show() {
        DOMUtils.showElement("progress", true);
    }
}
