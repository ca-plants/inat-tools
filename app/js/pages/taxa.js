import { csvFormatRows } from "https://cdn.skypack.dev/d3-dsv";
import { DOMUtils } from "../lib/domutils.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { SearchUI } from "../lib/searchui.js";
import { hdom } from "../lib/hdom.js";
import { createDownloadLink } from "../lib/utils.js";

/** @type {{label:string,value:function(INatData.TaxonObsSummary):string}[]} */
const COLUMNS = [
    {
        label: "Name",
        value: (result) => {
            return result.taxon.name;
        },
    },
    {
        label: "Common Name",
        value: (result) => {
            /**
             * @param {string} phrase
             */
            function capitalizeFirstLetters(phrase) {
                if (phrase === undefined) {
                    return "";
                }
                const words = phrase.split(" ");
                const capWords = words.map((w) =>
                    w ? w[0].toUpperCase() + w.substring(1) : ""
                );
                return capWords.join(" ");
            }

            let taxon = result.taxon;
            let commonName = taxon.preferred_common_name;
            if (!commonName && taxon.rank_level > 10) {
                commonName = taxon.rank + " " + taxon.name;
            }
            return capitalizeFirstLetters(commonName);
        },
    },
    {
        label: "# Obs",
        value: (result) => {
            return result.count.toString();
        },
    },
];

class UI extends SearchUI {
    #f1;
    #f2;
    /** @type {INatData.TaxonObsSummary[]|undefined} */
    #results;

    /**
     * @param {object} f1
     * @param {object} f2
     */
    constructor(f1 = {}, f2) {
        super();
        this.#f1 = new SpeciesFilter(f1);
        this.#f2 = f2 === undefined ? undefined : new SpeciesFilter(f2);
    }

    async addExclusions() {
        /**
         * @param {string[]} suffixes
         */
        function copyChecks(suffixes) {
            for (const suffix of suffixes) {
                DOMUtils.enableCheckBox(
                    "f2" + suffix,
                    DOMUtils.isChecked("f1" + suffix)
                );
            }
        }

        hdom.removeClass("search-crit", "no-exclude");
        hdom.showElement("f2", true);
        hdom.showElement("add-exclusions", false);

        // If the exclusion filter is empty, initialize it to be the same as the inclusion filter.
        const f = await this.initFilterFromForm("f2");
        if (!f || f.isEmpty()) {
            // Copy values.
            for (const idSuffix of [
                "-ann-ev-mammal",
                "-ann-plants",
                "-ann-type-ev-mammal",
                "-ann-type-plants",
                "-month1",
                "-observer-name",
                "-observer-id",
                "-place-name",
                "-place-id",
                "-proj-name",
                "-proj-id",
                "-taxon-name",
                "-taxon-id",
                "-year",
                "-year1",
                "-year2",
            ]) {
                const val = DOMUtils.getFormElementValue("f1" + idSuffix);
                DOMUtils.setFormElementValue("f2" + idSuffix, val);
            }
            // Copy checked state.
            copyChecks(["-researchgrade"]);
        }

        this.updateAnnotationsFields(
            "f2",
            DOMUtils.getFormElementValue("f2-taxon-id")
        );
    }

    /**
     * @param {INatData.TaxonObsSummary[]|undefined} results
     * @returns {string}
     */
    #getCSVData(results) {
        if (!results) {
            throw new Error();
        }
        const data = [];
        data.push(COLUMNS.map((col) => col.label));

        for (const result of results) {
            const row = [];
            for (const col of COLUMNS) {
                row.push(col.value(result));
            }
            data.push(row);
        }

