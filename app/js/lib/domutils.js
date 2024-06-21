class DOMUtils {
    /**
     *
     * @param {string} id
     * @param {string} className
     */
    static addClass(id, className) {
        const e = document.getElementById(id);
        if (e) {
            e.classList.add(className);
        }
    }

    /**
     * @param {string|Element} e
     * @param {string} type
     * @param {function(Event):void} fn
     */
    static addEventListener(e, type, fn) {
        const elem = this.getElement(e);
        if (elem instanceof Element) {
            elem.addEventListener(type, fn);
        }
    }

    /**
     * @param {string|Element} e
     */
    static clickElement(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            return;
        }
        elem.click();
    }

    /**
     * @param {string} name
     * @param {Object.<string,string|number>|string} [attributes]
     * @returns {Element}
     */
    static createElement(name, attributes) {
        const e = document.createElement(name);
        switch (typeof attributes) {
            case "string":
                // Assume it's a class name.
                e.className = attributes;
                break;
            case "object":
                for (const [k, v] of Object.entries(attributes)) {
                    e.setAttribute(k, v.toString());
                }
                break;
        }
        return e;
    }

    /**
     * @param {Object.<string,string|number>|string} attributes
     * @returns {HTMLInputElement}
     */
    static createInputElement(attributes) {
        const e = this.createElement("input", attributes);
        if (!(e instanceof HTMLInputElement)) {
            throw new Error();
        }
        return e;
    }

    /**
     * @param {URL|string|undefined} url
     * @param {Node|string|number} eLinkText
     * @param {Object.<string,string>|string} [attributes]
     */
    static createLinkElement(url, eLinkText, attributes) {
        const eLink = this.createElement("a", attributes);
        if (url !== undefined) {
            eLink.setAttribute("href", url.toString());
        }
        eLink.appendChild(
            eLinkText instanceof Node
                ? eLinkText
                : document.createTextNode(eLinkText.toString())
        );
        return eLink;
    }

    /**
     * @param {string|Element} e
     * @param {boolean} state
     */
    static enableCheckBox(e, state) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            return;
        }
        elem.checked = state;
    }

    /**
     * @param {string|Element|EventTarget|RadioNodeList|null|undefined} e
     * @returns {Element|EventTarget|RadioNodeList|null|undefined}
     */
    static getElement(e) {
        if (typeof e === "string") {
            return document.getElementById(e);
        }
        return e;
    }

    /**
     * @param {string|Element} e
     * @param {string} elName
     */
    static getFormElement(e, elName) {
        const form = this.getElement(e);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }
        return form.elements.namedItem(elName);
    }

    /**
     * @param {string|Element} e
     * @returns {Element}
     */
    static getRequiredElement(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof Element)) {
            throw new Error(JSON.stringify(e));
        }
        return elem;
    }

    /**
     * @param {string|Element|RadioNodeList|null|undefined} e
     * @returns {string|undefined}
     */
    static getFormElementValue(e) {
        const elem = this.getElement(e);
        if (
            elem instanceof HTMLInputElement ||
            elem instanceof HTMLSelectElement ||
            elem instanceof RadioNodeList
        ) {
            return elem.value;
        }
    }

    /**
     * @param {string|Element} e
     */
    static isChecked(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            return false;
        }
        return elem.checked;
    }

    /**
     * @param {string|Element|EventTarget|null} e
     */
    static isVisible(e) {
        const elem = this.getElement(e);
        if (!elem || !(elem instanceof HTMLElement)) {
            return false;
        }
        return elem.style.display !== "none";
    }

    /**
     * @param {string|Element} e
     */
    static removeChildren(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof Element)) {
            return;
        }
        while (elem.firstChild) {
            elem.firstChild.remove();
        }
    }

    /**
     * @param {string|Element} e
     * @param {string} className
     */
    static removeClass(e, className) {
        const elem = this.getElement(e);
        if (elem instanceof Element) {
            elem.classList.remove(className);
        }
    }

    /**
     * @param {string|Element} e
     * @param {string} text
     */
    static setElementText(e, text) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLElement)) {
            return;
        }
        this.removeChildren(elem);
        elem.appendChild(document.createTextNode(text));
    }

    /**
     * @param {string|HTMLElement} e
     */
    static setFocusTo(e) {
        const elem = this.getElement(e);
        if (!elem) {
            console.warn("element " + e + " not found");
            return;
        }
        if (!(elem instanceof HTMLElement)) {
            console.warn(e + " is not an HTMLElement");
            return;
        }
        elem.focus();
    }

    /**
     * @param {string|Element} e
     * @param {string|undefined|null} value
     */
    static setFormElementValue(e, value) {
        const elem = this.getElement(e);
        if (!elem) {
            return;
        }
        if (
            elem instanceof HTMLInputElement ||
            elem instanceof HTMLTextAreaElement ||
            elem instanceof HTMLSelectElement
        ) {
            elem.value = value ? value : "";
        } else if (elem instanceof HTMLElement) {
            elem.setAttribute("value", value ? value : "");
        }
    }

    /**
     * @param {string|Element|EventTarget|null} e
     * @param {boolean} [show]
     */
    static showElement(e, show = true) {
        const elem = this.getElement(e);
        if (!elem || !(elem instanceof HTMLElement)) {
            return;
        }
        elem.style.display = show ? "" : "none";
    }
}

export { DOMUtils };
