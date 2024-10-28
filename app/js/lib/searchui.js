import { DateUtils } from "./dateutils.js";
import { DOMUtils } from "./domutils.js";
import { hdom } from "./hdom.js";
import { SpeciesFilter } from "./speciesfilter.js";
import { UI } from "./ui.js";

class AutoCompleteConfig {
    #listID;
    #valueID;
    #fnRetrieve;
    #fnHandleChange;

    /**
     * @param {string} listID
     * @param {string} valueID
     * @param {function (string) :Promise<Object<string,string>>} fnRetrieve
     * @param {function (string):void|undefined} [fnHandleChange]
     */
    constructor(listID, valueID, fnRetrieve, fnHandleChange) {
        this.#listID = listID;
        this.#valueID = valueID;
        this.#fnRetrieve = fnRetrieve;
        this.#fnHandleChange = fnHandleChange;
    }

    getListID() {
        return this.#listID;
    }

    /**
     * @param {string} value
     */
    getResults(value) {
        return this.#fnRetrieve(value);
    }

    getValueID() {
        return this.#valueID;
    }

    handleChange() {
        if (this.#fnHandleChange) {
            this.#fnHandleChange(this.#valueID);
        }
    }
}

/** @type {( "ev-mammal" | "plants")[]} */
const ANNOTATION_TYPES = ["ev-mammal", "plants"];
const MIN_YEAR = 2000;

class SearchUI extends UI {
    /** @type {number|undefined} */
    #debounceTimer;

    /**
     * @param {Event} e
     * @param {AutoCompleteConfig} config
     */
    async autoComplete(e, config) {
        const dl = DOMUtils.getRequiredElement(config.getListID());
        DOMUtils.removeChildren(dl);

        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }
        const value = e.target.value;
        if (value.length < 3) {
            return;
        }

