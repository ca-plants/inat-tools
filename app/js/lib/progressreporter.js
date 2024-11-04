import { hdom } from "./hdom.js";

export class ProgressReporter {
    #api;

    /**
     * @param {INatAPI} api
     */
    constructor(api) {
        this.#api = api;
    }

    hide() {
        hdom.showElement("progress", false);
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
        hdom.setElementText("prog-label", label);
    }

    /**
     * @param {number} numPages
     */
    setNumPages(numPages) {
        hdom.showElement("prog-page-of", numPages !== 0);
        hdom.setElementText("prog-page-max", numPages.toString());
    }

    /**
     * @param {string} page
     */
    setPage(page) {
        hdom.setElementText("prog-page", page);
    }

    show() {
        hdom.showElement("progress", true);
    }
}
