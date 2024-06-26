import { DOMUtils } from "./domutils.js";

class ColDef {
    #th;
    #fnValue;
    #className;

    /**
     * @param {string} th
     * @param {function (any,...any) : Element|string} fnValue
     * @param {string} [className]
     */
    constructor(th, fnValue, className) {
        this.#th = th;
        this.#fnValue = fnValue;
        this.#className = className;
    }

    /**
     * @param {Element} tr
     * @param {Node|string} content
     * @param {string|undefined} className
     */
    static addColElement(tr, content, className) {
        const td = DOMUtils.createElement("td", className);
        if (content instanceof Node) {
            td.appendChild(content);
        } else {
            td.appendChild(document.createTextNode(content));
        }
        tr.appendChild(td);
    }

    /**
     * @param {ColDef[]} cols
     */
    static createTable(cols) {
        const table = DOMUtils.createElement("table");

        const thead = DOMUtils.createElement("thead");
        table.appendChild(thead);
        const tr = DOMUtils.createElement("tr");
        thead.appendChild(tr);
        for (const col of cols) {
            const th = DOMUtils.createElement("th", col.getClass());
            tr.appendChild(th);
            th.appendChild(document.createTextNode(col.getHeaderLabel()));
        }

        return table;
    }

    getClass() {
        return this.#className;
    }

    getHeaderLabel() {
        return this.#th;
    }

    /**
     * @param {any} entry
     * @param {any[]} args
     */
    getValue(entry, ...args) {
        return this.#fnValue(entry, ...args);
    }
}

export { ColDef };