        const results = await config.getResults(value);
        for (const [k, v] of Object.entries(results)) {
            dl.appendChild(
                DOMUtils.createElement("option", { value: k, value_id: v })
            );
        }
    }

    /**
     * @param {Event} e
     */
    changeFilter(e) {
        DOMUtils.showElement("search-crit", true);
        DOMUtils.showElement(e.target, false);
    }

    /**
     * @param {Event} e
     * @param {AutoCompleteConfig} config
     */
    async #debounce(e, config, timeout = 500) {
        if (!(e instanceof InputEvent) || !e.inputType) {
            // Ignore events with no inputType (e.g., the event triggered after we set value).
            return;
        }
        clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(
            () => this.autoComplete(e, config),
            timeout
        );
    }

    /**
     * @param {number} taxonID
     * @param {INatAPI} api
     */
    static async getAnnotationsForTaxon(taxonID, api) {
        const taxon = await api.getTaxonData(taxonID.toString());
        const ancestors = [...taxon.ancestor_ids, taxonID];
        const annotations = [];
        if (ancestors.includes(47125)) {
            annotations.push("plants");
        }
        if (ancestors.includes(40151) && !ancestors.includes(43583)) {
            annotations.push("ev-mammal");
        }
        return annotations;
    }

    /**
     * @param {Event} e
     * @param {AutoCompleteConfig} config
     */
    handleAutoCompleteField(e, config) {
        /**
         * @param {AutoCompleteConfig} config
         * @param {string|null} value
         */
        function setValue(config, value) {
            DOMUtils.setFormElementValue(config.getValueID(), value);
            config.handleChange();
        }

        const target = e.target;
        if (!(target instanceof HTMLInputElement)) {
            throw new Error();
        }
        switch (e.type) {
            case "change":
                {
                    // Clear ID.
                    setValue(config, "");
                    const value = target.value;
                    const list = DOMUtils.getRequiredElement(
                        config.getListID()
                    );
                    if (!(list instanceof HTMLDataListElement)) {
                        throw new Error();
                    }
                    const options = list.childNodes;
                    for (const option of options) {
                        if (!(option instanceof HTMLOptionElement)) {
                            throw new Error();
                        }
                        if (option.value === value) {
                            setValue(config, option.getAttribute("value_id"));
                            return;
                        }
                    }
                }
                break;
            case "focus":
                target.select();
                break;
            case "input":
                // Clear ID.
                setValue(config, "");
                // Clear any errors.
                target.setCustomValidity("");
                this.#debounce(e, config);
                break;
        }
    }

    /**
     * @param {string} valueElementID
     */
    async handleTaxonChange(valueElementID) {
        const prefix = valueElementID.split("-")[0];
        await this.updateAnnotationsFields(
            prefix,
            DOMUtils.getFormElementValue(valueElementID)
        );
    }

    async init() {
        await super.init();
        const e = document.getElementById("cancel-query");
        if (e) {
            e.addEventListener("click", () => {
                this.getAPI().cancelQuery(true);
            });
        }
    }

    /**
     * @param {string} prefix
     */
    initEventListeners(prefix) {
        /**
         * @param {EventTarget|null} e
         */
        function handleYearChange(e) {
            if (!(e instanceof HTMLElement)) {
                throw new Error();
            }
            const prefix = e.id.substring(0, e.id.length - 1);
            SearchUI.setYearMinMax(prefix);
            SearchUI.setYearMode(prefix);
        }

        /**
         * @param {EventTarget|null} e
         */
        function handleYearModeChange(e) {
            /**
             * @param {HTMLElement} e
             * @param {string|number} year
             */
            function setValues(e, year) {
                DOMUtils.setFormElementValue(e.id + "1", year.toString());
                DOMUtils.setFormElementValue(e.id + "2", year.toString());
                SearchUI.setYearMinMax(e.id);
            }

            if (!(e instanceof HTMLElement)) {
                throw new Error();
            }

            switch (DOMUtils.getFormElementValue(e)) {
                case "Any":
                    setValues(e, "");
                    break;
                case "This":
                    setValues(e, DateUtils.getCurrentYear());
                    break;
                case "Last":
                    setValues(e, DateUtils.getCurrentYear() - 1);
                    break;
            }
        }

        /**
         * @param {SearchUI} ui
         * @param {string} id
         * @param {AutoCompleteConfig} config
         */
        function initField(ui, id, config) {
            const input = document.getElementById(id);
            if (!input) {
                return;
            }
            input.addEventListener("change", (e) =>
                ui.handleAutoCompleteField(e, config)
            );
            input.addEventListener("focus", (e) =>
                ui.handleAutoCompleteField(e, config)
            );
            input.addEventListener("input", (e) =>
                ui.handleAutoCompleteField(e, config)
            );
        }

        /** @type{{name:string,fnRetrieve:function(string):Promise<Object<string,string>>,fnHandleChange?:function(string):void}[]} */
        const fields = [
            {
                name: "observer",
                fnRetrieve: (v) => this.getAPI().getAutoCompleteObserver(v),
            },
            {
                name: "place",
                fnRetrieve: (v) => this.getAPI().getAutoCompletePlace(v),
            },
            {
                name: "proj",
                fnRetrieve: (v) => this.getAPI().getAutoCompleteProject(v),
            },
            {
                name: "taxon",
                fnRetrieve: (v) => this.getAPI().getAutoCompleteTaxon(v),
                fnHandleChange: (valueID) => this.handleTaxonChange(valueID),
            },
        ];

        for (const field of fields) {
            initField(
                this,
                prefix + "-" + field.name + "-name",
                new AutoCompleteConfig(
                    prefix + "-" + field.name + "-name-list",
                    prefix + "-" + field.name + "-id",
                    field.fnRetrieve,
                    field.fnHandleChange
                )
            );
        }

        const eSelect = document.getElementById(prefix + "-year");
        if (eSelect) {
            eSelect.addEventListener("change", (e) =>
                handleYearModeChange(e.target)
            );
            DOMUtils.addEventListener(prefix + "-year1", "change", (e) =>
                handleYearChange(e.target)
            );
            DOMUtils.addEventListener(prefix + "-year2", "change", (e) =>
                handleYearChange(e.target)
            );
        }
    }

    /**
     * @param {string} prefix
     */
    initFilterFromForm(prefix) {
        /**
         * @type {{name:string,setQueryParam:function (Params.SpeciesFilter,string):void,label:string}[]}
         */
        const FILT_AUTOCOMPLETE_FIELDS = [
            {
                name: "proj",
                setQueryParam: (p, id) => (p.project_id = id),
                label: "project",
            },
            {
                name: "place",
                setQueryParam: (p, id) => (p.place_id = id),
                label: "place",
            },
            {
                name: "observer",
                setQueryParam: (p, id) => (p.user_id = id),
                label: "observer",
            },
            {
                name: "taxon",
                setQueryParam: (p, id) => (p.taxon_id = id),
                label: "taxon",
            },
        ];

        /** @type {Params.SpeciesFilter} */
        const filterArgs = {};

        let hasErrors = false;

        for (const field of FILT_AUTOCOMPLETE_FIELDS) {
            const id = DOMUtils.getFormElementValue(
                prefix + "-" + field.name + "-id"
            );
            const input = DOMUtils.getElement(
                prefix + "-" + field.name + "-name"
            );
            if (id) {
                field.setQueryParam(filterArgs, id);
            } else {
                // Make sure the associated text input is blank.
                if (input instanceof HTMLInputElement) {
                    if (input.value) {
                        input.setCustomValidity("Invalid " + field.label + ".");
                        DOMUtils.setFocusTo(input);
                        hasErrors = true;
                    } else {
                        input.setCustomValidity("");
                    }
                }
            }
        }

        const month1 = DOMUtils.getFormElementValue(prefix + "-month1");
        if (month1) {
            filterArgs.month = parseInt(month1);
        }

        // If annotation fields are visible, include them.
        if (DOMUtils.isVisible(prefix + "-annotation-filter")) {
            /** @type {{ type: "ev-mammal" | "plants"; value: string }[]} */
            const annotations = [];
            for (const type of ANNOTATION_TYPES) {
                if (DOMUtils.isVisible(prefix + "-ann-type-" + type)) {
                    const value = DOMUtils.getFormElementValue(
                        prefix + "-ann-" + type
                    );
                    if (value !== "Any" && value !== undefined) {
                        annotations.push({ type: type, value: value });
                    }
                }
            }
            if (annotations.length) {
                filterArgs.annotations = annotations;
            }
        }

        const year1 = DOMUtils.getFormElementValue(prefix + "-year1");
        const year2 = DOMUtils.getFormElementValue(prefix + "-year2");
        if (year1) {
            filterArgs.year1 = parseInt(year1);
        }
        if (year2) {
            filterArgs.year2 = parseInt(year2);
        }

        if (hdom.isChecked(prefix + "-researchgrade")) {
            filterArgs.quality_grade = "research";
        }

        const establishment = hdom.getFormElementValue(
            prefix + "-establishment"
        );
        if (establishment === "native" || establishment === "introduced") {
            filterArgs.establishment = establishment;
        }

        const form = document.getElementById("form");
        if (!(form instanceof HTMLFormElement)) {
            throw new Error();
        }
        form.reportValidity();
        if (hasErrors) {
            return;
        }
        return new SpeciesFilter(filterArgs);
    }

    /**
     * @param {string} prefix
     * @param {SpeciesFilter} filter
     */
    async initForm(prefix, filter = new SpeciesFilter({})) {
        /**
         * @param {SpeciesFilter} filter
         */
        function initMonth(filter) {
            const month = filter.getMonths().month1;
            if (!month) {
                return;
            }
            DOMUtils.setFormElementValue(prefix + "-month1", month.toString());
        }

        /**
         * @param {SpeciesFilter} filter
         */
        function initYear(filter) {
            const years = filter.getYears();
            const year1 = years.year1;
            const year2 = years.year2;
            DOMUtils.setFormElementValue(
                prefix + "-year1",
                year1 ? year1.toString() : ""
            );
            DOMUtils.setFormElementValue(
                prefix + "-year2",
                year2 ? year2.toString() : ""
            );
            SearchUI.setYearMinMax(prefix + "-year");
            SearchUI.setYearMode(prefix + "-year");
        }

        /**
         * @param {INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initObserver(api, filter) {
            const id = filter.getUserID();
            DOMUtils.setFormElementValue(prefix + "-observer-id", id);
            if (!id) {
                return;
            }
            // Look up name based on ID.
            const data = await api.getUserData(id);
            if (!data) {
                return;
            }
            DOMUtils.setFormElementValue(prefix + "-observer-name", data.login);
        }

        /**
         * @param {INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initPlace(api, filter) {
            // Check for place.
            const placeID = filter.getPlaceID();
            DOMUtils.setFormElementValue(prefix + "-place-id", placeID);
            if (!placeID) {
                return;
            }
            // Look up name based on ID.
            const placeData = await api.getPlaceData(placeID);
            if (!placeData) {
                return;
            }
            DOMUtils.setFormElementValue(
                prefix + "-place-name",
                placeData.display_name
            );
        }

        /**
         * @param {INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initProject(api, filter) {
            // Check for project.
            const projID = filter.getProjectID();
            DOMUtils.setFormElementValue(prefix + "-proj-id", projID);
            if (!projID) {
                return;
            }
            // Look up name based on ID.
            const projectData = await api.getProjectData(projID);
            if (!projectData) {
                return;
            }
            DOMUtils.setFormElementValue(
                prefix + "-proj-name",
                projectData.title
            );
        }

        /**
         * @param {INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initTaxon(api, filter) {
            // Check for taxon.
            const taxonID = filter.getTaxonID();
            DOMUtils.setFormElementValue(prefix + "-taxon-id", taxonID);
            if (!taxonID) {
                return;
            }
            // Look up name based on ID.
            const taxonData = await api.getTaxonData(taxonID);
            if (!taxonData) {
                return;
            }
            DOMUtils.setFormElementValue(
                prefix + "-taxon-name",
                api.getTaxonFormName(taxonData)
            );

            // Set value of any annotations.
            const annotations = filter.getAnnotations();
            if (annotations !== undefined) {
                for (const annotation of annotations) {
                    DOMUtils.setFormElementValue(
                        prefix + "-ann-" + annotation.type,
                        annotation.value
                    );
                }
            }
        }

        // Add establishment select.
        const establishment = hdom.createSelectElement(
            prefix + "-establishment",
            "Establishment",
            [
                { value: "", label: "Any" },
                { value: "native", label: "Native" },
                { value: "introduced", label: "Introduced" },
            ]
        );
        const divEst = hdom.createElement("div", "form-input");
        establishment.forEach((e) => divEst.appendChild(e));
        const divForm = hdom.getElement(prefix + "-misc");
        divForm.appendChild(divEst);
        hdom.setFormElementValue(
            prefix + "-establishment",
            filter.getEstablishment() ?? ""
        );

        await initProject(this.getAPI(), filter);
        await initPlace(this.getAPI(), filter);
        await initObserver(this.getAPI(), filter);
        await initTaxon(this.getAPI(), filter);
        await this.updateAnnotationsFields(prefix, filter.getTaxonID());
        initMonth(filter);
        initYear(filter);

        const qualityGrade = filter.getQualityGrade();
        DOMUtils.enableCheckBox(
            prefix + "-researchgrade",
            qualityGrade === "research"
        );
    }

    /**
     * @param {string} prefix
     */
    static setYearMinMax(prefix) {
        const d1 = document.getElementById(prefix + "1");
        const d2 = document.getElementById(prefix + "2");
        if (d1 && d2) {
            const d1Val = DOMUtils.getFormElementValue(d1);
            const d2Val = DOMUtils.getFormElementValue(d2);
            d1.setAttribute(
                "max",
                d2Val ? d2Val : DateUtils.getCurrentYear().toString()
            );
            d2.setAttribute("min", d1Val ? d1Val : MIN_YEAR.toString());
            d2.setAttribute("max", DateUtils.getCurrentYear().toString());
        }
    }

    /**
     * @param {string} prefix
     */
    static setYearMode(prefix) {
        function getMode() {
            const d1 = DOMUtils.getFormElementValue(prefix + "1");
            const d2 = DOMUtils.getFormElementValue(prefix + "2");
            if (d1 === d2 && d1 !== undefined) {
                if (d1 === "") {
                    return "Any";
                }
                if (parseInt(d1) === DateUtils.getCurrentYear()) {
                    return "This";
                }
                if (parseInt(d1) === DateUtils.getCurrentYear() - 1) {
                    return "Last";
                }
            }
            return "Range";
        }

        DOMUtils.setFormElementValue(prefix, getMode());
    }

    /**
     * @param {string} prefix
     * @param {string|undefined} taxonID
     */
    async updateAnnotationsFields(prefix, taxonID) {
        const fieldSetID = prefix + "-annotation-filter";
        if (!taxonID) {
            DOMUtils.showElement(fieldSetID, false);
            return;
        }
        const annotations = await SearchUI.getAnnotationsForTaxon(
            parseInt(taxonID),
            this.getAPI()
        );
        DOMUtils.showElement(fieldSetID, annotations.length > 0);

        // Show only the relevant annotation options.
        for (const type of ANNOTATION_TYPES) {
            DOMUtils.showElement(
                prefix + "-ann-type-" + type,
                annotations.includes(type)
            );
        }
    }
}

export { AutoCompleteConfig, SearchUI };
