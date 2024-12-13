import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { ColDef } from "../lib/coldef.js";
import { hdom } from "../lib/hdom.js";
import { summarizeObservations } from "../lib/obsSummaryTools.js";

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

export class ObsSummaryUI extends SearchUI {
    #f1;
    /** @type {INatData.Observation[]|undefined} */
    #results;

    constructor(f1 = {}) {
        super({ allowBoundary: true });
        this.#f1 = new SpeciesFilter(f1);
    }

    /**
     * @param {import("../lib/obsSummaryTools.js").SummaryEntry[]} results
     * @param {ColDef[]} cols
     */
    getResultsTable(results, cols) {
        /**
         * @param {import("../lib/obsSummaryTools.js").SummaryEntry} entry
         * @param {ColDef[]} cols
         * @param {ObsSummaryUI} ui
         */
        function getRow(entry, cols, ui) {
            /**
             * @param {Node|string} content
             * @param {string|undefined} className
             */
            function getCol(content, className) {
                const td = hdom.createElement("td", className);
                if (content instanceof Node) {
                    td.appendChild(content);
                } else {
                    td.appendChild(document.createTextNode(content));
                }
                tr.appendChild(td);
            }

            const tr = hdom.createElement(
                "tr",
                entry.is_branch ? "branch" : undefined
            );
            for (const col of cols) {
                getCol(col.getValue([entry.name, entry], ui), col.getClass());
            }

            return tr;
        }

        const table = ColDef.createTable(cols);

        const tbody = hdom.createElement("tbody");
        table.appendChild(tbody);

        for (const summary of results) {
            tbody.appendChild(getRow(summary, cols, this));
        }

        const section = hdom.createElement("div", "section");
        section.appendChild(table);
        return section;
    }

    /**
     * @param {[string,import("../lib/obsSummaryTools.js").SummaryEntry]} entry
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
        fp.taxon_id = data.taxon_id.toString();
        Object.assign(fp, extraParams);
        /** @type {Params.PageObsDetail} */
        const args = { f1: fp, coords: selected };
        if (entry[1].is_branch) {
            args.branch = true;
        }
        const url = new URL(
            this.getPathPrefix() + "obsdetail.html",
            document.location.origin
        );
        url.hash = JSON.stringify(args);
        return hdom.createLinkElement(url, num, { target: "_blank" });
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
        const ui = new ObsSummaryUI(initArgs.f1);
        await ui.init();
    }

    /**
     * @param {import("../lib/obsSummaryTools.js").SummaryEntry[]} results
     */
    async #getSummaryDOM(results) {
        // Remove branches from results.
        results = results.filter((r) => !r.is_branch);

        const descrip = hdom.createElement("div");
        descrip.appendChild(
            document.createTextNode(
                await this.#f1.getDescription(this.getAPI())
            )
        );

        const taxaCount = hdom.createElement("div");
        taxaCount.appendChild(
            document.createTextNode(Object.entries(results).length + " taxa")
        );

        const obsCountNode = hdom.createElement("div");
        const obsCount = Object.values(results).reduce(
            (numObs, value) => numObs + value.count,
            0
        );
        obsCountNode.appendChild(
            document.createTextNode(obsCount + " observations")
        );

        const button = this.createChangeFilterButton((e) =>
            this.changeFilter(e)
        );

        const summaryDesc = hdom.createElement("div", {
            class: "flex-fullwidth",
        });
        summaryDesc.appendChild(descrip);
        summaryDesc.appendChild(taxaCount);
        summaryDesc.appendChild(obsCountNode);

        if (!this.#f1.isResearchGradeOnly()) {
            const rgCountNode = hdom.createElement("div");
            const rgCount = Object.values(results).reduce(
                (numObs, value) => numObs + value.countResearchGrade,
                0
            );
            rgCountNode.appendChild(
                document.createTextNode(rgCount + " research grade")
            );

            const rgPctNode = hdom.createElement("div");
            if (obsCount) {
                rgPctNode.appendChild(
                    document.createTextNode(
                        ((rgCount * 100) / obsCount).toFixed(2) +
                            "% research grade"
                    )
                );
            }

            summaryDesc.appendChild(rgCountNode);
            summaryDesc.appendChild(rgPctNode);
        }

        const summary = hdom.createElement("div", {
            class: "section summary",
        });
        summary.appendChild(summaryDesc);
        summary.appendChild(button);

        return summary;
    }

    async init() {
        await super.init();

        // Add handlers for form.
        hdom.getElement("form").addEventListener("submit", (e) =>
            this.onSubmit(e)
        );

        this.initEventListeners("f1");
        await this.initForm("f1", this.#f1);

        hdom.setFocusTo("f1-proj-name");
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

    async showResults() {
        // Hide filter form.
        hdom.showElement("search-crit", false);

        const divResults = hdom.removeChildren("results");

        this.#results = await DataRetriever.getObservationData(
            this.getAPI(),
            this.#f1,
            this.getProgressReporter()
        );
        if (!this.#results) {
            hdom.showElement("search-crit", true);
            hdom.setFocusTo("f1-proj-name");
            return;
        }
        const results = await summarizeObservations(
            this.#results,
            this.getAPI()
        );

        // Show summary.
        divResults.appendChild(await this.#getSummaryDOM(results));

        const cols = [COLUMNS.SCI_NAME, COLUMNS.NUM_OBS];
        if (!this.#f1.isResearchGradeOnly()) {
            cols.push(COLUMNS.NUM_RG, COLUMNS.NUM_NOT_RG, COLUMNS.PCT_RG);
        }
        cols.push(COLUMNS.NUM_OBSCURED, COLUMNS.NUM_NOT_OBSCURED);

        // Show taxa.
        divResults.appendChild(this.getResultsTable(results, cols));
    }
}

await ObsSummaryUI.getUI();
