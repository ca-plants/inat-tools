import jstoxml from "jstoxml";
import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { hdom } from "../lib/hdom.js";
import { HistogramDate, HistogramTime } from "../lib/histogram.js";
import { INatObservation } from "../lib/inatobservation.js";
import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { createDownloadLink } from "../lib/utils.js";
import { InatURL } from "../lib/inaturl.js";
import { DEFAULT_MAP_SOURCE, Map, MAP_SOURCES } from "../lib/map.js";
import { Clusterer } from "../tools/clusterer.js";

/** @typedef {{role:string}} ProjectMember */
/** @typedef {{countObscured:number,countPublic:number,countTrusted:number,observations:INatObservation[]}} Results */
/** @typedef {{id:string,login:string,display_name:string,results:Results}} UserSummary */
/** @typedef {("public" | "obscured" | "trusted")[]} SelArray */

const RESULT_FORM_ID = "form-results";
/** @type {SelArray} */
const ALL_COORD_TYPES = ["public", "trusted", "obscured"];

/** @type {Object<string,ColDef<INatObservation>>} */
const DETAIL_COLS = {
    OBS_DATE: new ColDef(
        "Date",
        (obs) => {
            return obs
                .getObsDateString()
                .replaceAll("-", String.fromCharCode(8209));
        },
        (value, obs) => {
            return hdom.createLinkElement(obs.getURL(), value, {
                target: "_blank",
                title: obs.getObsTimeString() ?? "time not specified",
            });
        },
    ),
    TAXON: new ColDef("Taxon", (obs) => obs.getTaxonName()),
    OBSERVER: new ColDef(
        "Observer",
        (obs) => obs.getUserDisplayName(),
        (value, obs) => {
            return hdom.createLinkElement(
                InatURL.getUserLink(obs.getUserLogin()),
                value,
                { target: "_blank" },
            );
        },
    ),
    LOCATION: new ColDef(
        "Location",
        (obs) => {
            return obs.getPlaceGuess();
        },
        (value, obs) => {
            if (obs.isObscured()) {
                return "";
            }
            const url = new URL("https://www.google.com/maps/search/?api=1");
            url.searchParams.set("query", obs.getCoordinatesString());
            return hdom.createLinkElement(url, value, {
                target: "_blank",
            });
        },
    ),
    COORDS: new ColDef("Coords", (obs) => {
        return obs.getCoordType();
    }),
    PROJECT: new ColDef("Proj Mem", (obs, ui) => {
        return ui.getMembershipStatus(obs.getUserID());
    }),
};

/** @type {Object<string,ColDef<UserSummary>>} */
const SUMMARY_COLS = {
    OBSERVER_LOGIN: new ColDef("Login", (summ) => summ.login),
    OBSERVER_NAME: new ColDef("Name", (summ) =>
        summ.display_name === summ.login ? "" : summ.display_name,
    ),
    OBSERVER: new ColDef(
        "Observer",
        (summ) => summ.display_name,
        (value, summ) => {
            return hdom.createLinkElement(
                InatURL.getUserLink(summ.login),
                value,
                { target: "_blank" },
            );
        },
    ),
    NUM_OBS: new ColDef(
        "Total",
        (summ) => String(summ.results.observations.length),
        (value, summ, ui) => {
            return ui.getObserverINatLink(summ, value);
        },
        "right",
    ),
    NUM_PUBLIC: new ColDef(
        "Public",
        (summ) => String(summ.results.countPublic),
        (value, summ, ui) => {
            return ui.getObserverINatLink(summ, value, ["public"]);
        },
        "right",
    ),
    NUM_TRUSTED: new ColDef(
        "Trusted",
        (summ) => String(summ.results.countTrusted),
        (value, summ, ui) => {
            return ui.getObserverINatLink(summ, value, ["trusted"]);
        },
        "right",
    ),
    NUM_OBSCURED: new ColDef(
        "Obscured",
        (summ) => String(summ.results.countObscured),
        (value, summ, ui) => {
            return ui.getObserverINatLink(summ, value, ["obscured"]);
        },
        "right",
    ),
    PROJECT: new ColDef("Proj Mem", (summ, ui) => {
        return ui.getMembershipStatus(summ.id);
    }),
};