        return csvFormatRows(data);
    }

    /**
     * @param {INatData.TaxonObsSummary[]} speciesData
     */
    async #getSummaryDOM(speciesData) {
        const descrip = hdom.createElement("div");
        descrip.appendChild(
            document.createTextNode(
                await this.#f1.getDescription(this.getAPI(), this.#f2)
            )
        );

        const count = hdom.createElement("div");
        count.appendChild(
            document.createTextNode(speciesData.length + " species")
        );

        const downloadLink = createDownloadLink(
            this,
            "Download CSV",
            "species.csv",
            () => this.#getCSVData(this.#results)
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

        const summary = DOMUtils.createElement("div", {
            class: "section summary",
        });
        summary.appendChild(summaryDesc);
        summary.appendChild(button);

        return summary;
    }

    /**
     * @param {SpeciesFilter} filter
     * @param {INatData.TaxonObsSummary[]} results
     */
    getTaxaSummaryTable(filter, results) {
        /**
         * @param {INatData.TaxonObsSummary} result
         */
        function getTaxonSummary(result) {
            /**
             * @param {Element|string} content
             * @param {string} className
             */
            function getCol(content, className) {
                const td = DOMUtils.createElement("td", className);
                if (content instanceof Element) {
                    td.appendChild(content);
                } else {
                    td.appendChild(document.createTextNode(content));
                }
                tr.appendChild(td);
            }

            const tr = DOMUtils.createElement("tr");

            getCol(COLUMNS[0].value(result), "c-sn");
            getCol(COLUMNS[1].value(result), "c-cn");

            obsURL.searchParams.set("taxon_id", result.taxon.id.toString());
            const eLinkText = DOMUtils.createElement("span");
            eLinkText.appendChild(
                document.createTextNode(COLUMNS[2].value(result))
            );
            const eLinkLabel = DOMUtils.createElement("span", "sm-label");
            eLinkLabel.appendChild(document.createTextNode(" observations"));
            eLinkText.appendChild(eLinkLabel);
            const eLink = DOMUtils.createLinkElement(obsURL, eLinkText, {
                target: "_blank",
            });
            getCol(eLink, "c-num");

            return tr;
        }

        const table = DOMUtils.createElement("table");

        const thead = DOMUtils.createElement("thead");
        table.appendChild(thead);
        const tr = DOMUtils.createElement("tr");
        thead.appendChild(tr);
        for (const col of COLUMNS) {
            const th = DOMUtils.createElement("th");
            tr.appendChild(th);
            th.appendChild(document.createTextNode(col.label));
        }

        const tbody = DOMUtils.createElement("tbody");
        table.appendChild(tbody);

        const obsURL = filter.getURL();
        for (const result of results) {
            tbody.appendChild(getTaxonSummary(result));
        }

        const section = DOMUtils.createElement("div", "section");
        section.appendChild(table);
        return section;
    }

    static async getUI() {
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1)
            );
        } catch {
            initArgs = {};
        }
        const ui = new UI(initArgs.f1, initArgs.f2);
        await ui.init();
    }

    async init() {
        await super.init();

        // Add handlers for form.
        hdom.addEventListener("form", "submit", (e) => this.onSubmit(e));
        hdom.addEventListener(
            "add-exclusions",
            "click",
            async () => await this.addExclusions()
        );
        hdom.addEventListener("remove-exclusions", "click", () =>
            this.removeExclusions()
        );

        this.initEventListeners("f1");
        await this.initForm("f1", this.#f1);

        this.initEventListeners("f2");
        await this.initForm("f2", this.#f2);

        if (this.#f2 !== undefined) {
            await this.addExclusions();
        } else {
            this.removeExclusions();
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

        /** @typedef {{f1:SpeciesFilter,f2?:SpeciesFilter}} HashParams */

        /** @type HashParams */
        const params = { f1: this.#f1 };
        if (this.#f2 !== undefined) {
            params.f2 = this.#f2;
        }

        document.location.hash = JSON.stringify(params);
        await this.showResults();
    }

    removeExclusions() {
        hdom.addClass("search-crit", "no-exclude");
        hdom.showElement("f2", false);
        hdom.showElement("add-exclusions", true);
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
            this.getProgressReporter()
        );
        if (!this.#results) {
            return;
        }

        // Show summary.
        divResults.appendChild(await this.#getSummaryDOM(this.#results));

        // Show taxa.
        divResults.appendChild(
            this.getTaxaSummaryTable(this.#f1, this.#results)
        );
    }
}

await UI.getUI();
