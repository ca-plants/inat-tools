import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { DOMUtils } from "../lib/domutils.js";
import { Histogram } from "../lib/histogram.js";
import { INatObservation } from "../lib/inatobservation.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { UI } from "../lib/ui.js";

/** @typedef {{role:string}} ProjectMember */
/** @typedef {{countObscured:number,countPublic:number,countTrusted:number,observations:INatObservation[]}} Results */
/** @typedef {{id:string,login:string,display_name:string,results:Results}} UserSummary */

class DetailColDef extends ColDef {
    /**
     * @param {string} th
     * @param {function (INatObservation,...ObsDetailUI) : Element|string} fnValue
     * @param {string} [className]
     */
    constructor(th, fnValue, className) {
        super(th, fnValue, className);
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
        return ui.getObserverINatLink(summ, summ.results.observations.length);
    }),
    NUM_PUBLIC: new SummaryColDef("Public", (summ, ui) => {
        return ui.getObserverINatLink(summ, summ.results.countPublic, [
            "public",
        ]);
    }),
    NUM_TRUSTED: new SummaryColDef("Trusted", (summ, ui) => {
        return ui.getObserverINatLink(summ, summ.results.countTrusted, [
            "trusted",
        ]);
    }),
    NUM_OBSCURED: new SummaryColDef("Obscured", (summ, ui) => {
        return ui.getObserverINatLink(summ, summ.results.countObscured, [
            "obscured",
        ]);
    }),
    PROJECT: new SummaryColDef("Proj Mem", (summ, ui) => {
        return ui.getMembershipStatus(summ.id);
    }),
};