class ObsDetailUI extends SearchUI {
    /** @type {number|undefined} */
    #taxon_id;
    #f1;
    /** @type {import("../types.js").INatDataTaxon|undefined} */
    #taxon_data;
    /** @type {import("../types.js").INatDataObs[]|undefined} */
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
    /** @type {import("../types.js").ParamsPageObsDetail} */
    #hashParams;
    /** @type {number|undefined} */
    #debounceTimer;
    /** @type {import("geojson").FeatureCollection|undefined} */
    #downloadData;

    /**
     * @param {import("../types.js").ParamsPageObsDetail} params
     */
    constructor(params) {
        super({ allowBoundary: true });
        this.#hashParams = params;
        this.#f1 = new SpeciesFilter(params.f1 ?? {});
    }

    clearResults() {
        const elem = hdom.getElement("results");
        const childrenToDelete = [];
        for (const child of elem.childNodes) {
            if (
                !(child instanceof HTMLElement) ||
                !["results-summary", RESULT_FORM_ID].includes(
                    // @ts-ignore
                    child.getAttribute("id"),
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
    #getMapDataDownload(indent, type) {
        if (type === undefined) {
            type = hdom.getFormElementValue("download-type");
        }

        if (type === "gpx") {
            return {
                content: this.#getGPX(indent),
                fileName: "observations.gpx",
            };
        }

        const gj = this.#getGeoJSON();
        return {
            content: JSON.stringify(gj, undefined, indent),
            fileName: "observations.geojson",
        };
    }

    /**
     * @returns {{content:string,fileName:string}}
     */
    #getMapDownload() {
        return {
            content: JSON.stringify(this.#downloadData),
            fileName:
                this.#getMapMode() === "mt-pop"
                    ? "populations.geojson"
                    : "observations.geojson",
        };
    }

    /**
     * @returns {GeoJSON.FeatureCollection}
     */
    #getGeoJSON() {
        // If there is a boundary, include it in the GeoJSON.
        const params = this.#f1.getParams();
        /** @type {GeoJSON.Feature[]} */
        const features = params.boundary ? params.boundary.features : [];

        this.#addGeoJSONObservations(features);

        return { type: "FeatureCollection", features: features };
    }

    /**
     * @returns {GeoJSON.FeatureCollection<import("geojson").Point>}
     */
    #getGeoJSONPoints() {
        /** @type {GeoJSON.Feature<import("geojson").Point>[]} */
        const features = [];
        this.#addGeoJSONObservations(features);

        return { type: "FeatureCollection", features: features };
    }

    /**
     * @param {number|undefined} indent
     * @return {string}
     */
    #getGPX(indent) {
        const waypoints = [];
        for (const obs of this.#getSelectedObservations()) {
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
     * @param {import("../types.js").ParamsSpeciesFilter} params
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
            return InatURL.getObsIDLink(selectedIDs);
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
        /** @type {import("../types.js").ParamsPageObsDetail} */
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1),
            );
        } catch {
            initArgs = {};
        }

        const ui = new ObsDetailUI(initArgs);
        await ui.initInstance(initArgs);
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
            selectedTypes,
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
            hdom.isChecked("branch"),
        );
        this.updateCoordOptions(this.getSelectedTypes());
        this.updateDisplay();
    }

    /**
     * @param {import("../types.js").ParamsPageObsDetail} params
     */
    async initInstance(params) {
        await super.init();

        // Add handlers for form.
        hdom.addEventListener("form", "submit", async (e) => {
            e.preventDefault();
            await this.onSubmit();
        });

        await this.initForm("f1", this.#f1);

        await this.onSubmit(params);
    }

    onResize() {
        const mode = getViewMode();
        switch (mode) {
            case "datehisto":
                {
                    const svg = document.getElementById("svg-datehisto");
                    if (!svg) {
                        return;
                    }
                    const height =
                        window.innerHeight - svg.getBoundingClientRect().top;
                    svg.setAttribute("style", `height:${height}px;`);
                }
                break;
            case "map":
                setMapHeight();
                break;
        }
    }

    /**
     * @param {import("../types.js").ParamsPageObsDetail} [params={}]
     */
    async onSubmit(params = {}) {
        /**
         * @param {string} value
         * @param {string} label
         * @param {ObsDetailUI} ui
         */
        function addDisplayOption(value, label, ui) {
            const id = "disp-" + value;
            const div = createRadioDiv("displayopt", id, value, label, () =>
                ui.updateDisplay(),
            );
            radios.appendChild(div);
        }

        let selArray = params.coords;
        let includeDescendants = params.branch;

        if (selArray === undefined) {
            selArray = this.getSelectedTypes();
        }
        if (
            includeDescendants === undefined &&
            document.getElementById("branch")
        ) {
            // Preserve the state of the Show descendants checkbox if present.
            includeDescendants = hdom.isChecked("branch");
        }

        this.#f1 = this.initFilterFromForm("f1") ?? new SpeciesFilter({});
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
            this.getProgressReporter(),
        );
        if (!this.#rawResults) {
            // If retrieval failed, make sure the search form is displayed.
            this.showSearchForm();
            return;
        }
        this.#processedResults = this.summarizeResults(
            this.#rawResults,
            !!includeDescendants,
        );

        hdom.showElement("search-crit", false);
        hdom.removeChildren("results");

        // If a project is in the filter, retrieve project members.
        const projectID = this.#f1.getProjectID();
        if (projectID) {
            const members = await DataRetriever.getProjectMembers(
                api,
                projectID,
                this.getProgressReporter(),
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
            class: "section summary flex",
        });
        hdom.getElement("results").appendChild(resultsSummary);
        const divDesc = hdom.createElement("div", {
            style: "flex:3;min-width:20rem",
        });
        divDesc.appendChild(
            document.createTextNode(await this.#f1.getDescription(api)),
        );
        resultsSummary.appendChild(divDesc);
        const link = getNeedsAttributeLink(this.#f1);
        if (link) {
            const divLink = hdom.createElement("div", {
                style: "flex:2;min-width:15rem;text-align:right",
            });
            divLink.appendChild(link);
            resultsSummary.appendChild(divLink);
        }
        resultsSummary.appendChild(
            this.createChangeFilterButton((e) => this.changeFilter(e)),
        );

        const form = hdom.createElement("form", { id: RESULT_FORM_ID });
        hdom.getElement("results").appendChild(form);

        const divIncludeOpts = hdom.createElement("div", "options");
        form.appendChild(divIncludeOpts);

        const checkBoxes = hdom.createElement("div", {
            id: "coordoptions",
        });
        divIncludeOpts.appendChild(checkBoxes);

        const divDescendants = hdom.createElement("div", "checkbox");
        divIncludeOpts.appendChild(divDescendants);
        const cbDescendants = hdom.createCheckBox(
            "branch",
            !!includeDescendants,
        );
        hdom.addEventListener(cbDescendants, "click", () =>
            this.handleBranchClick(),
        );
        divDescendants.appendChild(cbDescendants);
        divDescendants.appendChild(
            hdom.createLabelElement("branch", "Show descendants"),
        );

        const radios = hdom.createElement("div", {
            class: "displayoptions",
        });
        const displayOptions = [
            { id: "details", label: "Details" },
            { id: "mapdata", label: "Map Data" },
            { id: "datehisto", label: "Histogram" },
            { id: "usersumm", label: "Summary by Observer" },
            { id: "map", label: "Map" },
        ];
        displayOptions.forEach((opt) =>
            addDisplayOption(opt.id, opt.label, this),
        );

        const iNatDiv = hdom.createElement("div", "right");
        iNatDiv.appendChild(
            hdom.createLinkElement("", "View in iNaturalist", {
                target: "_blank",
                id: "viewininat",
            }),
        );

        const optionDiv = hdom.createElement("div", { class: "options" });
        optionDiv.appendChild(radios);
        optionDiv.appendChild(iNatDiv);
        form.appendChild(optionDiv);

        this.updateCoordOptions(selArray);

        if (
            this.#processedResults.countPublic === 0 &&
            this.#processedResults.countTrusted === 0
        ) {
            hdom.enableElement("disp-map", false);
            hdom.enableElement("disp-mapdata", false);
        }
        window.onresize = this.onResize;

        // Select initial view.
        let view = this.#hashParams.view;
        const initialView = displayOptions.some((opt) => opt.id === view)
            ? hdom.getElement("disp-" + view)
            : hdom.getElement("disp-details");
        hdom.clickElement(
            initialView instanceof HTMLElement ? initialView : "disp-details",
        );
    }

    showDateHistogram() {
        const eResults = this.clearResults();

        const divHistoOptions = hdom.createElement("div", "section options");
        eResults.appendChild(divHistoOptions);

        const divTypeOptions = hdom.createElement("div", "flex");
        divHistoOptions.appendChild(divTypeOptions);
        const types = [
            {
                value: "date",
                label: "Date",
                handler: () => this.#setHistoType("date"),
            },
            {
                value: "time",
                label: "Time",
                handler: () => this.#setHistoType("time"),
            },
        ];
        for (const type of types) {
            divTypeOptions.appendChild(
                createRadioDiv(
                    "histo-type",
                    `hist-${type.value}`,
                    type.value,
                    type.label,
                    type.handler,
                ),
            );
        }

        const histMode =
            this.#hashParams.hist?.view === "time" ? "hist-time" : "hist-date";
        hdom.clickElement(histMode);
    }

    showDetails() {
        const eResults = this.clearResults();
        const selectedTypes = this.getSelectedTypes();

        const cols = [
            DETAIL_COLS.OBS_DATE,
            DETAIL_COLS.TAXON,
            DETAIL_COLS.OBSERVER,
        ];
        // Don't include location column if all observations are obscured.
        if (selectedTypes.length > 1 || selectedTypes[0] !== "obscured") {
            cols.push(DETAIL_COLS.LOCATION);
        }
        cols.push(DETAIL_COLS.COORDS);
        if (this.#project_members) {
            cols.push(DETAIL_COLS.PROJECT);
        }
        const eTable = ColDef.createTable(cols);

        const tbody = hdom.createElement("tbody");
        eTable.appendChild(tbody);

        for (const obs of this.#getSelectedObservations()) {
            tbody.appendChild(ColDef.createRow(obs, cols, [this]));
        }

        this.#wrapResults(eResults, eTable);
    }

    showMap() {
        const eResults = this.clearResults();

        removeObscured();

        const divMapOptions = hdom.createElement("div", "section options");
        eResults.appendChild(divMapOptions);

        const options = Object.entries(MAP_SOURCES).map((source) => {
            return { value: source[0], label: source[1].label };
        });
        const selectSource = hdom.createSelectElement("map-source", options);
        divMapOptions.appendChild(selectSource);

        const divPopOptions = hdom.createElement("div", {
            id: "mt-pop-options",
        });
        divMapOptions.appendChild(divPopOptions);
        divPopOptions.appendChild(
            createTextInputDiv(
                {
                    id: "mt-pop-distance",
                    type: "number",
                    required: "",
                    step: ".01",
                    inputmode: "numeric",
                    min: 0.01,
                    max: 10,
                    style: "width:4rem",
                    value: this.#hashParams.map?.maxdist ?? 1,
                },
                "Max distance (km)",
            ),
        );

        const divTypeOptions = hdom.createElement("div", "flex");
        divMapOptions.appendChild(divTypeOptions);
        const types = [
            {
                value: "obs",
                label: "Observations",
                handler: () => this.#setMapTypeObs(map, gj),
            },
            {
                value: "pop",
                label: "Populations",
                handler: () => this.#setMapTypePop(map, gj),
            },
        ];
        for (const type of types) {
            divTypeOptions.appendChild(
                createRadioDiv(
                    "map-type",
                    `mt-${type.value}`,
                    type.value,
                    type.label,
                    type.handler,
                ),
            );
        }
        const dlLink = createDownloadLink(
            this.getPathPrefix(),
            "Download",
            () => this.#getMapDownload(),
        );
        divTypeOptions.appendChild(dlLink);

        const divMap = hdom.createElement("div", {
            class: "section",
            id: "map",
        });
        eResults.appendChild(divMap);
        setMapHeight();

        const source = this.#hashParams.map?.source ?? DEFAULT_MAP_SOURCE;
        const map = new Map(source);
        const gj = this.#getGeoJSONPoints();
        map.fitBounds(gj);

        hdom.setFormElementValue(selectSource, source);
        selectSource.addEventListener("change", () => {
            this.#updateHash();
            map.setSource(hdom.getFormElementValue(selectSource));
        });

        hdom.addEventListener("mt-pop-distance", "change", () =>
            this.#debounce(() => this.#setMapTypePop(map, gj)),
        );
        const mapMode = this.#getMapMode();
        hdom.clickElement(mapMode);
    }

    showMapData() {
        const eResults = this.clearResults();

        removeObscured();

        const eButtons = hdom.createElement("div", {
            class: "section flex-fullwidth",
        });

        const typeDiv = hdom.createElement("div", "form-input");
        const dlOptions = hdom.createSelectElementWithLabel(
            "download-type",
            "Format:",
            [
                { value: "geojson", label: "GeoJSON" },
                { value: "gpx", label: "GPX" },
            ],
        );
        hdom.appendChildren(typeDiv, Object.values(dlOptions));
        const dlLink = createDownloadLink(
            this.getPathPrefix(),
            "Download",
            () => this.#getMapDataDownload(),
        );
        const dlDiv = hdom.createElement("div", "buttons");
        dlDiv.appendChild(typeDiv);
        dlDiv.appendChild(dlLink);
        eButtons.appendChild(dlDiv);

        const urlGJ = new URL("https://geojson.io");
        urlGJ.hash =
            "data=data:application/json," +
            encodeURIComponent(
                this.#getMapDataDownload(undefined, "geojson").content,
            );
        const eBtnGeoJSONIO = hdom.createLinkElement(
            urlGJ,
            "View at geojson.io",
            {
                id: "geojson-io-link",
                target: "_blank",
            },
        );
        eButtons.appendChild(eBtnGeoJSONIO);

        eResults.appendChild(eButtons);
        hdom.addEventListener("download-type", "change", () =>
            this.#updateGeoJSONFormat(),
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
        const eResults = this.clearResults();
        const selectedTypes = this.getSelectedTypes();

        // Summarize results.
        const summary = this.#getUserSummary();
        const sortedSummary = Object.values(summary).sort(
            (a, b) =>
                ObsDetailUI.#getObsCount(b.results, selectedTypes) -
                ObsDetailUI.#getObsCount(a.results, selectedTypes),
        );

        const cols = [SUMMARY_COLS.OBSERVER];
        const csvCols = [
            SUMMARY_COLS.OBSERVER_LOGIN,
            SUMMARY_COLS.OBSERVER_NAME,
        ];
        if (selectedTypes.length > 1) {
            cols.push(SUMMARY_COLS.NUM_OBS);
            csvCols.push(SUMMARY_COLS.NUM_OBS);
        }
        if (selectedTypes.includes("public")) {
            cols.push(SUMMARY_COLS.NUM_PUBLIC);
            csvCols.push(SUMMARY_COLS.NUM_PUBLIC);
        }
        if (selectedTypes.includes("trusted")) {
            cols.push(SUMMARY_COLS.NUM_TRUSTED);
            csvCols.push(SUMMARY_COLS.NUM_TRUSTED);
        }
        if (selectedTypes.includes("obscured")) {
            cols.push(SUMMARY_COLS.NUM_OBSCURED);
            csvCols.push(SUMMARY_COLS.NUM_OBSCURED);
        }
        if (this.#project_members) {
            cols.push(SUMMARY_COLS.PROJECT);
            csvCols.push(SUMMARY_COLS.PROJECT);
        }
        const eTable = ColDef.createTable(cols);

        const tbody = hdom.createElement("tbody");
        eTable.appendChild(tbody);

        for (const userSumm of sortedSummary) {
            // Only show rows with something to display.
            if (
                (selectedTypes.includes("public") &&
                    userSumm.results.countPublic) ||
                (selectedTypes.includes("obscured") &&
                    userSumm.results.countObscured) ||
                (selectedTypes.includes("trusted") &&
                    userSumm.results.countTrusted)
            ) {
                tbody.appendChild(ColDef.createRow(userSumm, cols, [this]));
            }
        }

        const divHeader = hdom.createElement("div", "center");
        hdom.setTextValue(divHeader, "Download ");
        const downloadLink = createDownloadLink(
            this.getPathPrefix(),
            "Download CSV",
            () => {
                return {
                    content: ColDef.getCSVData(sortedSummary, csvCols, this),
                    fileName: "species.csv",
                };
            },
        );
        divHeader.appendChild(downloadLink);

        const divUserSumm = hdom.createElement("div", "section");
        divUserSumm.appendChild(divHeader);
        divUserSumm.appendChild(eTable);
        eResults.appendChild(divUserSumm);
    }

    /**
     * @param {import("../types.js").INatDataObs[]} rawResults
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
            const div = hdom.createElement("div", "checkbox");
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
        switch (getViewMode()) {
            case "datehisto":
                this.showDateHistogram();
                break;
            case "map":
                this.showMap();
                break;
            case "mapdata":
                this.showMapData();
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

    /**
     * @param {import("geojson").Feature[]} features
     */
    #addGeoJSONObservations(features) {
        /**
         * @param {INatObservation} obs
         * @returns {Object<string,any>}
         */
        function propsDefault(obs) {
            const accuracy = obs.getAccuracy();
            /** @type {Object<string,any>} */
            const props = {
                id: obs.getID(),
                taxon_name: obs.getTaxonName(),
                url: obs.getURL(),
                date: obs.getObsDateString(),
                observer: obs.getUserDisplayName(),
                is_public: obs.getCoordType() === "public",
            };
            if (accuracy !== undefined) {
                props.accuracy = accuracy;
            }
            return props;
        }

        const fnProps = propsDefault;

        for (const obs of this.#getSelectedObservations()) {
            const properties = fnProps(obs);
            /** @type {GeoJSON.Feature<import("geojson").Point>} */
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
    }

    /**
     * @param {function} fn
     */
    #debounce(fn) {
        clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(fn, 500);
    }

    /**
     * @returns {"mt-obs"|"mt-pop"}
     */
    #getMapMode() {
        return this.#hashParams.map && this.#hashParams.map.view === "pop"
            ? "mt-pop"
            : "mt-obs";
    }

    /**
     * @returns {INatObservation[]}
     */
    #getSelectedObservations() {
        const selectedTypes = this.getSelectedTypes();

        return this.#processedResults.observations.filter((obs) =>
            selectedTypes.includes(obs.getCoordType()),
        );
    }

    /**
     * @param {"date"|"time"} type
     */
    #setHistoType(type) {
        // Delete current histogram if present.
        const e = document.getElementById("svg-datehisto");
        if (e) {
            e.remove();
        }
        const eResults = hdom.getElement("results");
        const histo =
            type === "time"
                ? new HistogramTime(this.#getSelectedObservations(), this.#f1)
                : new HistogramDate(this.#getSelectedObservations(), this.#f1);
        const svg = histo.createSVG();

        svg.setAttribute("id", "svg-datehisto");
        eResults.appendChild(svg);
        this.onResize();
        this.#updateHash();
    }

    /**
     * @param {Map} map
     * @param {import("geojson").FeatureCollection} gj
     */
    #setMapTypeObs(map, gj) {
        hdom.showElement("mt-pop-options", false);
        map.clearFeatures();
        map.addObservations(gj);
        this.#downloadData = gj;
        this.#updateHash();
    }

    /**
     * @param {Map} map
     * @param {import("geojson").FeatureCollection<import("geojson").Point>} gj
     */
    #setMapTypePop(map, gj) {
        hdom.showElement("mt-pop-options", true);
        hdom.setFocusTo("mt-pop-distance");
        map.clearFeatures();

        const distance = getPopDistance();

        const clusterer = new Clusterer();
        const clustered = clusterer.cluster(gj, distance);
        const bordered = clusterer.addBorders(clustered, distance);

        map.addObservations(bordered);
        this.#downloadData = bordered;
        this.#updateHash();
    }

    #updateGeoJSONFormat() {
        hdom.setFormElementValue(
            "geojson-value",
            this.#getMapDataDownload(2).content,
        );

        // Update links based on selected type.
        switch (hdom.getFormElementValue("download-type")) {
            case "gpx":
                hdom.showElement("geojson-io-link", false);
                break;
            case "geojson":
                hdom.showElement("geojson-io-link", true);
                break;
        }
    }

    #updateHash() {
        /** @type {import("../types.js").ParamsPageObsDetail} */
        const params = {
            f1: this.#f1.getParams(),
            coords: this.getSelectedTypes(),
            view: getViewMode(),
        };
        if (hdom.isChecked("branch")) {
            params.branch = true;
        }
        if (params.view === "datehisto") {
            params.hist = {};
            if (hdom.isChecked("hist-time")) {
                params.hist.view = "time";
            }
            if (Object.keys(params.hist).length === 0) {
                delete params.hist;
            }
        } else if (params.view === "map") {
            params.map = {};
            const source = hdom.getFormElementValue("map-source");
            if (source !== DEFAULT_MAP_SOURCE) {
                params.map.source = source;
            }
            if (hdom.isChecked("mt-pop")) {
                params.map.view = "pop";
                params.map.maxdist = getPopDistance();
            }
            if (Object.keys(params.map).length === 0) {
                delete params.map;
            }
        }
        this.#hashParams = params;
        document.location.hash = JSON.stringify(params);
    }

    #updateViewInINaturalistLink() {
        const url = this.getINatObservationURL(
            this.#f1.getParams(),
            this.#processedResults,
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
    #wrapResults(eResultsDiv, eResultDetail) {
        const section = hdom.createElement("div", "section");
        section.appendChild(eResultDetail);
        eResultsDiv.appendChild(section);
    }
}

