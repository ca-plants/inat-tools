import { hdom } from "./hdom.js";

export class HTMLUtils {
    /**
     * @param {string|undefined} name
     * @param {string} id
     * @param {string|undefined} value
     * @param {string} label
     * @param {function(Event):void} [fnClickHandler]
     * @returns {HTMLElement}
     */
    static createCheckboxDiv(name, id, value, label, fnClickHandler) {
        const div = hdom.createElement("div", "checkbox");
        /** @type {Object<string,string>} */
        const atts = {
            type: "checkbox",
            id: id,
        };
        if (name !== undefined) {
            atts.name = name;
        }
        if (value !== undefined) {
            atts.value = value;
        }
        const cb = hdom.createInputElement(atts);
        const lbl = hdom.createLabelElement(id, label);
        div.appendChild(cb);
        div.appendChild(lbl);
        if (fnClickHandler) {
            cb.addEventListener("click", fnClickHandler);
        }
        return div;
    }
}
