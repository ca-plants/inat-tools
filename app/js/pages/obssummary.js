import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { DOMUtils } from "../lib/domutils.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { INatAPI } from "../lib/inatapi.js";
import { INatObservationX as INatObservation } from "../lib/inatobservationx.js";
import { ColDef } from "../lib/coldef.js";

/**
 * @typedef {{taxon_id:string,displayName:string,rank:string,count:number,countObscured:number,countPublic:number,countResearchGrade:number}} SummaryEntry
 */

const COLUMNS = {
    SCI_NAME: new ColDef(
        "Taxon",
        (entry) => {
            return entry[1].displayName;
        },
        "c-sn"
    ),
    NUM_OBS: new ColDef(
        "#",
        (entry, ui) => {
            return ui.getDetailLink(entry, entry[1].count);
        },
        "c-num"
    ),
    NUM_RG: new ColDef(
        "Res. Grd.",
        (entry, ui) => {
            return ui.getDetailLink(
                entry,
                entry[1].countResearchGrade,
                undefined,
                { quality_grade: "research" }
            );
        },
        "c-num"
    ),
    NUM_NOT_RG: new ColDef(
        "Not Res. Grd.",
        (entry, ui) => {
            return ui.getDetailLink(
                entry,
                entry[1].count - entry[1].countResearchGrade,
                undefined,
                { quality_grade: "needs_id" }
            );
        },
        "c-num"
    ),
    PCT_RG: new ColDef(
        "% Res. Grd.",
        (entry) => {
            return (
                (entry[1].countResearchGrade * 100) /
                entry[1].count
            ).toFixed(2);
        },
        "c-num"
    ),
    NUM_OBSCURED: new ColDef(
        "Obscured",
        (entry, ui) => {
            return ui.getDetailLink(entry, entry[1].countObscured, [
                "obscured",
            ]);
        },
        "c-num"
    ),
    NUM_NOT_OBSCURED: new ColDef(
        "Not Obscured",
        (entry, ui) => {
            return ui.getDetailLink(
                entry,
                entry[1].count - entry[1].countObscured,
                ["public", "trusted"]
            );
        },
        "c-num"
    ),
};

class ObsUI extends SearchUI {
    #f1;
    /** @type {INatData.Observation[]|undefined} */
    #results;

    constructor(f1 = {}) {
        super();
        this.#f1 = new SpeciesFilter(f1);
    }

    /**
     * @param {Object<string,SummaryEntry>} results
     * @param {ColDef[]} cols
     */
    getResultsTable(results, cols) {
        /**
         * @param {string} name
         * @param {SummaryEntry} data
         * @param {ColDef[]} cols
         * @param {ObsUI} ui
         */
        function getRow(name, data, cols, ui) {
            /**
             * @param {Node|string} content
             * @param {string|undefined} className
             */
            function getCol(content, className) {
                const td = DOMUtils.createElement("td", className);
                if (content instanceof Node) {
                    td.appendChild(content);
                } else {
                    td.appendChild(document.createTextNode(content));
                }
                tr.appendChild(td);
            }

            const tr = DOMUtils.createElement("tr");
            for (const col of cols) {
                getCol(col.getValue([name, data], ui), col.getClass());
            }

            return tr;
        }

        const table = ColDef.createTable(cols);

        const tbody = DOMUtils.createElement("tbody");
        table.appendChild(tbody);

        for (const name of Object.keys(results).sort()) {
            tbody.appendChild(getRow(name, results[name], cols, this));
        }

        const section = DOMUtils.createElement("div", "section");
        section.appendChild(table);
        return section;
    }

    /**
     * @param {[string,SummaryEntry]} entry
     * @param {number} num
     * @param {("public"|"trusted"|"obscured")[]} [selected=["public", "trusted", "obscured"]]
     * @param {{quality_grade?:"research"|"needs_id"}} [extraParams={}]
     */
    getDetailLink(
        entry,
        num,
        selected = ["public", "trusted", "obscured"],
        extraParams = {}
    ) {
        if (num === 0) {
            return "0";
        }
        const data = entry[1];

        const fp = this.#f1.getParams();
        fp.taxon_id = data.taxon_id;
        Object.assign(fp, extraParams);
        /** @type {Params.PageObsDetail} */
        const args = { f1: fp, coords: selected };
        const url = new URL(
            this.getPathPrefix() + "obsdetail.html",
            document.location.origin
        );
        url.hash = JSON.stringify(args);
        return DOMUtils.createLinkElement(url, num, { target: "_blank" });
    }