/**
 * @param {string} name
 * @param {string} id
 * @param {string} value
 * @param {string} label
 * @param {function(Event):void} [fnClickHandler]
 * @returns {HTMLElement}
 */
function createRadioDiv(name, id, value, label, fnClickHandler) {
    const div = hdom.createElement("div", "radio");
    const rb = hdom.createInputElement({
        type: "radio",
        id: id,
        value: value,
        name: name,
    });
    const lbl = hdom.createLabelElement(id, label);
    div.appendChild(rb);
    div.appendChild(lbl);
    if (fnClickHandler) {
        rb.addEventListener("click", fnClickHandler);
    }
    return div;
}

/**
 * @param {Object<string,string|number>} attributes
 * @param {string} label
 * @returns {HTMLElement}
 */
function createTextInputDiv(attributes, label) {
    const div = hdom.createElement("div", "textinput");
    const text = hdom.createInputElement(attributes);
    const lbl = hdom.createLabelElement(attributes.id.toString(), label);
    div.appendChild(lbl);
    div.appendChild(text);
    return div;
}

/**
 * @param {SpeciesFilter} filter
 * @returns {Element|undefined}
 */
function getNeedsAttributeLink(filter) {
    /**
     * @param {SpeciesFilter} filter
     * @param {string} termID
     * @param {string} descrip
     */
    function getLink(filter, termID, descrip) {
        const params = filter.getParams();
        delete params.annotations;
        delete params.quality_grade;
        const url = new URL(
            "https://www.inaturalist.org/observations/identify",
        );
        url.searchParams.set("reviewed", "any");
        url.searchParams.set("quality_grade", "needs_id,research");
        url.searchParams.set("without_term_id", termID);
        filter = new SpeciesFilter(params);
        const link = hdom.createLinkElement(
            filter.getURL(url),
            `Observations with no ${descrip} annotation`,
            { target: "_blank" },
        );
        const div = hdom.createElement("div");
        div.appendChild(link);
        return div;
    }

    const annotations = filter.getAnnotations();
    if (annotations) {
        for (const annotation of annotations) {
            switch (annotation.type) {
                case "ev-mammal":
                    return getLink(filter, "22", "evidence of presence");
                case "plants":
                    return getLink(filter, "12", "plant phenology");
            }
        }
    }
}

