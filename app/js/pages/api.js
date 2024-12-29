import { hdom } from "../lib/hdom.js";
import { UI } from "../lib/ui.js";

class APIUI extends UI {
    static async getUI() {
        const ui = new APIUI();
        await ui.init();
    }

    async init() {
        await super.init();
        hdom.addEventListener(
            "form",
            "submit",
            async (e) => await this.submit(e)
        );
    }

    /**
     * @param {Event} e
     */
    async submit(e) {
        e.preventDefault();
        const url = hdom.getFormElementValue("url");
        const result = await this.getAPI().getJSON(url);
        hdom.setFormElementValue("result", JSON.stringify(result));
    }
}

await APIUI.getUI();