class ObsDetailUI extends UI {
    #taxon_id;
    #f1;
    /** @type {INatData.TaxonData|undefined} */
    #taxon_data;
    /** @type {Results} */
    #results = {
        countObscured: 0,
        countPublic: 0,
        countTrusted: 0,
        observations: [],
    };
    /** @type {Object<string,ProjectMember>} */
    #project_members = {};
    /** @type {Object<string,UserSummary>|undefined} */
    #userSummary;

    /**
     * @param {Params.SpeciesFilter} f1
     */
    constructor(f1) {
        super();
        if (f1.taxon_id === undefined) {
            throw new Error();
        }
        this.#taxon_id = parseInt(f1.taxon_id);
        this.#f1 = new SpeciesFilter(f1);
    }

    clearResults() {
        const eResults = DOMUtils.getRequiredElement("results");
        DOMUtils.removeChildren(eResults);
        return eResults;
    }

    /**
     * @param {Params.SpeciesFilter} params
     * @param {Results} results
     * @param {string[]} [selectedTypes]
     */
    getINatObservationURL(params, results, selectedTypes) {
        /**
         * @param {ObsDetailUI} ui
         */
        function showAll(ui) {
            const filter = new SpeciesFilter(params);
            const url = filter.getURL();
            url.searchParams.set("lrank", ui.#getTaxonData().rank);
            return url;
        }

        if (selectedTypes === undefined) {
            selectedTypes = this.getSelectedTypes();
        }
        const count = ObsDetailUI.#getObsCount(results, selectedTypes);

        if (count === results.observations.length) {
            return showAll(this);
        }

        // Figure out whether we can get the list using a query string or if we need a list of IDs.
        switch (selectedTypes.join(",")) {
            case "public": {
                const filter = new SpeciesFilter(params);
                const url = filter.getURL();
                url.searchParams.set("lrank", this.#getTaxonData().rank);
                url.searchParams.set("taxon_geoprivacy", "open");
                url.searchParams.set("geoprivacy", "open");
                return url;
            }
            case "public,trusted":
            case "trusted":
            case "obscured": {
                const selectedIDs = [];
                for (const obs of results.observations) {
                    if (selectedTypes.includes(obs.getCoordType())) {
                        selectedIDs.push(obs.getID());
                    }
                }
                const url = new URL(
                    "https://www.inaturalist.org/observations?subview=grid"
                );
                const idList = selectedIDs.join(",");
                if (idList.length >= 10813) {
                    return "";
                }
                url.searchParams.set("id", idList);
                return url;
            }
            default:
                return "";
        }
    }

    static async getInstance() {
        /** @type {Params.PageObsDetail} */
        const initArgs = JSON.parse(
            decodeURIComponent(document.location.hash).substring(1)
        );
        const ui = new ObsDetailUI(initArgs.f1);
        await ui.initInstance(initArgs.coords, initArgs.view);
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
     * @param {Results} results
     * @param {string[]} selectedTypes
     */
    static #getObsCount(results, selectedTypes) {
        return selectedTypes.reduce((c, t) => {
            switch (t) {
                case "public":
                    return c + results.countPublic;
                case "obscured":
                    return c + results.countObscured;
            }
            return c + results.countTrusted;
        }, 0);
    }

    /**
     * @param {UserSummary} userSumm
     * @param {number} count
     * @param {string[]} [selectedTypes]
     */
    getObserverINatLink(userSumm, count, selectedTypes) {
        if (count === 0) {
            return "0";
        }
        const params = this.#f1.getParams();
        params.user_id = userSumm.login;
        const url = this.getINatObservationURL(
            params,
            userSumm.results,
            selectedTypes
        );
        if (url === "") {
            return count.toString();
        }
        return DOMUtils.createLinkElement(url, count, {
            target: "_blank",
        });
    }

    getSelectedTypes() {
        /** @type {("public" | "obscured" | "trusted")[]} */
        const types = [];
        for (const type of ["public", "trusted", "obscured"]) {
            if (DOMUtils.isChecked("sel-" + type)) {
                // @ts-ignore
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

    /**
     * @returns {Object<string,UserSummary>}
     */
    #getUserSummary() {
        if (!this.#userSummary) {
            this.#userSummary = {};
            for (const obs of this.#results.observations) {
                const id = obs.getUserID();
                let userSumm = this.#userSummary[id];
                if (!userSumm) {
                    userSumm = {
                        id: id,
                        login: obs.getUserLogin(),
                        display_name: obs.getUserDisplayName(),
                        results: {
                            countPublic: 0,
                            countObscured: 0,
                            countTrusted: 0,
                            observations: [],
                        },
                    };
                    this.#userSummary[id] = userSumm;
                }
                switch (obs.getCoordType()) {
                    case "public":
                        userSumm.results.countPublic++;
                        break;
                    case "trusted":
                        userSumm.results.countTrusted++;
                        break;
                    case "obscured":
                        userSumm.results.countObscured++;
                        break;
                }
                userSumm.results.observations.push(obs);
            }
        }
        return this.#userSummary;
    }

    /**
     * @param {("public"|"obscured"|"trusted")[]} selArray
     * @param {string|undefined} view
     */
    async initInstance(selArray = [], view) {
        /**
         * @param {Element} container
         * @param {number} count
         * @param {"public"|"obscured"|"trusted"} label
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
            cb.addEventListener("click", () => ui.updateDisplay());
            const lbl = DOMUtils.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(count + " " + label));
            div.appendChild(cb);
            div.appendChild(lbl);
            container.appendChild(div);
        }

        /**
         * @param {string} value
         * @param {string} label
         * @param {ObsDetailUI} ui
         */
        function addDisplayOption(value, label, ui) {
            const id = "disp-" + value;
            const div = DOMUtils.createElement("div");
            const rb = DOMUtils.createInputElement({
                type: "radio",
                id: id,
                value: value,
                name: "displayopt",
            });
            rb.addEventListener("click", () => ui.updateDisplay());
            const lbl = DOMUtils.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(label));
            div.appendChild(rb);
            div.appendChild(lbl);
            radios.appendChild(div);
        }

        await super.init();

        const api = this.getAPI();

        this.#taxon_data = await api.getTaxonData(this.#taxon_id.toString());

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
        const filter = new SpeciesFilter(this.#f1.getParams());
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
        addDisplayOption("details", "Details", this);
        addDisplayOption("geojson", "GeoJSON", this);
        addDisplayOption("datehisto", "Date Histogram", this);
        addDisplayOption("usersumm", "Summary by Observer", this);

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

        window.onresize = this.onResize;

        // Select initial view.
        const initialView = DOMUtils.getElement("disp-" + view);
        DOMUtils.clickElement(
            initialView instanceof HTMLElement ? initialView : "disp-details"
        );
    }

    onResize() {
        const svg = document.getElementById("svg-datehisto");
        if (!svg) {
            return;
        }
        const height = window.innerHeight - svg.getBoundingClientRect().top;
        svg.setAttribute("style", `height:${height}px;`);
    }

    showDateHistogram() {
        const eResults = this.clearResults();
        const coordTypes = this.getSelectedTypes();

        const svg = Histogram.createSVG(
            this.#results.observations.filter((obs) =>
                coordTypes.includes(obs.getCoordType())
            ),
            this.#f1
        );

        svg.setAttribute("id", "svg-datehisto");
        eResults.appendChild(svg);
        this.onResize();
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
        const summary = this.#getUserSummary();

        const cols = [SUMMARY_COLS.OBSERVER];
        if (selectedTypes.length > 1) {
            cols.push(SUMMARY_COLS.NUM_OBS);
        }
        if (selectedTypes.includes("public")) {
            cols.push(SUMMARY_COLS.NUM_PUBLIC);
        }
        if (selectedTypes.includes("trusted")) {
            cols.push(SUMMARY_COLS.NUM_TRUSTED);
        }
        if (selectedTypes.includes("obscured")) {
            cols.push(SUMMARY_COLS.NUM_OBSCURED);
        }
        if (this.#project_members) {
            cols.push(SUMMARY_COLS.PROJECT);
        }
        const eTable = DetailColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        eTable.appendChild(tbody);

        for (const userSumm of Object.values(summary).sort(
            (a, b) =>
                ObsDetailUI.#getObsCount(b.results, selectedTypes) -
                ObsDetailUI.#getObsCount(a.results, selectedTypes)
        )) {
            // Only show rows with something to display.
            if (
                (selectedTypes.includes("public") &&
                    userSumm.results.countPublic) ||
                (selectedTypes.includes("obscured") &&
                    userSumm.results.countObscured) ||
                (selectedTypes.includes("trusted") &&
                    userSumm.results.countTrusted)
            ) {
                tbody.appendChild(getRow(userSumm, cols, this));
            }
        }

        this.wrapResults(eResults, eTable);
    }

    /**
     * @param {INatData.Observation[]} rawResults
     * @returns {Promise<Results>}
     */
    async summarizeResults(rawResults) {
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

    updateDisplay() {
        const elem = DOMUtils.getFormElement("form", "displayopt");
        switch (DOMUtils.getFormElementValue(elem)) {
            case "datehisto":
                this.showDateHistogram();
                break;
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

        // Save current settings for bookmark.
        this.#updateHash();
    }

    #updateHash() {
        /** @type {Params.PageObsDetail} */
        const params = {
            f1: this.#f1.getParams(),
            coords: this.getSelectedTypes(),
            // @ts-ignore
            view: DOMUtils.getFormElementValue(
                DOMUtils.getFormElement("form", "displayopt")
            ),
        };
        document.location.hash = JSON.stringify(params);
    }

    #updateViewInINaturalistLink() {
        const url = this.getINatObservationURL(
            this.#f1.getParams(),
            this.#results
        );
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
