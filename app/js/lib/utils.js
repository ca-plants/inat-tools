import { hdom } from "./hdom.js";

/** @type {{
 * label:string,
 * class?:string,
 * colspan?:number,
 * value:function(import("../types.js").INatDataTaxonObsSummary):string}[]} */
export const TAXA_SUMMARY_COLUMNS = [
    {
        label: "Name",
        class: "c-sn",
        value: (result) => {
            return result.taxon.name;
        },
    },
    {
        label: "Common Name",
        class: "c-cn",
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
                    w ? w[0].toUpperCase() + w.substring(1) : "",
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
        class: "c-odet",
        colspan: 2,
        value: (result) => {
            return result.count.toString();
        },
    },
    {
        label: "",
        class: "c-oin",
        value: (result) => {
            return result.count.toString();
        },
    },
];

/**
 * @param {string} pathPrefix
 * @param {string} title
 * @param {string} fileName
 * @param {function():{content:string,fileName?:string}} getData
 * @returns {Element}
 */
export function createDownloadLink(pathPrefix, title, fileName, getData) {
    function setHref() {
        const data = getData();
        var file = new Blob([data.content], { type: "text/plain" });
        if (data.fileName) {
            dlLink.setAttribute("download", data.fileName);
        }
        dlLink.setAttribute("href", URL.createObjectURL(file));
    }

    const dlImg = hdom.createElement("img", {
        src: pathPrefix + "img/icon/download.svg",
        title: title,
    });
    const dlLink = hdom.createLinkElement("", dlImg, { download: fileName });
    dlLink.addEventListener("click", () => setHref());

    return dlLink;
}

/**
 * @param {SpeciesFilter} filter
 * @param {import("../types.js").INatDataTaxonObsSummary[]} results
 * @returns {Element}
 */
export function createTaxaSummaryTable(filter, results) {
    /**
     * @param {import("../types.js").INatDataTaxonObsSummary} result
     */
    function getTaxonSummary(result) {
        /**
         * @param {Element|string} content
         * @param {string|undefined} className
         */
        function getCol(content, className) {
            const td = hdom.createElement("td", className);
            if (content instanceof Element) {
                td.appendChild(content);
            } else {
                td.appendChild(document.createTextNode(content));
            }
            tr.appendChild(td);
        }

        const tr = hdom.createElement("tr");

        for (let index = 0; index < 2; index++) {
            getCol(
                TAXA_SUMMARY_COLUMNS[index].value(result),
                TAXA_SUMMARY_COLUMNS[index].class,
            );
        }

        obsParams.taxon_id = result.taxon.id.toString();
        detailURL.hash = JSON.stringify({ f1: obsParams, branch: true });
        const eLinkText = hdom.createElement("span");
        eLinkText.appendChild(
            document.createTextNode(TAXA_SUMMARY_COLUMNS[2].value(result)),
        );
        const eLinkLabel = hdom.createElement("span", "sm-label");
        eLinkLabel.appendChild(document.createTextNode(" observations"));
        eLinkText.appendChild(eLinkLabel);
        const eLink = hdom.createLinkElement(detailURL, eLinkText, {
            target: "_blank",
        });
        getCol(eLink, TAXA_SUMMARY_COLUMNS[2].class);

        obsURL.searchParams.set("taxon_id", result.taxon.id.toString());
        const eLinkInat = hdom.createLinkElement(obsURL, "iNat", {
            target: "_blank",
        });
        getCol(eLinkInat, TAXA_SUMMARY_COLUMNS[3].class);

        return tr;
    }

    const table = hdom.createElement("table");

    const thead = hdom.createElement("thead");
    table.appendChild(thead);
    const tr = hdom.createElement("tr");
    thead.appendChild(tr);
    for (const col of TAXA_SUMMARY_COLUMNS) {
        /** @type {Object<string,string>} */
        const attributes = {};
        if (col.class) {
            attributes.class = col.class;
        }
        if (col.colspan) {
            attributes.colspan = col.colspan.toString();
        }
        const th = hdom.createElement("th", attributes);
        tr.appendChild(th);
        th.appendChild(document.createTextNode(col.label));
    }

    const tbody = hdom.createElement("tbody");
    table.appendChild(tbody);

    const obsURL = filter.getURL();
    const obsParams = filter.getParams();
    const detailURL = new URL(
        "./obsdetail.html",
        new URL(document.location.toString()),
    );
    for (const result of results) {
        tbody.appendChild(getTaxonSummary(result));
    }

    const section = hdom.createElement("div", "section");
    section.appendChild(table);
    return section;
}
