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
        const pb = hdom.getElement("progress-bar");
        if (numPages > 0) {
            pb.setAttribute("max", numPages.toString());
        } else {
            pb.removeAttribute("max");
            pb.removeAttribute("value");
        }
    }

    /**
     * @param {string} page
     */
    setPage(page) {
        hdom.setElementText("prog-page", page);
        if (page !== "1") {
            hdom.getElement("progress-bar").setAttribute("value", page);
        }
    }

    show() {
        hdom.showElement("progress", true);
    }
}