    static async getUI() {
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1)
            );
        } catch (error) {
            initArgs = {};
        }
        const ui = new ObsUI(initArgs.f1);
        await ui.init();
    }

    /**
     * @param {Object<string,SummaryEntry>} results
     */
    async #getSummaryDOM(results) {
        const descrip = DOMUtils.createElement("div");
        descrip.appendChild(
            document.createTextNode(
                await this.#f1.getDescription(this.getAPI())
            )
        );

        const taxaCount = DOMUtils.createElement("div");
        taxaCount.appendChild(
            document.createTextNode(Object.entries(results).length + " taxa")
        );

        const obsCountNode = DOMUtils.createElement("div");
        const obsCount = Object.values(results).reduce(
            (numObs, value) => numObs + value.count,
            0
        );
        obsCountNode.appendChild(
            document.createTextNode(obsCount + " observations")
        );

        const button = DOMUtils.createElement("input", {
            type: "button",
            value: "Change Filter",
            style: "width:100%;",
        });
        button.addEventListener("click", (e) => this.changeFilter(e));

        const summaryDesc = DOMUtils.createElement("div", {
            class: "flex-fullwidth",
        });
        summaryDesc.appendChild(descrip);
        summaryDesc.appendChild(taxaCount);
        summaryDesc.appendChild(obsCountNode);

        if (!this.#f1.isResearchGradeOnly()) {
            const rgCountNode = DOMUtils.createElement("div");
            const rgCount = Object.values(results).reduce(
                (numObs, value) => numObs + value.countResearchGrade,
                0
            );
            rgCountNode.appendChild(
                document.createTextNode(rgCount + " research grade")
            );

            const rgPctNode = DOMUtils.createElement("div");
            rgPctNode.appendChild(
                document.createTextNode(
                    ((rgCount * 100) / obsCount).toFixed(2) + "% research grade"
                )
            );

            summaryDesc.appendChild(rgCountNode);
            summaryDesc.appendChild(rgPctNode);
        }

        const summary = DOMUtils.createElement("div", {
            class: "section summary",
        });
        summary.appendChild(summaryDesc);
        summary.appendChild(button);

        return summary;
    }

    async init() {
        await super.init();

        // Add handlers for form.
        DOMUtils.getRequiredElement("form").addEventListener("submit", (e) =>
            this.onSubmit(e)
        );

        this.initEventListeners("f1");
        await this.initForm("f1", this.#f1);

        DOMUtils.setFocusTo("f1-proj-name");
    }

    /**
     * @param {Event} e
     */
    async onSubmit(e) {
        e.preventDefault();

        const filter = this.initFilterFromForm("f1");
        if (!filter) {
            return;
        }
        this.#f1 = filter;

        const params = { f1: this.#f1 };

        document.location.hash = JSON.stringify(params);
        await this.showResults();
    }

    /**
     * @param {INatData.Observation[]} rawResults
     */
    summarizeResults(rawResults) {
        /** @type {Object<string,SummaryEntry>} */
        const summary = {};

        for (const result of rawResults) {
            const name = INatAPI.getTaxonName(result.taxon);
            const obs = new INatObservation(result);
            let taxonSummary = summary[name];
            if (!taxonSummary) {
                taxonSummary = {
                    taxon_id: result.taxon.id,
                    displayName: this.getAPI().getTaxonFormName(
                        result.taxon,
                        false
                    ),
                    rank: result.taxon.rank,
                    count: 0,
                    countObscured: 0,
                    countPublic: 0,
                    countResearchGrade: 0,
                };
                summary[name] = taxonSummary;
            }
            taxonSummary.count++;
            if (result.quality_grade === "research") {
                taxonSummary.countResearchGrade++;
            }
            if (obs.isObscured()) {
                taxonSummary.countObscured++;
            }
            if (obs.coordsArePublic()) {
                taxonSummary.countPublic++;
            }
        }

        return summary;
    }

    async showResults() {
        const divResults = DOMUtils.getRequiredElement("results");
        DOMUtils.removeChildren(divResults);

        this.#results = await DataRetriever.getObservationData(
            this.getAPI(),
            this.#f1,
            this.getProgressReporter()
        );
        if (!this.#results) {
            return;
        }
        const results = this.summarizeResults(this.#results);

        // Show summary.
        divResults.appendChild(await this.#getSummaryDOM(results));

        const cols = [COLUMNS.SCI_NAME, COLUMNS.NUM_OBS];
        if (!this.#f1.isResearchGradeOnly()) {
            cols.push(COLUMNS.NUM_RG, COLUMNS.NUM_NOT_RG, COLUMNS.PCT_RG);
        }
        cols.push(COLUMNS.NUM_OBSCURED, COLUMNS.NUM_NOT_OBSCURED);

        // Show taxa.
        divResults.appendChild(this.getResultsTable(results, cols));

        // Hide filter form.
        DOMUtils.showElement("search-crit", false);
    }
}

await ObsUI.getUI();
