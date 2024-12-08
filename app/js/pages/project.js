import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { hdom } from "../lib/hdom.js";
import { InatURL } from "../lib/inaturl.js";
import { SearchUI } from "../lib/searchui.js";

/**
 * @typedef {{proj?:string,submit?:boolean}} QueryArgs
 */

const COLUMNS = {
    PROJ_OBS: new ColDef(
        "# Obs",
        (member) => {
            return member.observations_count.toLocaleString();
        },
        "c-no"
    ),
    USER_LOGIN: new ColDef("Login", (member) => {
        return hdom.createLinkElement(
            InatURL.getUserLink(member.user.login),
            member.user.login,
            { target: "_blank" }
        );
    }),
    USER_NAME: new ColDef("Name", (member) => {
        return member.user.name ?? "";
    }),
    USER_ROLE: new ColDef("Role", (member) => {
        return member.role ?? "";
    }),
};

class UI extends SearchUI {
    #args;

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

        document.location.hash = JSON.stringify({ proj: projId });

        const divResults = hdom.removeChildren("results");

        const data = await DataRetriever.getProjectMembers(
            this.getAPI(),
            projId,
            this.getProgressReporter()
        );

        divResults.appendChild(getResultsTable(data));
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

        const ui = new UI(initArgs);
        await ui.init();
    }

    async init() {
        await super.init();

        const eForm = hdom.getElement("f1");

        eForm.appendChild(getAutoCompleteDiv("f1", "proj", "Project"));
        eForm.appendChild(getSubmitDiv());

        this.initAutoCompleteField("f1", "proj", (v) =>
            this.getAPI().getAutoCompleteProject(v)
        );
        await this.initProject("f1", this.#args.proj);

        hdom.addEventListener(
            "form",
            "submit",
            async (e) => await this.onSubmit(e)
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

/**
 * @param {INatData.ProjectMemberData[]} data
 * @returns {Element}
 */
function getResultsTable(data) {
    const cols = [
        COLUMNS.USER_LOGIN,
        COLUMNS.USER_NAME,
        COLUMNS.PROJ_OBS,
        COLUMNS.USER_ROLE,
    ];
    const table = ColDef.createTable(cols);

    const tbody = hdom.createElement("tbody");
    table.appendChild(tbody);

    for (const result of data) {
        tbody.appendChild(ColDef.createRow(result, cols));
    }

    return table;
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

await UI.getUI();
