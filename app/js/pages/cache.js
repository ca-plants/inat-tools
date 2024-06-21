import { Cache } from "../lib/cache.js";
import { DOMUtils } from "../lib/domutils.js";
import { UI } from "../lib/ui.js";

class CacheUI extends UI {
    async clearAll() {
        const cache = await Cache.getInstance();
        await cache.clear();
        await this.showCache();
    }

    async clearExpired() {
        const cache = await Cache.getInstance();
        await cache.clearExpired();
        await this.showCache();
    }

    /**
     * @param {Event} e
     * @param {string} key
     */
    async copyValue(e, key) {
        e.preventDefault();
        const cache = await Cache.getInstance();
        const value = await cache.get(key);
        await navigator.clipboard.writeText(JSON.stringify(value));
    }

    static async init() {
        const ui = new CacheUI();
        DOMUtils.addEventListener(
            "clear-all",
            "click",
            async () => await ui.clearAll()
        );
        DOMUtils.addEventListener(
            "clear-expired",
            "click",
            async () => await ui.clearExpired()
        );
        await ui.showCache();
    }

    /**
     * @param {Event} e
     * @param {string} key
     */
    async removeValue(e, key) {
        e.preventDefault();
        const cache = await Cache.getInstance();
        await cache.delete(key);
        await this.showCache();
    }

    async showCache() {
        /**
         * @param {Date} d
         */
        function formatDateTime(d) {
            d = new Date(d);
            const sep = String.fromCharCode(8209);
            const dStr =
                d.getFullYear().toString() +
                sep +
                (d.getMonth() + 101).toString().substring(1) +
                sep +
                (d.getDate() + 100).toString().substring(1);
            return dStr + " " + d.toTimeString().substring(0, 8);
        }

        /**
         * @param {string} key
         * @param {CacheUI} ui
         */
        async function getRow(key, ui) {
            /**
             * @param {Node|string} value
             * @param {Object.<string,string>|string} [atts]
             */
            function getCol(value, atts) {
                const td = DOMUtils.createElement("td", atts);
                if (value instanceof Node) {
                    td.appendChild(value);
                } else {
                    td.appendChild(document.createTextNode(value));
                }
                tr.appendChild(td);
            }

            const data = await cache.getEntry(key);
            const url = new URL(key);

            const className = cache.isExpired(data) ? "expired" : undefined;

            const tr = DOMUtils.createElement("tr", className);

            getCol(url.pathname, { class: "overflow", title: key });
            getCol(formatDateTime(data.date));
            getCol(formatDateTime(data.expires));

            const copy = DOMUtils.createElement("img", {
                src: ui.getPathPrefix() + "img/icon/clipboard.svg",
                title: "Copy to clipboard",
            });
            copy.addEventListener("click", async (e) => {
                await ui.copyValue(e, key);
            });

            const del = DOMUtils.createElement("img", {
                src: ui.getPathPrefix() + "img/icon/trash.svg",
                title: "Remove from cache",
            });
            del.addEventListener("click", async (e) => {
                await ui.removeValue(e, key);
            });

            const actions = DOMUtils.createElement("div", { class: "center" });
            actions.appendChild(del);
            actions.appendChild(copy);
            getCol(actions);

            return tr;
        }

        const table = DOMUtils.createElement("table", {
            style: "max-width:100%;",
        });

        const thead = DOMUtils.createElement("thead");
        table.appendChild(thead);
        const tr = DOMUtils.createElement("tr");
        thead.appendChild(tr);
        for (const col of ["Key", "Cached", "Expires", "Actions"]) {
            const th = DOMUtils.createElement("th");
            tr.appendChild(th);
            th.appendChild(document.createTextNode(col));
        }

        const tbody = DOMUtils.createElement("tbody");
        table.appendChild(tbody);

        const cache = await Cache.getInstance();
        const keys = await cache.getAllKeys();

        for (const key of keys) {
            tbody.appendChild(await getRow(key, this));
        }

        const results = DOMUtils.getRequiredElement("results");
        DOMUtils.removeChildren(results);
        results.appendChild(table);
    }
}

await CacheUI.init();
