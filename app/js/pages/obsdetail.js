import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { DOMUtils } from "../lib/domutils.js";
import { INatObservation } from "../lib/inatobservation.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { UI } from "../lib/ui.js";

const DETAIL_COLS = {
    OBS_DATE: new ColDef("Date", (obs) => {
        return DOMUtils.createLinkElement(
            INatObservation.getURL(obs),
            INatObservation.getObsDateString(obs),
            { target: "_blank" }
        );
    }),
    OBSERVER: new ColDef("Observer", (obs) => {
        return DOMUtils.createLinkElement(
            "https://www.inaturalist.org/people/" +
                INatObservation.getUserLogin(obs),
            INatObservation.getUserDisplayName(obs),
            { target: "_blank" }
        );
    }),
    LOCATION: new ColDef("Location", (obs) => {
        if (INatObservation.isObscured(obs)) {
            return "";
        }
        const url = new URL("https://www.google.com/maps/search/?api=1");
        url.searchParams.set(
            "query",
            INatObservation.getCoordinatesString(obs)
        );
        return DOMUtils.createLinkElement(
            url,
            INatObservation.getPlaceGuess(obs),
            { target: "_blank" }
        );
    }),
    COORDS: new ColDef("Coords", (obs) => {
        return INatObservation.getCoordType(obs);
    }),
    PROJECT: new ColDef("Proj Mem", (obs, ui) => {
        return ui.getMembershipStatus(INatObservation.getUserID(obs));
    }),
};

const SUMMARY_COLS = {
    OBSERVER: new ColDef("Observer", (summ) => {
        return DOMUtils.createLinkElement(
            "https://www.inaturalist.org/people/" + summ.login,
            summ.display_name,
            { target: "_blank" }
        );
    }),
    NUM_OBS: new ColDef("Total", (summ, ui) => {
        return ui.getObserverINatLink(summ.login, summ.count);
    }),
    NUM_PUBLIC: new ColDef("Public", (summ) => {
        return summ.count_public;
    }),
    NUM_TRUSTED: new ColDef("Trusted", (summ) => {
        return summ.count_trusted;
    }),
    NUM_OBSCURED: new ColDef("Obscured", (summ) => {
        return summ.count_obscured;
    }),
    PROJECT: new ColDef("Proj Mem", (summ, ui) => {
        return ui.getMembershipStatus(summ.id);
    }),
};

class ObsDetailUI extends UI {
    #taxon_id;
    #f1;
    #fp;
    #taxon_data;
    #results;
    #project_members;

    /**
     *
     * @param {string} taxon_id
     * @param {SpeciesFilter} f1
     */
    constructor(taxon_id, f1, fp = []) {
        super();
        this.#taxon_id = taxon_id;
        this.#f1 = new SpeciesFilter(f1);
        this.#fp = fp;
    }

    clearResults() {
        const eResults = DOMUtils.getRequiredElement("results");
        DOMUtils.removeChildren(eResults);
        return eResults;
    }

    #getAllFilterParams() {
        const params = this.#f1.getParams();
        params.taxon_id = this.#taxon_id;
        for (const param of this.#fp) {
            params[param[0]] = param[1];
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
        await ui.init(initArgs.sel);
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
            const cb = document.getElementById("sel-" + type);
            if (cb && cb.checked) {
                types.push(type);
            }
        }
        return types;
    }

    handleCoordinateChange() {
        const form = document.getElementById("form");
        switch (form["displayopt"].value) {
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

    async init(selArray) {
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

        function addDisplayOption(value, label, onclick) {
            const id = "disp-" + value;
            const div = DOMUtils.createElement("div");
            const rb = DOMUtils.createElement("input", {
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
        document.getElementById("disp-details").click();
    }

    showDetails() {
        function getRow(obs, cols, ui) {
            const tr = DOMUtils.createElement("tr");
            for (const col of cols) {
                ColDef.addColElement(tr, col.getValue(obs, ui), col.getClass());
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
        const eTable = ColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        eTable.appendChild(tbody);

        for (const obs of this.#results.observations) {
            if (!selectedTypes.includes(INatObservation.getCoordType(obs))) {
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
            if (!selectedTypes.includes(INatObservation.getCoordType(obs))) {
                continue;
            }
            const properties = {
                url: INatObservation.getURL(obs),
                date: INatObservation.getObsDateString(obs),
                observer: INatObservation.getUserDisplayName(obs),
            };
            const feature = {
                type: "Feature",
                properties: properties,
                geometry: {
                    type: "Point",
                    coordinates: INatObservation.getCoordinatesGeoJSON(obs),
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
        textarea.value = JSON.stringify(geoJSON, null, 2);
        eDivText.appendChild(textarea);
        eResults.appendChild(eDivText);
    }

    showUserSumm() {
        function getRow(userSumm, cols, ui) {
            const tr = DOMUtils.createElement("tr");
            for (const col of cols) {
                ColDef.addColElement(
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
        const summary = {};
        for (const obs of this.#results.observations) {
            if (!selectedTypes.includes(INatObservation.getCoordType(obs))) {
                continue;
            }
            const id = INatObservation.getUserID(obs);
            let userSumm = summary[id];
            if (!userSumm) {
                userSumm = {
                    id: id,
                    login: INatObservation.getUserLogin(obs),
                    display_name: INatObservation.getUserDisplayName(obs),
                    count: 0,
                    count_public: 0,
                    count_trusted: 0,
                    count_obscured: 0,
                };
                summary[id] = userSumm;
            }
            switch (INatObservation.getCoordType(obs)) {
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
        const eTable = ColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        eTable.appendChild(tbody);

        for (const userSumm of Object.values(summary).sort(
            (a, b) => b.count - a.count
        )) {
            tbody.appendChild(getRow(userSumm, cols, this));
        }

        this.wrapResults(eResults, eTable);
    }

    async summarizeResults(rawResults) {
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

        const taxonSummary = {
            taxon_id: this.#taxon_data.id,
            rank: this.#taxon_data.rank,
            count: 0,
            countPublic: 0,
            countTrusted: 0,
            countObscured: 0,
            countResearchGrade: 0,
            observations: [],
        };

        for (const result of rawResults) {
            if (result.taxon.id !== this.#taxon_id) {
                continue;
            }

            if (!resultMatchesFilter(result, this.#fp)) {
                continue;
            }

            taxonSummary.observations.push(result);
            taxonSummary.count++;
            if (result.quality_grade === "research") {
                taxonSummary.countResearchGrade++;
            }
            switch (INatObservation.getCoordType(result)) {
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
                url.searchParams.set("lrank", ui.#taxon_data.rank);
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
                    url.searchParams.set("lrank", ui.#taxon_data.rank);
                    url.searchParams.set("taxon_geoprivacy", "open");
                    url.searchParams.set("geoprivacy", "open");
                    return url;
                }
                case "public,trusted":
                case "trusted":
                case "obscured": {
                    const selectedIDs = [];
                    for (const obs of ui.#results.observations) {
                        if (
                            selectedTypes.includes(
                                INatObservation.getCoordType(obs)
                            )
                        ) {
                            selectedIDs.push(obs.id);
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
