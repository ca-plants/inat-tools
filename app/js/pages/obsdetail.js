import jstoxml from "https://cdn.jsdelivr.net/npm/jstoxml@5.0.2/dist/jstoxml.js/+esm";
import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { hdom } from "../lib/hdom.js";
import { Histogram } from "../lib/histogram.js";
import { INatObservation } from "../lib/inatobservation.js";
import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { createDownloadLink } from "../lib/utils.js";
import { InatURL } from "../lib/inaturl.js";

/** @typedef {{role:string}} ProjectMember */
/** @typedef {{countObscured:number,countPublic:number,countTrusted:number,observations:INatObservation[]}} Results */
/** @typedef {{id:string,login:string,display_name:string,results:Results}} UserSummary */
/** @typedef {("public" | "obscured" | "trusted")[]} SelArray */

const RESULT_FORM_ID = "form-results";
/** @type {SelArray} */
const ALL_COORD_TYPES = ["public", "trusted", "obscured"];

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
        return hdom.createLinkElement(obs.getURL(), obs.getObsDateString(), {
            target: "_blank",
        });
    }),
    TAXON: new DetailColDef("Taxon", (obs) => obs.getTaxonName()),
    OBSERVER: new DetailColDef("Observer", (obs) => {
        return hdom.createLinkElement(
            InatURL.getUserLink(obs.getUserLogin()),
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
        return hdom.createLinkElement(url, obs.getPlaceGuess(), {
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
        return hdom.createLinkElement(
            InatURL.getUserLink(summ.login),
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

class ObsDetailUI extends SearchUI {
    /** @type {number|undefined} */
    #taxon_id;
    #f1;
    /** @type {INatData.TaxonData|undefined} */
    #taxon_data;
    /** @type {INatData.Observation[]|undefined} */
    #rawResults;
    /** @type {Results} */
    #processedResults = {
        countObscured: 0,
        countPublic: 0,
        countTrusted: 0,
        observations: [],
    };
    /** @type {Object<string,ProjectMember>|undefined} */
    #project_members;

    /**
     * @param {Params.SpeciesFilter} f1
     */
    constructor(f1) {
        super({ allowBoundary: true });
        if (f1.taxon_id === undefined) {
            throw new Error();
        }
        this.#f1 = new SpeciesFilter(f1);
    }

    clearResults() {
        const elem = hdom.getElement("results");
        const childrenToDelete = [];
        for (const child of elem.childNodes) {
            if (
                !(child instanceof HTMLElement) ||
                !["results-summary", RESULT_FORM_ID].includes(
                    // @ts-ignore
                    child.getAttribute("id")
                )
            ) {
                childrenToDelete.push(child);
            }
        }
        childrenToDelete.forEach((child) => elem.removeChild(child));
        return elem;
    }

    /**
     * @param {number|undefined} [indent]
     * @param {string} [type]
     * @returns {{content:string,fileName:string}}
     */
    #getDownloadData(indent, type) {
        /**
         * @param {INatObservation} obs
         * @returns {object}
         */
        function propsDefault(obs) {
            return {
                url: obs.getURL(),
                date: obs.getObsDateString(),
                observer: obs.getUserDisplayName(),
            };
        }

        /**
         * @param {INatObservation} obs
         * @returns {object}
         */
        function propsGaia(obs) {
            return {
                title: obs.getTaxonName(),
                notes: [
                    obs.getObsDateString(),
                    obs.getUserDisplayName(),
                    obs.getURL(),
                ].join("\n"),
            };
        }

        if (type === undefined) {
            type = hdom.getFormElementValue("download-type");
        }

        if (type === "gpx") {
            return {
                content: this.#getGPX(indent),
                fileName: "observations.gpx",
            };
        }

        let fnProps = propsDefault;
        switch (type) {
            case "gaia-gj":
                fnProps = propsGaia;
                break;
        }

        // If there is a boundary, include it in the GeoJSON.
        const params = this.#f1.getParams();
        /** @type {GeoJSON.Feature[]} */
        const features = params.boundary ? params.boundary.features : [];

        const selectedTypes = this.getSelectedTypes();
        for (const obs of this.#processedResults.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            const properties = fnProps(obs);
            /** @type {GeoJSON.Feature} */
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

        const gj = { type: "FeatureCollection", features: features };
        return {
            content: JSON.stringify(gj, undefined, indent),
            fileName: "observations.geojson",
        };
    }

    /**
     * @param {number|undefined} indent
     * @return {string}
     */
    #getGPX(indent) {
        const waypoints = [];
        const selectedTypes = this.getSelectedTypes();
        for (const obs of this.#processedResults.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            const coords = obs.getCoordinatesGeoJSON();
            const waypoint = {
                _name: "wpt",
                _attrs: {
                    lat: coords[1],
                    lon: coords[0],
                },
                _content: {
                    name: obs.getTaxonName(),
                    desc: [
                        obs.getObsDateString(),
                        obs.getUserDisplayName(),
                        obs.getURL(),
                    ].join("\n"),
                },
            };
            waypoints.push(waypoint);
        }

        const json = {
            _name: "gpx",
            _attrs: {
                xmlns: "http://www.topografix.com/GPX/1/1",
                version: "1.1",
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xsi:schemaLocation":
                    "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
                creator: "inat-tools",
            },
            _content: waypoints,
        };
        return jstoxml
            .toXML(json, {
                indent:
                    typeof indent === "number" ? " ".repeat(indent) : undefined,
            })
            .trim();
    }

    /**
     * @param {Params.SpeciesFilter} params
     * @param {Results} results
     * @param {string[]} [selectedTypes]
     */
    getINatObservationURL(params, results, selectedTypes) {
        /**
         * @param {string[]} selectedTypes
         */
        function getIDListURL(selectedTypes) {
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

        /**
         * @param {ObsDetailUI} ui
         */
        function showAll(ui) {
            const filter = new SpeciesFilter(params);
            const url = filter.getURL();
            if (!hdom.isChecked("branch")) {
                url.searchParams.set("lrank", ui.#getTaxonData().rank);
            }
            return url;
        }

        if (selectedTypes === undefined) {
            selectedTypes = this.getSelectedTypes();
        }

        if (params.boundary) {
            // If there's an arbitrary boundary, there's no way to tell iNaturalist.
            return getIDListURL(selectedTypes);
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
                if (!hdom.isChecked("branch")) {
                    url.searchParams.set("lrank", this.#getTaxonData().rank);
                }
                url.searchParams.set("taxon_geoprivacy", "open");
                url.searchParams.set("geoprivacy", "open");
                return url;
            }
            case "public,trusted":
            case "trusted":
            case "obscured":
                return getIDListURL(selectedTypes);
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
        await ui.initInstance(initArgs.coords, initArgs.view, initArgs.branch);
        return ui;
    }

    /**
     * @param {string} id
     * @returns {string}
     */
    getMembershipStatus(id) {
        if (!this.#project_members) {
            return "??";
        }
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
        return hdom.createLinkElement(url, count, {
            target: "_blank",
        });
    }

    /**
     * @returns {("public" | "obscured" | "trusted")[]}
     */
    getSelectedTypes() {
        /** @type {("public" | "obscured" | "trusted")[]} */
        const types = [];
        for (const type of ALL_COORD_TYPES) {
            const id = "sel-" + type;
            if (document.getElementById(id) && hdom.isChecked(id)) {
                // @ts-ignore
                types.push(type);
            }
        }
        return types.length > 0 ? types : [...ALL_COORD_TYPES];
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
        /** @type {Object<string,UserSummary>|undefined} */
        const userSummary = {};

        for (const obs of this.#processedResults.observations) {
            const id = obs.getUserID();
            let userSumm = userSummary[id];
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
                userSummary[id] = userSumm;
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

        return userSummary;
    }

    handleBranchClick() {
        if (!this.#rawResults) {
            return;
        }
        this.#processedResults = this.summarizeResults(
            this.#rawResults,
            hdom.isChecked("branch")
        );
        this.updateCoordOptions(this.getSelectedTypes());
        this.updateDisplay();
    }

    /**
     * @param {("public"|"obscured"|"trusted")[]} selArray
     * @param {string|undefined} view
     * @param {boolean|undefined} branch
     */
    async initInstance(selArray = ALL_COORD_TYPES, view, branch) {
        await super.init();

        // Add handlers for form.
        hdom.addEventListener("form", "submit", async (e) => {
            e.preventDefault();
            await this.onSubmit();
        });

        this.initEventListeners("f1");
        await this.initForm("f1", this.#f1);

        await this.onSubmit(selArray, view, branch);
    }

    onResize() {
        const svg = document.getElementById("svg-datehisto");
        if (!svg) {
            return;
        }
        const height = window.innerHeight - svg.getBoundingClientRect().top;
        svg.setAttribute("style", `height:${height}px;`);
    }

    /**
     * @param {("public"|"obscured"|"trusted")[]} [selArray]
     * @param {string|undefined} [view]
     * @param {boolean|undefined} [includeDescendants]
     */
    async onSubmit(selArray, view, includeDescendants) {
        /**
         * @param {string} value
         * @param {string} label
         * @param {ObsDetailUI} ui
         */
        function addDisplayOption(value, label, ui) {
            const id = "disp-" + value;
            const div = hdom.createElement("div");
            const rb = hdom.createInputElement({
                type: "radio",
                id: id,
                value: value,
                name: "displayopt",
            });
            rb.addEventListener("click", () => ui.updateDisplay());
            const lbl = hdom.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(label));
            div.appendChild(rb);
            div.appendChild(lbl);
            radios.appendChild(div);
        }

        /**
         * @param {SpeciesFilter} filter
         * @param {string} termID
         * @param {string} descrip
         */
        function getAttributeLink(filter, termID, descrip) {
            const params = filter.getParams();
            delete params.annotations;
            delete params.quality_grade;
            const url = new URL(
                "https://www.inaturalist.org/observations/identify"
            );
            url.searchParams.set("reviewed", "any");
            url.searchParams.set("quality_grade", "needs_id,research");
            url.searchParams.set("without_term_id", termID);
            filter = new SpeciesFilter(params);
            const link = hdom.createLinkElement(
                filter.getURL(url),
                `Observations with no ${descrip} annotation`,
                { target: "_blank" }
            );
            const div = hdom.createElement("div");
            div.appendChild(link);
            return div;
        }

        if (selArray === undefined) {
            selArray = this.getSelectedTypes();
        }

        const filter = this.initFilterFromForm("f1");
        if (!filter) {
            return;
        }
        this.#f1 = filter;

        const api = this.getAPI();

        const taxonId = this.#f1.getTaxonID();
        if (!taxonId) {
            alert("You must specify a taxon.");
            hdom.setFocusTo("f1-taxon-name");
            return;
        }
        this.#taxon_id = parseInt(taxonId);
        this.#taxon_data = await api.getTaxonData(this.#taxon_id.toString());

        this.#rawResults = await DataRetriever.getObservationData(
            api,
            this.#f1,
            this.getProgressReporter()
        );
        if (!this.#rawResults) {
            // If retrieval failed, make sure the search form is displayed.
            this.showSearchForm();
            return;
        }
        this.#processedResults = this.summarizeResults(
            this.#rawResults,
            !!includeDescendants
        );

        hdom.showElement("search-crit", false);
        hdom.removeChildren("results");

        // If a project is in the filter, retrieve project members.
        const projectID = this.#f1.getProjectID();
        if (projectID) {
            const members = await DataRetriever.getProjectMembers(
                api,
                projectID,
                this.getProgressReporter()
            );
            this.#project_members = members ? {} : undefined;
            if (this.#project_members) {
                for (const member of members) {
                    this.#project_members[member.user_id] = {
                        role: member.role,
                    };
                }
            }
        }

        // Show filter description.
        const resultsSummary = hdom.createElement("div", {
            id: "results-summary",
            class: "section summary",
        });
        hdom.getElement("results").appendChild(resultsSummary);
        resultsSummary.appendChild(
            document.createTextNode(await filter.getDescription(api))
        );
        resultsSummary.appendChild(
            this.createChangeFilterButton((e) => this.changeFilter(e))
        );

        const form = hdom.createElement("form", { id: RESULT_FORM_ID });
        hdom.getElement("results").appendChild(form);

        const divIncludeOpts = hdom.createElement("div", "options");
        form.appendChild(divIncludeOpts);

        const checkBoxes = hdom.createElement("div", {
            id: "coordoptions",
        });
        divIncludeOpts.appendChild(checkBoxes);

        const divDescendants = hdom.createElement("div");
        divIncludeOpts.appendChild(divDescendants);
        const cbDescendants = hdom.createCheckBox(
            "branch",
            !!includeDescendants
        );
        hdom.addEventListener(cbDescendants, "click", () =>
            this.handleBranchClick()
        );
        divDescendants.appendChild(cbDescendants);
        divDescendants.appendChild(
            hdom.createLabelElement("branch", "Show descendants")
        );

        const radios = hdom.createElement("div", {
            class: "displayoptions",
        });
        const displayOptions = [
            { id: "details" },
            { id: "geojson" },
            { id: "datehisto" },
            { id: "usersumm" },
        ];
        addDisplayOption("details", "Details", this);
        addDisplayOption("geojson", "GeoJSON", this);
        addDisplayOption("datehisto", "Date Histogram", this);
        addDisplayOption("usersumm", "Summary by Observer", this);

        const iNatDiv = hdom.createElement("div");
        iNatDiv.appendChild(
            hdom.createLinkElement("", "View in iNaturalist", {
                target: "_blank",
                id: "viewininat",
            })
        );
        const annotations = filter.getAnnotations();
        if (annotations) {
            for (const annotation of annotations) {
                switch (annotation.type) {
                    case "ev-mammal":
                        iNatDiv.appendChild(
                            getAttributeLink(
                                filter,
                                "22",
                                "evidence of presence"
                            )
                        );
                        break;
                    case "plants":
                        iNatDiv.appendChild(
                            getAttributeLink(filter, "12", "plant phenology")
                        );
                        break;
                }
            }
        }

        const optionDiv = hdom.createElement("div", { class: "options" });
        optionDiv.appendChild(radios);
        optionDiv.appendChild(iNatDiv);
        form.appendChild(optionDiv);

        this.updateCoordOptions(selArray);

        window.onresize = this.onResize;

        // Select initial view.
        const initialView = displayOptions.some((opt) => opt.id === view)
            ? hdom.getElement("disp-" + view)
            : hdom.getElement("disp-details");
        hdom.clickElement(
            initialView instanceof HTMLElement ? initialView : "disp-details"
        );
    }

    showDateHistogram() {
        const eResults = this.clearResults();
        const coordTypes = this.getSelectedTypes();

        const svg = Histogram.createSVG(
            this.#processedResults.observations.filter((obs) =>
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
            const tr = hdom.createElement("tr");
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
            DETAIL_COLS.TAXON,
            DETAIL_COLS.OBSERVER,
            DETAIL_COLS.LOCATION,
            DETAIL_COLS.COORDS,
        ];
        if (this.#project_members) {
            cols.push(DETAIL_COLS.PROJECT);
        }
        const eTable = DetailColDef.createTable(cols);

        const tbody = hdom.createElement("tbody");
        eTable.appendChild(tbody);

        for (const obs of this.#processedResults.observations) {
            if (!selectedTypes.includes(obs.getCoordType())) {
                continue;
            }
            tbody.appendChild(getRow(obs, cols, this));
        }

        this.wrapResults(eResults, eTable);
    }

    showGeoJSON() {
        const eResults = this.clearResults();

        const eButtons = hdom.createElement("div", {
            class: "section flex-fullwidth",
        });
        const urlGJ = new URL("https://geojson.io");
        urlGJ.hash =
            "data=data:application/json," +
            encodeURIComponent(
                this.#getDownloadData(undefined, "geojson").content
            );
        const eBtnGeoJSONIO = hdom.createLinkElement(urlGJ, "geojson.io", {
            target: "_blank",
        });
        eButtons.appendChild(eBtnGeoJSONIO);

        const typeDiv = hdom.createElement("div", "form-input");
        const dlOptions = hdom.createSelectElement("download-type", "", [
            { value: "geojson", label: "GeoJSON" },
            { value: "gpx", label: "GPX" },
            { value: "gaia-gj", label: "Gaia GPS GeoJSON" },
        ]);
        hdom.appendChildren(typeDiv, dlOptions);
        const dlLink = createDownloadLink(
            this,
            "Download GeoJSON",
            "observations.geojson",
            () => this.#getDownloadData()
        );
        const dlDiv = hdom.createElement("div", "buttons");
        dlDiv.appendChild(typeDiv);
        dlDiv.appendChild(dlLink);
        eButtons.appendChild(dlDiv);

        eResults.appendChild(eButtons);
        hdom.addEventListener("download-type", "change", () =>
            this.#updateGeoJSONFormat()
        );

        const eDivText = hdom.createElement("div", { class: "section" });
        const textarea = hdom.createElement("textarea", {
            id: "geojson-value",
            rows: 15,
        });
        eDivText.appendChild(textarea);
        eResults.appendChild(eDivText);

        this.#updateGeoJSONFormat();
    }

    showUserSumm() {
        /**
         * @param {UserSummary} userSumm
         * @param {DetailColDef[]} cols
         * @param {ObsDetailUI} ui
         */
        function getRow(userSumm, cols, ui) {
            const tr = hdom.createElement("tr");
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

        const tbody = hdom.createElement("tbody");
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
     * @param {boolean} includeDescendants
     * @returns {Results}
     */
    summarizeResults(rawResults, includeDescendants) {
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
            if (!includeDescendants && rawResult.taxon.id !== this.#taxon_id) {
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

    /**
     * @param {SelArray} selArray
     */
    updateCoordOptions(selArray = ALL_COORD_TYPES) {
        /**
         * @param {number} count
         * @param {"public"|"obscured"|"trusted"} label
         * @param {ObsDetailUI} ui
         */
        function addBucket(count, label, ui) {
            if (count === 0) {
                return;
            }
            const div = hdom.createElement("div");
            const id = "sel-" + label;
            const cb = hdom.createInputElement({
                type: "checkbox",
                id: id,
            });
            cb.checked = selArray.includes(label);
            hdom.enableElement(cb, numTypes > 1);
            cb.addEventListener("click", () => ui.updateDisplay());
            const lbl = hdom.createElement("label", { for: id });
            lbl.appendChild(document.createTextNode(count + " " + label));
            div.appendChild(cb);
            div.appendChild(lbl);
            checkBoxes.appendChild(div);
        }

        const checkBoxes = hdom.removeChildren("coordoptions");
        const r = this.#processedResults;
        const numTypes =
            Math.sign(r.countObscured) +
            Math.sign(r.countPublic) +
            Math.sign(r.countTrusted);
        addBucket(r.countPublic, "public", this);
        addBucket(r.countTrusted, "trusted", this);
        addBucket(r.countObscured, "obscured", this);
    }

    updateDisplay() {
        const elem = hdom.getFormElement(RESULT_FORM_ID, "displayopt");
        switch (hdom.getFormElementValue(elem)) {
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

        // Make sure all checkboxes are checked.
        const ct = this.getSelectedTypes();
        for (const type of ALL_COORD_TYPES) {
            const cb = document.getElementById(`sel-${type}`);
            if (cb instanceof HTMLInputElement) {
                cb.checked = ct.includes(type);
            }
        }

        // Save current settings for bookmark.
        this.#updateHash();
    }

    #updateGeoJSONFormat() {
        hdom.setFormElementValue(
            "geojson-value",
            this.#getDownloadData(2).content
        );
    }

    #updateHash() {
        /** @type {Params.PageObsDetail} */
        const params = {
            f1: this.#f1.getParams(),
            coords: this.getSelectedTypes(),
            // @ts-ignore
            view: hdom.getFormElementValue(
                hdom.getFormElement(RESULT_FORM_ID, "displayopt")
            ),
        };
        if (hdom.isChecked("branch")) {
            params.branch = true;
        } else {
            delete params.branch;
        }
        document.location.hash = JSON.stringify(params);
    }

    #updateViewInINaturalistLink() {
        const url = this.getINatObservationURL(
            this.#f1.getParams(),
            this.#processedResults
        );
        const link = hdom.getElement("viewininat");
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
        const section = hdom.createElement("div", "section");
        section.appendChild(eResultDetail);
        eResultsDiv.appendChild(section);
    }
}

await ObsDetailUI.getInstance();
