import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { hdom } from "../lib/hdom.js";
import { InatURL } from "../lib/inaturl.js";
import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { createTaxaSummaryTable } from "../lib/utils.js";

/**
 * @typedef {{proj?:string,submit?:boolean}} QueryArgs
 */

const COLUMNS = {
    PROJ_OBS: new ColDef(
        "# Obs",
        (member) => {
            return member.observations_count.toLocaleString();
        },
        undefined,
        "c-no",
    ),
    USER_LOGIN: new ColDef(
        "Login",
        (member) => member.user.login,
        (value) => {
            return hdom.createLinkElement(InatURL.getUserLink(value), value, {
                target: "_blank",
            });
        },
    ),
    USER_NAME: new ColDef("Name", (member) => {
        return member.user.name ?? "";
    }),
    USER_ROLE: new ColDef("Role", (member) => {
        return member.role ?? "";
    }),
};

class UI extends SearchUI {
    #args;

    /** @type {INatData.ProjectData|undefined} */
    #projData;
    /** @type {INatData.ProjectMemberData[]|undefined} */
    #projMembers;
    /** @type {import("../types.js").INatDataTaxonObsSummary[]|undefined} */
    #projObscuredTaxa;

    /**
     * @param {QueryArgs} args
     */
    constructor(args) {
        super();
        this.#args = args;
    }

    async doSearch() {
        const projId = hdom.getFormElementValue("f1-proj-id");
        if (!projId) {
            alert("You must select a project.");
            return;
        }

        this.#projData = this.#projMembers = undefined;

        document.location.hash = JSON.stringify({ proj: projId });

        const divResults = hdom.removeChildren("results");

        this.#projData = await this.getAPI().getProjectData(projId);
        divResults.appendChild(this.#getResultsHeader());

        divResults.appendChild(
            hdom.createElement("div", { id: "results-table" }),
        );

        hdom.clickElement("view-type-members");
    }

    static async getUI() {
        let initArgs;
        try {
            initArgs = JSON.parse(
                decodeURIComponent(document.location.hash).substring(1),
            );
        } catch {
            initArgs = {};
        }

        const ui = new UI(initArgs);
        await ui.init();
    }

    async init() {
        await super.init();

        const eForm = hdom.getElement("f1");

        eForm.appendChild(getAutoCompleteDiv("f1", "proj", "Project"));
        eForm.appendChild(getSubmitDiv());

        this.initAutoCompleteField("f1", "proj", (v) =>
            this.getAPI().getAutoCompleteProject(v),
        );
        await this.initProject("f1", this.#args.proj);

        hdom.addEventListener(
            "form",
            "submit",
            async (e) => await this.onSubmit(e),
        );

        hdom.setFocusTo("f1-proj-name");

        if (this.#args.submit) {
            const form = hdom.getElement("form");
            if (form instanceof HTMLFormElement) {
                await this.doSearch();
            }
        }
    }

    /**
     * @param {Event} e
     */
    async onSubmit(e) {
        e.preventDefault();
        await this.doSearch();
    }

    /**
     * @returns {Element}
     */
    #getResultsHeader() {
        if (!this.#projData) {
            throw new Error();
        }
        const divOptions = hdom.createElement("div", "section flex-fullwidth");
        const divOpt1 = hdom.createElement("div");
        divOptions.appendChild(divOpt1);

        const projLink = hdom.createLinkElement(
            "https://www.inaturalist.org/projects/" + this.#projData.slug,
            this.#projData.title,
            { target: "_blank" },
        );
        divOpt1.appendChild(projLink);
        hdom.appendTextValue(divOpt1, " - ");

        const memLink = hdom.createLinkElement(
            `https://www.inaturalist.org/projects/${
                this.#projData.slug
            }/members`,
            ` ${this.#projData.user_ids.length} members`,
            { target: "_blank" },
        );
        divOpt1.appendChild(memLink);

        const divOpt2 = hdom.createElement("div", { id: "taxa-count" });
        divOptions.appendChild(divOpt2);

        const divOpt3 = hdom.createElement("div", "displayoptions");
        divOptions.appendChild(divOpt3);

        const radioData = [
            { type: "members", label: "Members" },
            { type: "taxa", label: "Obscured Taxa" },
        ];
        for (const data of radioData) {
            const div = hdom.createElement("div");
            const radio = hdom.createRadioElement(
                "view-type",
                "view-type-" + data.type,
                data.type,
                data.label,
            );
            div.appendChild(radio.radio);
            hdom.addEventListener(
                radio.radio,
                "click",
                async (e) => await this.#handleViewTypeClick(e),
            );
            div.appendChild(radio.label);
            divOpt3.appendChild(div);
        }

        return divOptions;
    }

    /**
     * @returns {Promise<Element|undefined>}
     */
    async #getResultsTable() {
        if (!this.#projData) {
            throw new Error();
        }

        if (this.#projMembers === undefined) {
            this.#projMembers = await DataRetriever.getProjectMembers(
                this.getAPI(),
                this.#projData.slug,
                this.getProgressReporter(),
            );
            if (this.#projMembers === undefined) {
                return;
            }
        }

