import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { DOMUtils } from "../lib/domutils.js";
import { Histogram } from "../lib/histogram.js";
import { INatObservationX as INatObservation } from "../lib/inatobservationx.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { UI } from "../lib/ui.js";

/** @typedef {[string,string][]} ExtraParams */
/** @typedef {{role:string}} ProjectMember */
/** @typedef {{countObscured:number,countPublic:number,countTrusted:number,observations:INatObservation[]}} Results */
/** @typedef {{count:number,count_public:number,count_trusted:number,count_obscured:number,id:string,login:string,display_name:string}} UserSummary */

class DetailColDef extends ColDef {
    /**
     * @param {string} th
     * @param {function (INatObservation,...ObsDetailUI) : Element|string} fnValue
     * @param {string} [className]
     */
    constructor(th, fnValue, className) {
        /** @type {function (any,...any) : Element|string} */
        const f = fnValue;
        super(th, f, className);
    }
}

const DETAIL_COLS = {
    OBS_DATE: new DetailColDef("Date", (obs) => {
        return DOMUtils.createLinkElement(
            obs.getURL(),
            obs.getObsDateString(),
            { target: "_blank" }
        );
    }),
    OBSERVER: new DetailColDef("Observer", (obs) => {
        return DOMUtils.createLinkElement(
            "https://www.inaturalist.org/people/" + obs.getUserLogin(),
            obs.getUserDisplayName(),
            { target: "_blank" }
        );
    }),
    LOCATION: new DetailColDef("Location", (obs) => {
        if (obs.isObscured()) {
            return "";
        }
        const url = new URL("https://www.google.com/maps/search/?api=1");
        url.searchParams.set("query", obs.getCoordinatesString());
        return DOMUtils.createLinkElement(url, obs.getPlaceGuess(), {
            target: "_blank",
        });
    }),
    COORDS: new DetailColDef("Coords", (obs) => {
        return obs.getCoordType();
    }),
    PROJECT: new DetailColDef("Proj Mem", (obs, ui) => {
        return ui.getMembershipStatus(obs.getUserID());
    }),
};

class SummaryColDef extends ColDef {
    /**
     * @param {string} th
     * @param {function (UserSummary,ObsDetailUI) : Element|string} fnValue
     * @param {string} [className]
     */
    constructor(th, fnValue, className) {
        super(th, fnValue, className);
    }
}

const SUMMARY_COLS = {
    OBSERVER: new SummaryColDef("Observer", (summ) => {
        return DOMUtils.createLinkElement(
            "https://www.inaturalist.org/people/" + summ.login,
            summ.display_name,
            { target: "_blank" }
        );
    }),
    NUM_OBS: new SummaryColDef("Total", (summ, ui) => {
        return ui.getObserverINatLink(summ.login, summ.count);
    }),
    NUM_PUBLIC: new SummaryColDef("Public", (summ) => {
        return summ.count_public.toString();
    }),
    NUM_TRUSTED: new SummaryColDef("Trusted", (summ) => {
        return summ.count_trusted.toString();
    }),
    NUM_OBSCURED: new SummaryColDef("Obscured", (summ) => {
        return summ.count_obscured.toString();
    }),
    PROJECT: new SummaryColDef("Proj Mem", (summ, ui) => {
        return ui.getMembershipStatus(summ.id);
    }),
};

