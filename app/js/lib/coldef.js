import { hdom } from "./hdom.js";

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
        const td = hdom.createElement("td", className);
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
        const table = hdom.createElement("table");

        const thead = hdom.createElement("thead");
        table.appendChild(thead);
        const tr = hdom.createElement("tr");
        thead.appendChild(tr);
        for (const col of cols) {
            const th = hdom.createElement("th", col.getClass());
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