        const cols = [
            COLUMNS.USER_LOGIN,
            COLUMNS.USER_NAME,
            COLUMNS.PROJ_OBS,
            COLUMNS.USER_ROLE,
        ];
        const table = ColDef.createTable(cols);

        const tbody = hdom.createElement("tbody");
        table.appendChild(tbody);

        for (const result of this.#projMembers) {
            tbody.appendChild(ColDef.createRow(result, cols));
        }

        return table;
    }

    /**
     * @returns {Promise<Element|undefined>}
     */
    async #getSpeciesTable() {
        if (!this.#projData) {
            throw new Error();
        }

        /** @type {import("../types.js").ParamsSpeciesFilter} */
        const filterParams = {
            project_id: this.#projData.id.toString(),
            obscuration: "taxon",
        };
        const filter = new SpeciesFilter(filterParams);
        if (this.#projObscuredTaxa === undefined) {
            this.#projObscuredTaxa = await DataRetriever.getSpeciesData(
                this.getAPI(),
                filter,
                undefined,
                this.getProgressReporter(),
            );
            if (this.#projObscuredTaxa === undefined) {
                return;
            }
        }

        hdom.showElement("taxa-count", true);
        hdom.setElementText(
            "taxa-count",
            `${this.#projObscuredTaxa.length} obscured taxa`,
        );

        return createTaxaSummaryTable(filter, this.#projObscuredTaxa);
    }

    /**
     * @param {Event} e
     */
    async #handleViewTypeClick(e) {
        if (!(e.currentTarget instanceof Element)) {
            throw new Error();
        }

        const divTable = hdom.removeChildren("results-table");

        let results;
        switch (e.currentTarget.id) {
            case "view-type-members":
                hdom.showElement("taxa-count", false);
                results = await this.#getResultsTable();
                break;
            case "view-type-taxa":
                results = await this.#getSpeciesTable();
                break;
        }

        if (results) {
            divTable.appendChild(results);
        }
    }
}

/**
 * @param {string} prefix
 * @param {string} name
 * @param {string} label
 * @returns {Element}
 */
function getAutoCompleteDiv(prefix, name, label) {
    const eDiv = hdom.createElement("div", "form-input");

    const id = `${prefix}-${name}-name`;
    const eLabel = hdom.createLabelElement(id, label);
    eDiv.appendChild(eLabel);

    const eInput = hdom.createInputElement({
        type: "text",
        list: `${id}-list`,
        id: id,
        autocomplete: "off",
    });
    eDiv.appendChild(eInput);

    const eHidden = hdom.createInputElement({
        type: "hidden",
        id: `${prefix}-${name}-id`,
    });
    eDiv.appendChild(eHidden);

    const eDataList = hdom.createElement("datalist", { id: `${id}-list` });
    eDiv.appendChild(eDataList);

    return eDiv;
}

function getSubmitDiv() {
    const eDiv = hdom.createElement("div", "buttons section");

    const eButton = hdom.createInputElement({
        type: "submit",
        id: "filter-submit",
    });
    eDiv.appendChild(eButton);

    return eDiv;
}

(async function () {
    await UI.getUI();
})();
