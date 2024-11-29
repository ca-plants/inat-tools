export class hdom {
    /**
     * @param {string|Element} e
     * @param {string} className
     */
    static addClass(e, className) {
        const elem = this.getElement(e);
        elem.classList.add(className);
    }

    /**
     * @param {string|Element} e
     * @param {string} type
     * @param {function(Event):void} fn
     * @returns {Element}
     */
    static addEventListener(e, type, fn) {
        const elem = this.getElement(e);
        if (elem instanceof Element) {
            elem.addEventListener(type, fn);
        }
        return elem;
    }

    /**
     * @param {Element} parent
     * @param {Element[]} children
     * @returns {Element}
     */
    static appendChildren(parent, children) {
        children.forEach((child) => parent.appendChild(child));
        return parent;
    }

    /**
     * @param {string|Element} e
     */
    static clickElement(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            throw new Error();
        }
        elem.click();
    }

    /**
     * @param {string} id
     * @param {boolean} checked
     * @returns {HTMLInputElement}
     */
    static createCheckBox(id, checked) {
        /** @type {Object<string,string>} */
        const atts = {};
        atts.type = "checkbox";
        atts.id = id;
        if (checked) {
            atts.checked = "";
        }
        return this.createInputElement(atts);
    }

    /**
     * @param {string} name
     * @param {Object<string,string|number>|string} [attributes]
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
     * @param {string} forId
     * @param {string} text
     * @returns {Element}
     */
    static createLabelElement(forId, text) {
        const el = this.createElement("label", { for: forId });
        this.setTextValue(el, text);
        return el;
    }

    /**
     * @param {URL|string|undefined} url
     * @param {Node|string|number} eLinkText
     * @param {Object.<string,string>|string} [attributes]
     * @returns {Element}
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
     * @param {string} name
     * @param {string} id
     * @param {string} value
     * @param {string} label
     * @returns {Element[]}
     */
    static createRadioElement(name, id, value, label) {
        const labelEl = this.createElement("label", { for: id });
        this.setTextValue(labelEl, label);
        const radio = this.createInputElement({
            type: "radio",
            id: id,
            value: value,
            name: name,
        });
        return [radio, labelEl];
    }

    /**
     * @param {string} id
     * @param {string} label
     * @param {{value:string,label:string}[]} options
     * @returns {Element[]}
     */
    static createSelectElement(id, label, options) {
        const labelEl = this.createElement("label", { for: id });
        this.setTextValue(labelEl, label);
        const select = this.createElement("select", { id: id });
        for (const option of options) {
            const optionEl = this.createElement("option", {
                value: option.value,
            });
            this.setTextValue(optionEl, option.label);
            select.appendChild(optionEl);
        }
        return [labelEl, select];
    }

    /**
     * @param {string} name
     * @param {Object<string,string>} attributes
     * @param {string} text
     * @returns {Element}
     */
    static createTextElement(name, attributes, text) {
        const elem = this.createElement(name, attributes);
        this.setTextValue(elem, text);
        return elem;
    }

    /**
     * @param {string|Element} e
     * @returns {Element}
     */
    static getElement(e) {
        if (typeof e === "string") {
            const el = document.getElementById(e);
            if (el === null) {
                throw new Error();
            }
            return el;
        }
        return e;
    }

    /**
     * @param {string|Element} form
     * @param {string} elName
     * @returns {HTMLFormElement|RadioNodeList}
     */
    static getFormElement(form, elName) {
        form = this.getElement(form);
        if (!(form instanceof HTMLFormElement)) {
            throw new Error();
        }
        const elem = form.elements.namedItem(elName);
        if (!(elem instanceof HTMLFormElement)) {
            if (!(elem instanceof RadioNodeList)) {
                throw new Error();
            }
        }
        return elem;
    }

    /**
     * @param {string|HTMLFormElement|RadioNodeList} e
     * @returns {string}
     */
    static getFormElementValue(e) {
        const elem = typeof e === "string" ? this.getElement(e) : e;
        if (
            elem instanceof HTMLInputElement ||
            elem instanceof HTMLSelectElement ||
            elem instanceof HTMLTextAreaElement ||
            elem instanceof RadioNodeList
        ) {
            return elem.value;
        }
        throw new Error();
    }

    /**
     * @param {string|Element} e
     * @returns {boolean}
     */
    static isChecked(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            return false;
        }
        return elem.checked;
    }

    /**
     * @param {string|Element} e
     * @returns {boolean}
     */
    static isElement(e) {
        if (e instanceof Element) {
            return true;
        }
        return document.getElementById(e) !== null;
    }

    /**
     * @param {string|Element} e
     * @returns {Element}
     */
    static removeChildren(e) {
        const elem = this.getElement(e);
        while (elem.firstChild) {
            elem.firstChild.remove();
        }
        return elem;
    }

    /**
     * @param {string|Element} e
     * @param {string} className
     */
    static removeClass(e, className) {
        const elem = this.getElement(e);
        elem.classList.remove(className);
    }

    /**
     * @param {string|Element} e
     * @param {boolean} state
     */
    static setCheckBoxState(e, state) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLInputElement)) {
            return;
        }
        elem.checked = state;
    }

    /**
     * @param {string|Element} e
     * @param {string} text
     */
    static setElementText(e, text) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLElement)) {
            throw new Error();
        }
        this.removeChildren(elem);
        elem.appendChild(document.createTextNode(text));
    }

    /**
     * @param {string|Element} e
     */
    static setFocusTo(e) {
        const elem = this.getElement(e);
        if (!(elem instanceof HTMLElement)) {
            console.warn(e + " is not an HTMLElement");
            return;
        }
        elem.focus();
    }

    /**
     * @param {string|Element} e
     * @param {string} value
     */
    static setFormElementValue(e, value) {
        const elem = this.getElement(e);
        if (
            elem instanceof HTMLInputElement ||
            elem instanceof HTMLTextAreaElement ||
            elem instanceof HTMLSelectElement
        ) {
            elem.value = value;
        } else if (elem instanceof HTMLElement) {
            elem.setAttribute("value", value);
        }
    }

    /**
     * @param {string|Element} e
     * @param {string} text
     */
    static setHTMLValue(e, text) {
        const elem = this.getElement(e);
        elem.innerHTML = text;
    }

    /**
     * @param {string|Element} e
     * @param {string} text
     */
    static setTextValue(e, text) {
        const elem = this.getElement(e);
        elem.textContent = text;
    }

    /**
     * @param {string|Element|EventTarget|null} e
     * @param {boolean} [show=true]
     */
    static showElement(e, show = true) {
        if (typeof e !== "string" && !(e instanceof Element)) {
            return;
        }
        const elem = this.getElement(e);
        if (elem instanceof HTMLElement) {
            elem.hidden = !show;
        }
    }
}