function getPopDistance() {
    return parseFloat(hdom.getFormElementValue("mt-pop-distance"));
}

/**
 * @returns {import("../types.js").EnumObsDetailView}
 */
function getViewMode() {
    const radioVal = hdom.getFormElementValue(
        hdom.getFormElement(RESULT_FORM_ID, "displayopt"),
    );
    switch (radioVal) {
        case "datehisto":
        case "mapdata":
        case "map":
        case "usersumm":
            return radioVal;
    }
    return "details";
}

function removeObscured() {
    const ePublic = hdom.getElementById("sel-public");
    const eTrusted = hdom.getElementById("sel-trusted");
    const eObscured = hdom.getElementById("sel-obscured");

    // If neither public nor trusted is checked, check them before unchecking obscured.
    if (
        (!ePublic || !hdom.isChecked(ePublic)) &&
        (!eTrusted || !hdom.isChecked(eTrusted))
    ) {
        if (ePublic) hdom.setCheckBoxState(ePublic, true);
        if (eTrusted) hdom.setCheckBoxState(eTrusted, true);
    }
    if (eObscured) {
        hdom.setCheckBoxState("sel-obscured", false);
    }
}

function setMapHeight() {
    const divMap = hdom.getElement("map");
    divMap.style.setProperty(
        "height",
        `${window.screen.availHeight - divMap.offsetTop - 8}px`,
    );
}

(async function () {
    await ObsDetailUI.getInstance();
})();
