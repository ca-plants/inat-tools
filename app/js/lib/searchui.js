import { DateUtils } from "./dateutils.js";
import { hdom } from "./hdom.js";
import { HTMLUtils } from "./htmlutils.js";
import { INatAPI } from "./inatapi.js";
import { SpeciesFilter } from "./speciesfilter.js";
import { UI } from "./ui.js";

/** @type {{id:import("../types.js").INatDataQualityGrade,label:string}[]} */
const QUALITY_GRADES = [
    { id: "research", label: "Research Grade" },
    { id: "needs_id", label: "Needs ID" },
];

/**
 * @typedef {{allowBoundary?:boolean}} SearchUIOptions
 */

export class AutoCompleteConfig {
    #prefix;
    #fnRetrieve;
    #fnHandleChange;
    #selected = false;

    /**
     * @param {string} prefix
     * @param {function (string): Promise<Object<string,number>>} fnRetrieve
     * @param {function (string): void|undefined} [fnHandleChange]
     */
    constructor(prefix, fnRetrieve, fnHandleChange) {
        this.#prefix = prefix;
        this.#fnRetrieve = fnRetrieve;
        this.#fnHandleChange = fnHandleChange;
    }

    /**
     * @param {string} value
     */
    async getResults(value) {
        return await this.#fnRetrieve(value);
    }

    getInputID() {
        return `${this.#prefix}-name`;
    }

    getValueID() {
        return `${this.#prefix}-id`;
    }

    handleChange() {
        if (this.#fnHandleChange) {
            this.#fnHandleChange(this.getValueID());
        }
    }

    isSelected() {
        return this.#selected;
    }

    /**
     * @param {boolean} state
     */
    setSelected(state) {
        this.#selected = state;
    }
}

/** @type {( "ev-mammal" | "plants")[]} */
const ANNOTATION_TYPES = ["ev-mammal", "plants"];
const MIN_YEAR = 2000;

export class SearchUI extends UI {
    #options;
    /** @type {Object<string,boolean>} */
    #monthLock = {};

    /** @type {NodeJS.Timeout|number|undefined} */
    #debounceTimer;

    /**
     * @param {SearchUIOptions} options
     */
    constructor(options = {}) {
        super();
        this.#options = options;
    }

    #autoCompleteRunning = false;
    /**
     * @param {Event} e
     * @param {AutoCompleteConfig} config
     */
    async autoComplete(e, config) {
        // Make sure there's nothing in the queue when we start.
        this.#debounceTimer = undefined;

        if (this.#autoCompleteRunning) {
            // Already running; reschedule this config.
            this.#debounce(e, config);
            return;
        }
        this.#autoCompleteRunning = true;

        if (!(e.target instanceof HTMLInputElement)) {
            this.#autoCompleteRunning = false;
            return;
        }

        /** @type {HTMLElement} */
        const eList = hdom.getElement("autocomplete");

        const value = e.target.value;
        if (value.length < 3) {
            hdom.showElement(eList, false);
            this.#autoCompleteRunning = false;
            return;
        }

        const results = await config.getResults(value);
        if (this.#debounceTimer) {
            // There's another change in the queue, abandon this one.
            this.#autoCompleteRunning = false;
            return;
        }

        eList.style.top = `${e.target.offsetTop + e.target.offsetHeight - window.pageYOffset + 5}px`;
        eList.style.left = `${e.target.offsetLeft}px`;
        hdom.showElement(eList, true);

        hdom.removeChildren(eList);
        let first = true;
        for (const [k, v] of Object.entries(results)) {
            const li = hdom.createTextElement(
                "li",
                { "data-id": v.toString() },
                k,
            );
            if (first) {
                li.setAttribute("data-highlight", "");
                first = false;
            }
            eList.appendChild(li);
            hdom.addEventListener(li, "mousedown", () =>
                selectAutoComplete(config, li),
            );
            hdom.addEventListener(li, "mouseover", () =>
                handleAutoCompleteHover(li),
            );
        }
        this.#autoCompleteRunning = false;
    }

