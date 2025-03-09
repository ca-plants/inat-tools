import { csvFormatRows } from "d3-dsv";
import { DataRetriever } from "../lib/dataretriever.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { SearchUI } from "../lib/searchui.js";
import { hdom } from "../lib/hdom.js";
import {
    createDownloadLink,
    createTaxaSummaryTable,
    TAXA_SUMMARY_COLUMNS,
} from "../lib/utils.js";

/**
 * @typedef {{f1?:import("../types.js").ParamsSpeciesFilter,f2?:import("../types.js").ParamsSpeciesFilter,compareType?:CompareType}} HashParams
 * @typedef {"exclude"|"subtract"} CompareType
 */

class UI extends SearchUI {
    #f1;
    #f2;
    /** @type {CompareType} */
    #compareType;

    /** @type {import("../types.js").INatDataTaxonObsSummary[]|undefined} */
    #results;

    /**
     * @param {import("../types.js").ParamsSpeciesFilter} f1
     * @param {import("../types.js").ParamsSpeciesFilter} [f2]
     * @param {CompareType} [compareType="exclude"]
     */
    constructor(f1 = {}, f2, compareType = "exclude") {
        super();
        this.#f1 = new SpeciesFilter(f1);
        this.#f2 = f2 === undefined ? undefined : new SpeciesFilter(f2);
        this.#compareType = compareType === "subtract" ? "subtract" : "exclude";
    }

    async addComparisons() {
        hdom.removeClass("search-crit", "no-exclude");
        hdom.showElement("f2", true);
        hdom.showElement("add-comparison", false);

        // If the exclusion filter is empty, initialize it to be the same as the inclusion filter.
        const f = this.initFilterFromForm("f2");
        if (!f || f.isEmpty()) {
            const f1 = this.initFilterFromForm("f1");
            if (!f1) {
                throw new Error();
            }
            this.setFormValues("f2", f1);
        }

        this.updateAnnotationsFields(
            "f2",
            hdom.getFormElementValue("f2-taxon-id"),
        );
    }

    /**
     * @param {import("../types.js").INatDataTaxonObsSummary[]|undefined} results
     * @returns {string}
     */
    #getCSVData(results) {
        if (!results) {
            throw new Error();
        }
        const data = [];
        // Ignore the last column.
        const cols = TAXA_SUMMARY_COLUMNS.slice(0, 3);
        data.push(cols.map((col) => col.label));

        for (const result of results) {
            const row = [];
            for (const col of cols) {
                row.push(col.value(result));
            }
            data.push(row);
        }

        return csvFormatRows(data);
    }

    /**
     * @param {import("../types.js").INatDataTaxonObsSummary[]} speciesData
     */
    async #getSummaryDOM(speciesData) {
        const descrip = hdom.createElement("div");
        descrip.appendChild(
            document.createTextNode(
                await this.#f1.getDescription(this.getAPI(), this.#f2),
            ),
        );

        const count = hdom.createElement("div");
        count.appendChild(
            document.createTextNode(speciesData.length + " species"),
        );

        const downloadLink = createDownloadLink(
            this.getPathPrefix(),
            "Download CSV",
            "species.csv",
            () => {
                return {
                    content: this.#getCSVData(this.#results),
                };
            },
        );
        const download = hdom.createElement("div");
        download.appendChild(downloadLink);

        const button = hdom.createElement("input", {
            type: "button",
            value: "Change Filter",
            style: "width:100%;",
        });
        button.addEventListener("click", (e) => this.changeFilter(e));

        const summaryDesc = hdom.createElement("div", {
            class: "flex-fullwidth",
        });
        summaryDesc.appendChild(descrip);
        summaryDesc.appendChild(count);
        summaryDesc.appendChild(download);

        const summary = hdom.createElement("div", {
            class: "section summary",
        });
        summary.appendChild(summaryDesc);
        summary.appendChild(button);

        return summary;
    }

    static async getUI() {
        /** @type {HashParams} */
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1),
            );
        } catch {
            initArgs = {};
        }
        const ui = new UI(initArgs.f1, initArgs.f2, initArgs.compareType);
        await ui.init();
    }

    async init() {
        await super.init();

        // Add handlers for form.
        hdom.addEventListener("form", "submit", (e) => this.onSubmit(e));
        hdom.addEventListener(
            "add-comparison",
            "click",
            async () => await this.addComparisons(),
        );
        hdom.addEventListener("remove-comparison", "click", () =>
            this.removeComparisons(),
        );

        await this.initForm("f1", this.#f1);
        await this.initForm("f2", this.#f2);

        // Set the comparison type.

        hdom.setFormElementValue(
            hdom.getFormElement(hdom.getElement("form"), "compare-type"),
            this.#compareType,
        );

        if (this.#f2 !== undefined) {
            await this.addComparisons();
        } else {
            this.removeComparisons();
        }

        hdom.setFocusTo("f1-proj-name");
    }

    /**
     * @param {Event} e
     */
    async onSubmit(e) {
        /**
         * @param {SpeciesFilter} f1
         * @param {SpeciesFilter|undefined} f2
         */
        function checkFilters(f1, f2) {
            if (f2) {
                if (JSON.stringify(f1) === JSON.stringify(f2)) {
                    return "The exclusion filter must be different than the inclusion filter.";
                }
            }
        }

        e.preventDefault();

        const hasExclusions = !hdom
            .getElement("search-crit")
            .classList.contains("no-exclude");
        const f1 = this.initFilterFromForm("f1");
        if (!f1) {
            return;
        }
        this.#f1 = f1;
        this.#f2 = hasExclusions ? this.initFilterFromForm("f2") : undefined;

        const errorMsg = checkFilters(this.#f1, this.#f2);
        if (errorMsg) {
            alert(errorMsg);
            return;
        }

        /** @type {HashParams} */
        const params = { f1: this.#f1.getParams() };
        if (this.#f2 !== undefined) {
            params.f2 = this.#f2.getParams();
            if (this.#compareType !== "exclude") {
                params.compareType = this.#compareType;
            }
        }

        document.location.hash = JSON.stringify(params);
        await this.showResults();
    }

    removeComparisons() {
        hdom.addClass("search-crit", "no-exclude");
        hdom.showElement("f2", false);
        hdom.showElement("add-comparison", true);
    }

    async showResults() {
        // Hide filter form.
        hdom.showElement("search-crit", false);

        const divResults = document.getElementById("results");
        if (!divResults) {
            return;
        }
        hdom.removeChildren(divResults);

        this.#results = await DataRetriever.getSpeciesData(
            this.getAPI(),
            this.#f1,
            this.#f2,
            this.getProgressReporter(),
        );
        if (!this.#results) {
            this.showSearchForm();
            return;
        }

        // Show summary.
        divResults.appendChild(await this.#getSummaryDOM(this.#results));

        // Show taxa.
        divResults.appendChild(createTaxaSummaryTable(this.#f1, this.#results));
    }
}

(async function () {
    await UI.getUI();
})();