class ObsDetailUI extends UI {
    #taxon_id;
    #f1;
    #extraParams;
    #taxon_data = { id: "", rank: "" };
    /** @type {Results} */
    #results = {
        countObscured: 0,
        countPublic: 0,
        countTrusted: 0,
        observations: [],
    };
    /** @type {Object<string,ProjectMember>} */
    #project_members = {};

    /**
     *
     * @param {string} taxon_id
     * @param {import("../../../types/types.js").SpeciesFilterParams} f1
     * @param {ExtraParams} extraParams
     */
    constructor(taxon_id, f1, extraParams = []) {
        super();
        this.#taxon_id = taxon_id;
        this.#f1 = new SpeciesFilter(f1);
        this.#extraParams = extraParams;
    }

    clearResults() {
        const eResults = DOMUtils.getRequiredElement("results");
        DOMUtils.removeChildren(eResults);
        return eResults;
    }

    #getAllFilterParams() {
        const params = this.#f1.getParams();
        params.taxon_id = this.#taxon_id;
        for (const param of this.#extraParams) {
            switch (param[0]) {
                case "quality_grade":
                    params.quality_grade = param[1];
                    break;
            }
        }
        return params;
    }

    static async getInstance() {
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1)
            );
        } catch (error) {
            initArgs = {};
        }
        const ui = new ObsDetailUI(initArgs.taxon_id, initArgs.f1, initArgs.fp);
        await ui.initInstance(initArgs.sel);
        return ui;
    }

    /**
     * @param {string} id
     */
    getMembershipStatus(id) {
        const data = this.#project_members[id];
        if (!data) {
            return "no";
        }
        return data.role ? data.role : "yes";
    }

    /**
     * @param {string} login
     * @param {number} count
     */
    getObserverINatLink(login, count) {
        const params = this.#getAllFilterParams();
        params.user_id = login;
        const filter = new SpeciesFilter(params);
        const url = new URL(
            "https://www.inaturalist.org/observations?subview=grid"
        );
        url.searchParams.set("lrank", this.#taxon_data.rank);
        return DOMUtils.createLinkElement(filter.getURL(url), count, {
            target: "_blank",
        });
    }

    getSelectedTypes() {
        const types = [];
        for (const type of ["public", "trusted", "obscured"]) {
            if (DOMUtils.isChecked("sel-" + type)) {
                types.push(type);
            }
        }
        return types;
    }

    #getTaxonData() {
        if (!this.#taxon_data) {
            throw new Error();
        }
        return this.#taxon_data;
    }

    handleCoordinateChange() {
        const elem = DOMUtils.getFormElement("form", "displayopt");
        switch (DOMUtils.getFormElementValue(elem)) {
            case "geojson":
                this.showGeoJSON();
                break;
            case "usersumm":
                this.showUserSumm();
                break;
            default:
                this.showDetails();
                break;
        }

        // Update view in iNaturalist target.
        this.#updateViewInINaturalistLink();
    }

    /**
     * @param {string[]} selArray
     */
    async initInstance(selArray) {
        /**
         * @param {Element} container
         * @param {number} count
         * @param {string} label
         * @param {ObsDetailUI} ui
         */
        function addBucket(container, count, label, ui) {
            if (count === 0) {
                return;
            }
            const div = DOMUtils.createElement("div");
            const id = "sel-" + label;
            const cb = DOMUtils.createInputElement({
                type: "checkbox",
                id: id,
            });
            cb.checked = selArray.includes(label);
            cb.addEventListener("click", () => ui.handleCoordinateChange());
            const lbl = DOMUtils.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(count + " " + label));
            div.appendChild(cb);
            div.appendChild(lbl);
            container.appendChild(div);
        }

        /**
         *
         * @param {string} value
         * @param {string} label
         * @param {function():void} onclick
         */
        function addDisplayOption(value, label, onclick) {
            const id = "disp-" + value;
            const div = DOMUtils.createElement("div");
            const rb = DOMUtils.createInputElement({
                type: "radio",
                id: id,
                value: value,
                name: "displayopt",
            });
            rb.addEventListener("click", onclick);
            const lbl = DOMUtils.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(label));
            div.appendChild(rb);
            div.appendChild(lbl);
            radios.appendChild(div);
        }

        await super.init();

        const api = this.getAPI();

        this.#taxon_data = await api.getTaxonData(this.#taxon_id);

        const results = await DataRetriever.getObservationData(
            api,
            this.#f1,
            this.getProgressReporter()
        );
        if (!results) {
            return;
        }
        this.#results = await this.summarizeResults(results);

        // If a project is in the filter, retrieve project members.
        const projectID = this.#f1.getParamValue("project_id");
        if (projectID) {
            const members = await DataRetriever.getProjectMembers(
                api,
                projectID,
                this.getProgressReporter()
            );
            this.#project_members = {};
            for (const member of members) {
                this.#project_members[member.user_id] = { role: member.role };
            }
        }

        // Show filter description.
        const filter = new SpeciesFilter(this.#getAllFilterParams());
        DOMUtils.getRequiredElement("filterdesc").appendChild(
            document.createTextNode(await filter.getDescription(api))
        );

        const form = DOMUtils.getRequiredElement("form");
        const checkBoxes = DOMUtils.createElement("div", {
            class: "coordoptions",
        });
        form.appendChild(checkBoxes);
        addBucket(checkBoxes, this.#results.countPublic, "public", this);
        addBucket(checkBoxes, this.#results.countTrusted, "trusted", this);
        addBucket(checkBoxes, this.#results.countObscured, "obscured", this);

        const radios = DOMUtils.createElement("div", {
            class: "displayoptions",
        });
        addDisplayOption("details", "Details", () => this.showDetails());
        addDisplayOption("geojson", "GeoJSON", () => this.showGeoJSON());
        addDisplayOption("datehisto", "Date Histogram", () =>
            this.showDateHistogram()
        );
        addDisplayOption("usersumm", "Summary by Observer", () =>
            this.showUserSumm()
        );

        const iNatDiv = DOMUtils.createElement("div");
        iNatDiv.appendChild(
            DOMUtils.createLinkElement("", "View in iNaturalist", {
                target: "_blank",
                id: "viewininat",
            })
        );

        const optionDiv = DOMUtils.createElement("div", { class: "options" });
        optionDiv.appendChild(radios);
        optionDiv.appendChild(iNatDiv);
        form.appendChild(optionDiv);

        this.#updateViewInINaturalistLink();
        DOMUtils.clickElement("disp-details");
    }

    showDateHistogram() {
        const eResults = this.clearResults();
        eResults.appendChild(Histogram.createSVG(this.#results.observations));
    }

    showDetails() {
        /**
         * @param {INatObservation} obs
         * @param {DetailColDef[]} cols
         * @param {ObsDetailUI} ui
         */
        function getRow(obs, cols, ui) {
            const tr = DOMUtils.createElement("tr");
            for (const col of cols) {
                DetailColDef.addColElement(
                    tr,
                    col.getValue(obs, ui),
                    col.getClass()
                );
            }

            return tr;
        }

        const eResults = this.clearResults();
        const selectedTypes = this.getSelectedTypes();

        const cols = [
            DETAIL_COLS.OBS_DATE,
            DETAIL_COLS.OBSERVER,
            DETAIL_COLS.LOCATION,
            DETAIL_COLS.COORDS,
        ];
        if (this.#project_members) {
            cols.push(DETAIL_COLS.PROJECT);
        }
        const eTable = DetailColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        eTable.appendChild(tbody);

        for (const obs of this.#results.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            tbody.appendChild(getRow(obs, cols, this));
        }

        this.wrapResults(eResults, eTable);
    }

    showGeoJSON() {
        const eResults = this.clearResults();
        const selectedTypes = this.getSelectedTypes();

        const features = [];
        for (const obs of this.#results.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            const properties = {
                url: obs.getURL(),
                date: obs.getObsDateString(),
                observer: obs.getUserDisplayName(),
            };
            const feature = {
                type: "Feature",
                properties: properties,
                geometry: {
                    type: "Point",
                    coordinates: obs.getCoordinatesGeoJSON(),
                },
            };
            features.push(feature);
        }
        const geoJSON = { type: "FeatureCollection", features: features };

        const eButtons = DOMUtils.createElement("div", { class: "section" });
        const urlGJ = new URL("https://geojson.io");
        urlGJ.hash =
            "data=data:application/json," +
            encodeURIComponent(JSON.stringify(geoJSON));
        const eBtnGeoJSONIO = DOMUtils.createLinkElement(urlGJ, "geojson.io", {
            target: "_blank",
        });
        eButtons.appendChild(eBtnGeoJSONIO);
        eResults.appendChild(eButtons);

        const eDivText = DOMUtils.createElement("div", { class: "section" });
        const textarea = DOMUtils.createElement("textarea", { rows: 15 });
        DOMUtils.setFormElementValue(
            textarea,
            JSON.stringify(geoJSON, null, 2)
        );
        eDivText.appendChild(textarea);
        eResults.appendChild(eDivText);
    }

    showUserSumm() {
        /**
         * @param {UserSummary} userSumm
         * @param {DetailColDef[]} cols
         * @param {ObsDetailUI} ui
         */
        function getRow(userSumm, cols, ui) {
            const tr = DOMUtils.createElement("tr");
            for (const col of cols) {
                DetailColDef.addColElement(
                    tr,
                    col.getValue(userSumm, ui),
                    col.getClass()
                );
            }
            return tr;
        }

        const eResults = this.clearResults();
        const selectedTypes = this.getSelectedTypes();

        // Summarize results.
        /** @type {Object<string,UserSummary>} */
        const summary = {};
        for (const obs of this.#results.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            const id = obs.getUserID();
            let userSumm = summary[id];
            if (!userSumm) {
                userSumm = {
                    id: id,
                    login: obs.getUserLogin(),
                    display_name: obs.getUserDisplayName(),
                    count: 0,
                    count_public: 0,
                    count_trusted: 0,
                    count_obscured: 0,
                };
                summary[id] = userSumm;
            }
            switch (obs.getCoordType()) {
                case "public":
                    userSumm.count_public++;
                    break;
                case "trusted":
                    userSumm.count_trusted++;
                    break;
                case "obscured":
                    userSumm.count_obscured++;
                    break;
            }
            userSumm.count++;
        }

        const cols = [
            SUMMARY_COLS.OBSERVER,
            SUMMARY_COLS.NUM_OBS,
            SUMMARY_COLS.NUM_PUBLIC,
            SUMMARY_COLS.NUM_TRUSTED,
            SUMMARY_COLS.NUM_OBSCURED,
        ];
        if (this.#project_members) {
            cols.push(SUMMARY_COLS.PROJECT);
        }
        const eTable = DetailColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        eTable.appendChild(tbody);

        for (const userSumm of Object.values(summary).sort(
            (a, b) => b.count - a.count
        )) {
            tbody.appendChild(getRow(userSumm, cols, this));
        }

        this.wrapResults(eResults, eTable);
    }

    /**
     * @param {import("../lib/dataretriever.js").RawObservation[]} rawResults
     * @returns {Promise<Results>}
     */
    async summarizeResults(rawResults) {
        /**
         * @param {import("../lib/dataretriever.js").RawObservation} result
         * @param {ExtraParams} fp
         */
        function resultMatchesFilter(result, fp) {
            for (const param of fp) {
                switch (param[0]) {
                    case "quality_grade":
                        if (param[1] === "research") {
                            if (result.quality_grade !== "research") {
                                return false;
                            }
                        } else {
                            if (result.quality_grade === "research") {
                                return false;
                            }
                        }
                }
            }
            return true;
        }

        const taxon_data = this.#getTaxonData();
        const taxonSummary = {
            taxon_id: taxon_data.id,
            rank: taxon_data.rank,
            count: 0,
            countPublic: 0,
            countTrusted: 0,
            countObscured: 0,
            countResearchGrade: 0,
            /** @type {INatObservation[]} */ observations: [],
        };

        for (const rawResult of rawResults) {
            if (rawResult.taxon.id !== this.#taxon_id) {
                continue;
            }

            if (!resultMatchesFilter(rawResult, this.#extraParams)) {
                continue;
            }

            const result = new INatObservation(rawResult);
            taxonSummary.observations.push(result);
            taxonSummary.count++;
            if (rawResult.quality_grade === "research") {
                taxonSummary.countResearchGrade++;
            }
            switch (result.getCoordType()) {
                case "public":
                    taxonSummary.countPublic++;
                    break;
                case "trusted":
                    taxonSummary.countTrusted++;
                    break;
                case "obscured":
                    taxonSummary.countObscured++;
                    break;
            }
        }

        return taxonSummary;
    }

    #updateViewInINaturalistLink() {
        /**
         * @param {ObsDetailUI} ui
         */
        function getURL(ui) {
            function showAll() {
                const params = ui.#getAllFilterParams();
                const filter = new SpeciesFilter(params);
                const url = filter.getURL(
                    "https://www.inaturalist.org/observations"
                );
                url.searchParams.set("lrank", ui.#getTaxonData().rank);
                return url;
            }

            const selectedTypes = ui.getSelectedTypes();

            // Figure out whether we can get the list using a query string or if we need a list of IDs.
            switch (selectedTypes.join(",")) {
                case "public,trusted,obscured":
                    return showAll();
                case "public": {
                    const params = ui.#getAllFilterParams();
                    const filter = new SpeciesFilter(params);
                    const url = filter.getURL(
                        "https://www.inaturalist.org/observations"
                    );
                    url.searchParams.set("lrank", ui.#getTaxonData().rank);
                    url.searchParams.set("taxon_geoprivacy", "open");
                    url.searchParams.set("geoprivacy", "open");
                    return url;
                }
                case "public,trusted":
                case "trusted":
                case "obscured": {
                    const selectedIDs = [];
                    for (const obs of ui.#results.observations) {
                        if (selectedTypes.includes(obs.getCoordType())) {
                            selectedIDs.push(obs.getID());
                        }
                    }
                    const url = new URL(
                        "https://www.inaturalist.org/observations"
                    );
                    const idList = selectedIDs.join(",");
                    if (idList.length >= 10813) {
                        return "";
                    }
                    url.searchParams.set("id", idList);
                    return url;
                }
                default:
                    // If one of the checkboxes is not present, the other 2 may include all observations.
                    if (selectedTypes.length == 2) {
                        if (
                            ui.#results.countPublic === 0 ||
                            ui.#results.countTrusted === 0 ||
                            ui.#results.countObscured === 0
                        ) {
                            return showAll();
                        }
                    }
                    return "";
            }
        }

        const url = getURL(this);
        const link = DOMUtils.getRequiredElement("viewininat");
        if (link instanceof HTMLAnchorElement) {
            link.inert = url === "";
            link.href = url.toString();
        }
    }

    /**
     * @param {Element} eResultsDiv
     * @param {Element} eResultDetail
     */
    wrapResults(eResultsDiv, eResultDetail) {
        const section = DOMUtils.createElement("div", "section");
        section.appendChild(eResultDetail);
        eResultsDiv.appendChild(section);
    }
}

await ObsDetailUI.getInstance();