    /**
     * @param {function((Event|null)?):void} fnClick
     * @returns {HTMLInputElement}
     */
    createChangeFilterButton(fnClick) {
        const button = hdom.createElement("input", {
            type: "button",
            value: "Change Filter",
            style: "width:100%;",
        });
        button.addEventListener("click", fnClick);
        // @ts-ignore
        return button;
    }

    /**
     * @param {Event|null} e
     */
    changeFilter(e) {
        if (e === null) {
            return;
        }
        this.showSearchForm();
        hdom.showElement(e.currentTarget, false);
    }

    /**
     * @param {Event} e
     * @param {AutoCompleteConfig} config
     */
    #debounce(e, config, timeout = 200) {
        clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(
            async () => await this.autoComplete(e, config),
            timeout,
        );
    }

    /**
     * @param {number} taxonID
     * @param {import("../types.js").INatAPI} api
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
     * @param {string} prefix
     * @returns {boolean}
     */
    getMonthLock(prefix) {
        return this.#monthLock[prefix];
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
            hdom.setFormElementValue(config.getValueID(), value);
            config.handleChange();
        }

        const target = e.target;
        if (!(target instanceof HTMLInputElement)) {
            throw new Error();
        }
        switch (e.type) {
            case "focus":
                target.select();
                // If there's no id set, and there's text present, open the suggestion list.
                if (hdom.getFormElementValue(config.getValueID()) === "") {
                    this.#debounce(e, config);
                }
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
            hdom.getFormElementValue(valueElementID),
        );
    }

    async init() {
        await super.init();

        // Create <ul> for autocompletes.
        const body = document.documentElement
            .getElementsByTagName("body")
            .item(0);
        if (body) {
            const ul = hdom.createElement("ul", {
                id: "autocomplete",
                hidden: "",
            });
            body.appendChild(ul);
        }

        const eCancel = hdom.getElement("cancel-query");
        eCancel.addEventListener("click", () => {
            this.getAPI().cancelQuery(true);
        });
    }

    /**
     * @param {string} prefix
     * @param {string} name
     * @param {function(string):Promise<Object<string,number>>} fnRetrieve
     * @param {(function(string):void)|undefined} [fnHandleChange]
     */
    initAutoCompleteField(prefix, name, fnRetrieve, fnHandleChange) {
        const config = new AutoCompleteConfig(
            `${prefix}-${name}`,
            fnRetrieve,
            fnHandleChange,
        );

        const input = hdom.getElement(config.getInputID());
        input.addEventListener("blur", () => {
            if (config.isSelected()) {
                config.setSelected(false);
                hdom.setFocusTo(input);
            }
            hdom.showElement("autocomplete", false);
        });
        hdom.addEventListener(input, "keydown", (e) =>
            handleAutoCompleteKey(/** @type {KeyboardEvent} **/ (e), config),
        );
        input.addEventListener("focus", (e) =>
            this.handleAutoCompleteField(e, config),
        );
        input.addEventListener("input", (e) =>
            this.handleAutoCompleteField(e, config),
        );
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
                hdom.setFormElementValue(e.id + "1", year.toString());
                hdom.setFormElementValue(e.id + "2", year.toString());
                SearchUI.setYearMinMax(e.id);
            }

            if (!(e instanceof HTMLElement)) {
                throw new Error();
            }

            switch (hdom.getFormElementValue(e)) {
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

        /** @type{{name:string,fnRetrieve:function(string):Promise<Object<string,number>>,fnHandleChange?:function(string):void}[]} */
        const fields = [
            {
                name: "observer",
                fnRetrieve: async (v) =>
                    await this.getAPI().getAutoCompleteObserver(v),
            },
            {
                name: "place",
                fnRetrieve: async (v) =>
                    await this.getAPI().getAutoCompletePlace(v),
            },
            {
                name: "proj",
                fnRetrieve: async (v) =>
                    await this.getAPI().getAutoCompleteProject(v),
            },
            {
                name: "taxon",
                fnRetrieve: async (v) =>
                    await this.getAPI().getAutoCompleteTaxon(v),
                fnHandleChange: async (valueID) =>
                    await this.handleTaxonChange(valueID),
            },
        ];

        for (const field of fields) {
            this.initAutoCompleteField(
                prefix,
                field.name,
                field.fnRetrieve,
                field.fnHandleChange,
            );
        }

        const eSelect = document.getElementById(prefix + "-year");
        if (eSelect) {
            eSelect.addEventListener("change", (e) =>
                handleYearModeChange(e.target),
            );
            hdom.addEventListener(prefix + "-year1", "change", (e) =>
                handleYearChange(e.target),
            );
            hdom.addEventListener(prefix + "-year2", "change", (e) =>
                handleYearChange(e.target),
            );
        }

        const eSetURL = document.getElementById(prefix + "-set-from-url");
        if (eSetURL) {
            eSetURL.addEventListener("click", () =>
                handleSetFromURL(this, prefix),
            );
        }
    }

    /**
     * @param {string} prefix
     * @returns {SpeciesFilter|undefined}
     */
    initFilterFromForm(prefix) {
        /**
         * @type {{name:string,setQueryParam:function (import("../types.js").ParamsSpeciesFilter,string):void,label:string}[]}
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

        /** @type {import("../types.js").ParamsSpeciesFilter} */
        const filterArgs = {};

        let hasErrors = false;

        const locationType = this.#options.allowBoundary
            ? getLocationType(prefix)
            : "place";

        for (const field of FILT_AUTOCOMPLETE_FIELDS) {
            if (field.name === "place" && locationType !== "place") {
                continue;
            }
            const id = hdom.getFormElementValue(
                prefix + "-" + field.name + "-id",
            );
            const input = hdom.getElement(prefix + "-" + field.name + "-name");
            if (id) {
                field.setQueryParam(filterArgs, id);
            } else {
                // Make sure the associated text input is blank.
                if (input instanceof HTMLInputElement) {
                    if (input.value) {
                        input.setCustomValidity("Invalid " + field.label + ".");
                        hdom.setFocusTo(input);
                        hasErrors = true;
                    } else {
                        input.setCustomValidity("");
                    }
                }
            }
        }

        const month1 = hdom.getFormElementValue(prefix + "-month1");
        const month2 = hdom.getFormElementValue(prefix + "-month2");
        if (month1 && month2) {
            filterArgs.month = getMonthList(month1, month2);
        }

        // If annotation fields are visible, include them.
        if (hdom.isVisible(prefix + "-annotation-filter")) {
            /** @type {{ type: "ev-mammal" | "plants"; value: string }[]} */
            const annotations = [];
            for (const type of ANNOTATION_TYPES) {
                if (hdom.isVisible(prefix + "-ann-type-" + type)) {
                    const value = hdom.getFormElementValue(
                        prefix + "-ann-" + type,
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

        const year1 = hdom.getFormElementValue(prefix + "-year1");
        const year2 = hdom.getFormElementValue(prefix + "-year2");
        if (year1) {
            filterArgs.year1 = parseInt(year1);
        }
        if (year2) {
            filterArgs.year2 = parseInt(year2);
        }

        /** @type {import("../types.js").INatDataQualityGrade[]} */
        const grades = [];
        for (const qg of QUALITY_GRADES) {
            if (hdom.isChecked(`${prefix}-${qg.id}`)) {
                grades.push(qg.id);
            }
        }
        if (grades.length > 0) {
            filterArgs.quality_grade = grades;
        }

        const establishment = hdom.getFormElementValue(
            prefix + "-establishment",
        );
        if (establishment === "native" || establishment === "introduced") {
            filterArgs.establishment = establishment;
        }

        const accuracy = hdom.getFormElementValue(`${prefix}-accuracy`);
        if (accuracy !== "") {
            filterArgs.accuracy = parseInt(accuracy);
        }

        const taxonObscured = hdom.isChecked(`${prefix}-taxon-obscured`);
        if (taxonObscured) {
            filterArgs.obscuration = "taxon";
        }

        if (locationType === "boundary") {
            filterArgs.boundary = JSON.parse(
                hdom.getFormElementValue(prefix + "-boundary-text"),
            );
        }

        const form = document.getElementById("form");
        if (!(form instanceof HTMLFormElement)) {
            throw new Error();
        }
        form.reportValidity();
        if (hasErrors) {
            return;
        }

        const f = new SpeciesFilter(filterArgs);
        return f.isEmpty() ? undefined : f;
    }

    /**
     * @param {string} prefix
     * @param {SpeciesFilter} filter
     */
    async initForm(prefix, filter = new SpeciesFilter({})) {
        createMonthSelects(prefix, this);

        createMiscFields(prefix);

        // Add location options.
        createLocationElements(prefix, this.#options);

        this.initEventListeners(prefix);

        await this.setFormValues(prefix, filter);
    }

    /**
     * @param {string} prefix
     * @param {string|undefined} projId
     */
    async initProject(prefix, projId) {
        // Check for project.
        hdom.setFormElementValue(prefix + "-proj-id", projId);
        if (!projId) {
            return;
        }
        // Look up name based on ID.
        const projectData = await this.getAPI().getProjectData(projId);
        if (!projectData) {
            return;
        }
        hdom.setFormElementValue(prefix + "-proj-name", projectData.title);
    }

    /**
     * @param {string} prefix
     * @param {SpeciesFilter} filter
     */
    async setFormValues(prefix, filter) {
        /**
         * @param {SpeciesFilter} filter
         * @param {SearchUI} ui
         */
        function initMonth(filter, ui) {
            const months = filter.getMonth();
            let m1, m2;
            if (typeof months === "number") {
                m1 = m2 = months;
            } else if (months !== undefined) {
                m1 = months[0];
                m2 = months[months.length - 1];
            }
            hdom.setFormElementValue(prefix + "-month1", m1);
            hdom.setFormElementValue(prefix + "-month2", m2);
            ui.setMonthLock(prefix, m1 === m2);
        }

        /**
         * @param {import("../types.js").INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initObserver(api, filter) {
            const id = filter.getUserID();
            hdom.setFormElementValue(prefix + "-observer-id", id);
            if (!id) {
                return;
            }
            // Look up name based on ID.
            const data = await api.getUserData(id);
            if (!data) {
                return;
            }
            hdom.setFormElementValue(prefix + "-observer-name", data.login);
        }

        /**
         * @param {import("../types.js").INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initPlace(api, filter) {
            // Check for place.
            const placeID = filter.getPlaceID();
            hdom.setFormElementValue(prefix + "-place-id", placeID);
            if (!placeID) {
                return;
            }
            // Look up name based on ID.
            const placeData = await api.getPlaceData(placeID);
            if (!placeData) {
                return;
            }
            hdom.setFormElementValue(
                prefix + "-place-name",
                placeData.display_name,
            );
        }

        /**
         * @param {import("../types.js").INatAPI} api
         * @param {SpeciesFilter} filter
         */
        async function initTaxon(api, filter) {
            // Check for taxon.
            const taxonID = filter.getTaxonID();
            hdom.setFormElementValue(prefix + "-taxon-id", taxonID);
            if (!taxonID) {
                return;
            }
            // Look up name based on ID.
            const taxonData = await api.getTaxonData(taxonID);
            if (!taxonData) {
                return;
            }
            hdom.setFormElementValue(
                prefix + "-taxon-name",
                INatAPI.getTaxonFormName(taxonData),
            );

            // Set value of any annotations.
            const annotations = filter.getAnnotations();
            if (annotations !== undefined) {
                for (const annotation of annotations) {
                    hdom.setFormElementValue(
                        prefix + "-ann-" + annotation.type,
                        annotation.value,
                    );
                }
            }
        }

        /**
         * @param {SpeciesFilter} filter
         */
        function initYear(filter) {
            const years = filter.getYears();
            const year1 = years.year1;
            const year2 = years.year2;
            hdom.setFormElementValue(
                prefix + "-year1",
                year1 ? year1.toString() : "",
            );
            hdom.setFormElementValue(
                prefix + "-year2",
                year2 ? year2.toString() : "",
            );
            SearchUI.setYearMinMax(prefix + "-year");
            SearchUI.setYearMode(prefix + "-year");
        }

        await this.initProject(prefix, filter.getProjectID());
        await initPlace(this.getAPI(), filter);

        await initObserver(this.getAPI(), filter);
        await initTaxon(this.getAPI(), filter);

        await this.updateAnnotationsFields(prefix, filter.getTaxonID());

        initMonth(filter, this);
        initYear(filter);

        const qualityGrades = filter.getQualityGrade();
        for (const qg of QUALITY_GRADES) {
            hdom.setCheckBoxState(
                `${prefix}-${qg.id}`,
                qualityGrades.includes(qg.id),
            );
        }

        hdom.setFormElementValue(
            prefix + "-establishment",
            filter.getEstablishment() ?? "",
        );

        hdom.setFormElementValue(`${prefix}-accuracy`, filter.getMinAccuracy());

        hdom.setCheckBoxState(
            `${prefix}-taxon-obscured`,
            filter.getParams().obscuration === "taxon",
        );

        if (this.#options.allowBoundary) {
            // Select location type.
            const locType = filter.getBoundary() ? "boundary" : "place";
            hdom.clickElement(prefix + "-loc-type-" + locType);

            const boundary = filter.getBoundary();
            if (boundary) {
                hdom.setFormElementValue(
                    prefix + "-boundary-text",
                    JSON.stringify(boundary),
                );
            }
        }
    }

    /**
     * @param {string} prefix
     * @param {boolean} value
     */
    setMonthLock(prefix, value) {
        this.#monthLock[prefix] = value;
    }

    /**
     * @param {string} prefix
     */
    static setYearMinMax(prefix) {
        const d1 = document.getElementById(prefix + "1");
        const d2 = document.getElementById(prefix + "2");
        if (d1 && d2) {
            const d1Val = hdom.getFormElementValue(d1);
            const d2Val = hdom.getFormElementValue(d2);
            d1.setAttribute(
                "max",
                d2Val ? d2Val : DateUtils.getCurrentYear().toString(),
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
            const d1 = hdom.getFormElementValue(prefix + "1");
            const d2 = hdom.getFormElementValue(prefix + "2");
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

        hdom.setFormElementValue(prefix, getMode());
    }

    showSearchForm() {
        hdom.showElement("search-crit", true);
        hdom.setFocusTo("f1-proj-name");
    }

    /**
     * @param {string} prefix
     * @param {string|undefined} taxonID
     */
    async updateAnnotationsFields(prefix, taxonID) {
        const fieldSetID = prefix + "-annotation-filter";
        if (!taxonID) {
            hdom.showElement(fieldSetID, false);
            return;
        }
        const annotations = await SearchUI.getAnnotationsForTaxon(
            parseInt(taxonID),
            this.getAPI(),
        );
        hdom.showElement(fieldSetID, annotations.length > 0);

        // Show only the relevant annotation options.
        for (const type of ANNOTATION_TYPES) {
            hdom.showElement(
                prefix + "-ann-type-" + type,
                annotations.includes(type),
            );
        }
    }
}

/**
 * @param {URLSearchParams} qs
 * @returns {import("../types.js").ParamsSpeciesFilter}
 */
function convertQueryStringToFilterParams(qs) {
    /** @type {import("../types.js").ParamsSpeciesFilter} */
    const params = {};

    for (const [key, value] of qs.entries()) {
        switch (key) {
            case "acc_below_or_unknown":
                params.accuracy = parseFloat(value);
                break;
            case "introduced":
                params.establishment = "introduced";
                break;
            case "month":
                params.month = value.split(",").map((v) => parseInt(v));
                break;
            case "native":
                params.establishment = "native";
                break;
            case "place_id":
                params.place_id = value;
                break;
            case "project_id":
                params.project_id = value;
                break;
            case "quality_grade":
                // @ts-ignore
                params.quality_grade = value.split(",");
                break;
            case "taxon_id":
                params.taxon_id = value;
                break;
            case "user_id":
                params.user_id = value;
                break;
            case "subview":
            case "view":
                break;
        }
    }

    return params;
}

/**
 * @param {string} prefix
 * @param {SearchUIOptions} options
 */
function createLocationElements(prefix, options) {
    if (!options.allowBoundary) {
        return;
    }

    const locationsDiv = hdom.getElement(prefix + "-locations");

    const boundaryDiv = hdom.createElement("div", {
        id: prefix + "-locations-boundary",
    });
    const boundaryTextDiv = hdom.createElement("div", {
        class: "form-input",
    });
    boundaryTextDiv.appendChild(hdom.createElement("label"));
    boundaryTextDiv.appendChild(
        hdom.createElement("textarea", {
            id: prefix + "-boundary-text",
            rows: 1,
            readonly: "",
        }),
    );
    boundaryDiv.appendChild(boundaryTextDiv);
    const boundaryFileDiv = hdom.createElement("div", {
        class: "form-input",
    });
    boundaryFileDiv.appendChild(hdom.createElement("label"));
    const boundaryUpload = hdom.createInputElement({
        id: prefix + "-boundary-file",
        type: "file",
        title: "Upload GeoJSON with boundary",
    });
    hdom.addEventListener(
        boundaryUpload,
        "change",
        async (e) => await handleBoundaryChange(e, prefix),
    );
    boundaryFileDiv.appendChild(boundaryUpload);
    boundaryDiv.appendChild(boundaryFileDiv);
    locationsDiv.appendChild(boundaryDiv);

    const locationTypeDiv = hdom.createElement("div", "form-input");
    locationTypeDiv.appendChild(
        hdom
            .createElement("label")
            .appendChild(document.createTextNode("Location")),
    );
    const radioData = [
        { type: "place", label: "Place" },
        { type: "boundary", label: "Boundary" },
    ];
    for (const data of radioData) {
        const radio = hdom.createRadioElement(
            prefix + "-loc-type",
            prefix + "-loc-type-" + data.type,
            data.type,
            data.label,
        );
        locationTypeDiv.appendChild(radio.radio);
        hdom.addEventListener(radio.radio, "click", () =>
            handleLocationTypeClick(prefix),
        );
        locationTypeDiv.appendChild(radio.label);
    }
    locationsDiv.insertBefore(locationTypeDiv, locationsDiv.firstChild);
}

/**
 * @param {string} prefix
 */
function createMiscFields(prefix) {
    const divForm = hdom.getElement(prefix + "-misc");

    // Add Quality Grade checkboxes.
    const divQuality = hdom.createElement("div", "flex");
    for (const cb of QUALITY_GRADES) {
        divQuality.appendChild(
            HTMLUtils.createCheckboxDiv(
                undefined,
                `${prefix}-${cb.id}`,
                undefined,
                cb.label,
            ),
        );
    }
    divForm.appendChild(divQuality);

    // Add establishment select.
    const establishment = hdom.createSelectElementWithLabel(
        prefix + "-establishment",
        "Establishment",
        [
            { value: "", label: "Any" },
            { value: "native", label: "Native" },
            { value: "introduced", label: "Introduced" },
        ],
    );
    const divEst = hdom.createElement("div", "form-input");
    divEst.appendChild(establishment.label);
    divEst.appendChild(establishment.select);
    divForm.appendChild(divEst);

    const divAccuracy = hdom.createElement("div", "form-input");
    divAccuracy.appendChild(
        hdom.createLabelElement(`${prefix}-accuracy`, "Accuracy"),
    );
    divAccuracy.appendChild(
        hdom.createIntegerInput(`${prefix}-accuracy`, undefined, 99999),
    );
    divAccuracy.appendChild(
        hdom.createTextElement("span", {}, " meters or less"),
    );
    divForm.appendChild(divAccuracy);

    // Add "taxon obscured" option.
    const divObscured = hdom.createElement("div");
    divObscured.appendChild(
        hdom.createCheckBox(`${prefix}-taxon-obscured`, false),
    );
    divObscured.appendChild(
        hdom.createLabelElement(`${prefix}-taxon-obscured`, "Taxon obscured"),
    );
    divForm.appendChild(divObscured);
}

/**
 * @param {string} prefix
 * @param {SearchUI} ui
 */
function createMonthSelects(prefix, ui) {
    const options = [{}].concat(
        DateUtils.MONTH_NAMES.map((n, index) => {
            return { value: String(index + 1), label: n };
        }),
    );

    const select1 = hdom.createSelectElementWithLabel(
        prefix + "-month1",
        "Month",
        options,
    );
    const div = hdom.createElement("div", "form-input");
    if (select1.label) {
        div.appendChild(select1.label);
    }
    div.appendChild(select1.select);
    hdom.addEventListener(select1.select, "change", (e) =>
        handleMonth1Change(e, ui),
    );

    hdom.appendTextValue(div, " to ");
    const select2 = hdom.createSelectElement(prefix + "-month2", options);
    div.appendChild(select2);
    hdom.addEventListener(select2, "change", (e) => handleMonth2Change(e, ui));

    const yearsDiv = hdom.getElement(`${prefix}-date-years`);
    // @ts-ignore - remove once all controls are generated dynamically
    yearsDiv.parentElement.insertBefore(div, yearsDiv);
}

/**
 * @returns {HTMLElement|undefined}
 */
function getAutoCompleteSelection() {
    const ul = hdom.getElement("autocomplete");
    if (ul.hidden) {
        return;
    }
    for (const child of ul.children) {
        if (child.getAttribute("data-highlight") !== null) {
            return /** @type {HTMLElement} */ (child);
        }
    }
}

/**
 * @param {string} prefix
 * @returns {string}
 */
function getLocationType(prefix) {
    const locType = hdom.getFormElement("form", prefix + "-loc-type");
    return hdom.getFormElementValue(locType);
}

/**
 * @param {string} m1
 * @param {string} m2
 * @returns {number|number[]|undefined}
 */
export function getMonthList(m1, m2) {
    const n1 = parseInt(m1);
    const n2 = parseInt(m2);
    if (n1 === n2) {
        return n1;
    }
    if (n1 === 1 && n2 === 12) {
        return;
    }
    const months = [n1];
    for (let month = n1 + 1; month <= (n2 > n1 ? n2 : 12); month++) {
        months.push(month);
    }
    if (n2 < n1) {
        // Add months at beginning of year.
        for (let month = 1; month <= n2; month++) {
            months.push(month);
        }
    }
    return months;
}

/**
 * @param {HTMLElement} li
 */
function handleAutoCompleteHover(li) {
    li.setAttribute("data-highlight", "");

    const parent = /** @type {HTMLElement} */ (li.parentElement);
    for (const child of parent.children) {
        if (child !== li) {
            child.removeAttribute("data-highlight");
        }
    }
}

/**
 * @param {KeyboardEvent} e
 * @param {AutoCompleteConfig} config
 */
function handleAutoCompleteKey(e, config) {
    switch (e.key) {
        case "ArrowDown":
            {
                e.preventDefault();
                const selected = getAutoCompleteSelection();
                if (selected === undefined) {
                    return;
                }
                if (selected.nextSibling instanceof HTMLElement) {
                    selected.removeAttribute("data-highlight");
                    selected.nextSibling.setAttribute("data-highlight", "");
                }
            }
            break;
        case "ArrowUp":
            {
                e.preventDefault();
                const selected = getAutoCompleteSelection();
                if (selected === undefined) {
                    return;
                }
                if (selected.previousSibling instanceof HTMLElement) {
                    selected.removeAttribute("data-highlight");
                    selected.previousSibling.setAttribute("data-highlight", "");
                }
            }
            break;
        case "Enter":
            {
                const selected = getAutoCompleteSelection();
                if (selected === undefined) {
                    return;
                }
                e.preventDefault();
                selectAutoComplete(config, selected);
            }
            break;
    }
}

/**
 * @param {Event} event
 * @param {string} prefix
 */
async function handleBoundaryChange(event, prefix) {
    const elem = event.currentTarget;
    if (!(elem instanceof HTMLInputElement)) {
        return;
    }
    const files = elem.files;
    if (!files) {
        return;
    }
    const file = files.item(0);
    if (!file) {
        return;
    }
    const str = await file.text();
    hdom.setFormElementValue(
        prefix + "-boundary-text",
        JSON.stringify(JSON.parse(str)),
    );
}

/**
 * @param {string} prefix
 */
function handleLocationTypeClick(prefix) {
    const type = getLocationType(prefix);
    hdom.showElement(prefix + "-locations-boundary", type === "boundary");
    hdom.showElement(prefix + "-locations-place", type === "place");
}

/**
 * @param {Event} e
 * @param {SearchUI} ui
 */
function handleMonth1Change(e, ui) {
    const target = e.currentTarget;
    if (!(target instanceof HTMLElement)) {
        throw new Error();
    }
    const prefix = target.id.split("-")[0];
    const locked = ui.getMonthLock(prefix);
    const value = hdom.getFormElementValue(target);
    if (value === "") {
        // Clear both values when one is cleared.
        hdom.setFormElementValue(prefix + "-month2", "");
        ui.setMonthLock(prefix, true);
        return;
    }
    if (locked) {
        hdom.setFormElementValue(prefix + "-month2", value);
    }
}

/**
 * @param {Event} e
 * @param {SearchUI} ui
 */
function handleMonth2Change(e, ui) {
    const target = e.currentTarget;
    if (!(target instanceof HTMLElement)) {
        throw new Error();
    }
    const prefix = target.id.split("-")[0];
    const value = hdom.getFormElementValue(target);
    if (value === "") {
        // Clear both values when one is cleared.
        hdom.setFormElementValue(prefix + "-month1", "");
    }
    ui.setMonthLock(
        prefix,
        value === hdom.getFormElementValue(prefix + "-month1"),
    );
}

/**
 * @param {SearchUI} ui
 * @param {string} prefix
 */
function handleSetFromURL(ui, prefix) {
    /**
     * @param {HTMLDialogElement} eDlg
     */
    function createDialog(eDlg) {
        const eForm = hdom.createElement("form");
        eForm.addEventListener("submit", (e) =>
            setFromURL(e, ui, eDlg, prefix),
        );
        eDlg.appendChild(eForm);

        const inputId = prefix + "-set-url-value";
        const eLabel = hdom.createLabelElement(
            inputId,
            "Enter the iNaturalist URL or query string from which to create the filter",
        );
        const eInput = hdom.createInputElement({
            type: "text",
            id: inputId,
            required: "",
            autofocus: "",
        });
        eForm.appendChild(eLabel);
        eForm.appendChild(eInput);

        const divBtn = hdom.createElement("div", "flex-fullwidth");

        const btnCancel = hdom.createInputElement({
            type: "button",
            value: "Cancel",
        });
        btnCancel.addEventListener("click", () => eDlg.close());

        const btnSubmit = hdom.createInputElement({
            type: "submit",
            value: "Submit",
        });

        divBtn.appendChild(btnCancel);
        divBtn.appendChild(btnSubmit);
        eForm.appendChild(divBtn);

        hdom.getElement(prefix).appendChild(eDlg);
    }

    const id = prefix + "-set-url-dlg";
    let eDlg = document.getElementById(id);
    if (!eDlg) {
        // Create dialog element if it is not there.
        eDlg = hdom.createElement("dialog", { id: id });
        // @ts-ignore
        createDialog(eDlg);
    }
    // @ts-ignore
    eDlg.showModal();
}

/**
 * @param {AutoCompleteConfig} config
 * @param {HTMLElement} li
 */
function selectAutoComplete(config, li) {
    hdom.setFormElementValue(config.getInputID(), li.textContent);
    hdom.setFormElementValue(config.getValueID(), li.dataset.id);
    hdom.showElement("autocomplete", false);
    config.setSelected(true);
}

/**
 * @param {Event} e
 * @param {SearchUI} ui
 * @param {HTMLDialogElement} eDlg
 * @param {string} prefix
 */
function setFromURL(e, ui, eDlg, prefix) {
    e.preventDefault();
    const value = hdom.getFormElementValue(prefix + "-set-url-value");
    let searchParams;
    if (URL.canParse(value)) {
        const url = new URL(value);
        searchParams = url.searchParams;
    } else {
        searchParams = new URLSearchParams(value);
    }

    const params = convertQueryStringToFilterParams(searchParams);
    ui.setFormValues(prefix, new SpeciesFilter(params));

    eDlg.close();
}
