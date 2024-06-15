import { DateUtils } from "./dateutils.js";

/** @deprecated */
const FP = {
    MONTH: "month",
    PLACE_ID: "place_id",
    PROJ_ID: "project_id",
    QUALITY_GRADE: "quality_grade",
    TAXON_ID: "taxon_id",
    USER_ID: "user_id",
    YEAR1: "year1",
    YEAR2: "year2",
};

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

class SpeciesFilter {
    /** @type {Params.SpeciesFilter} */
    #params = {};

    /**
     * @param {Params.SpeciesFilter} params
     */
    constructor(params) {
        Object.assign(this.#params, params);
    }

    /**
     * @param {INatAPI} api
     * @param {SpeciesFilter} [exclusions]
     */
    async getDescription(api, exclusions) {
        let descrip = "Species";

        if (this.#params.taxon_id) {
            const taxon = await api.getTaxonData(this.#params.taxon_id);
            descrip = api.getTaxonFormName(taxon, false);
        }
        descrip += " observed";
        if (this.#params.user_id) {
            const user = await api.getUserData(this.#params.user_id);
            descrip += " by " + user.login;
        }
        if (this.#params.project_id) {
            const proj = await api.getProjectData(this.#params.project_id);
            descrip += ' in project "' + proj.title + '"';
        }
        if (this.#params.place_id) {
            const place = await api.getPlaceData(this.#params.place_id);
            descrip += " in " + place.display_name;
        }
        if (this.#params.month) {
            descrip += " in " + MONTH_NAMES[this.#params.month - 1];
        }
        const year1 = this.#params.year1;
        const year2 = this.#params.year2;
        if (year1) {
            if (year2) {
                if (year1 === year2) {
                    descrip += " in " + year1;
                } else {
                    descrip += " from " + year1 + " through " + year2;
                }
            } else {
                descrip += " in " + year1 + " or later";
            }
        } else {
            if (year2) {
                descrip += " in " + year2 + " or earlier";
            }
        }
        switch (this.#params.quality_grade) {
            case "needs_id":
                descrip += " (needs ID only)";
                break;
            case "research":
                descrip += " (research grade only)";
                break;
        }
        if (exclusions) {
            descrip += ", excluding " + (await exclusions.getDescription(api));
        }
        return descrip;
    }

    getParams() {
        return structuredClone(this.#params);
    }

    /**
     * @param {"project_id"} name
     */
    getParamValue(name) {
        return this.#params[name];
    }

    /**
     * @param {string|URL} [urlStr]
     */
    getURL(urlStr = "https://www.inaturalist.org/observations") {
        const url = new URL(urlStr);
        for (const [k, v] of Object.entries(this.#params)) {
            switch (k) {
                case FP.YEAR1:
                    url.searchParams.set(
                        "d1",
                        DateUtils.getDateString(new Date(v, 0, 1))
                    );
                    break;
                case FP.YEAR2:
                    url.searchParams.set(
                        "d2",
                        DateUtils.getDateString(new Date(v, 11, 31))
                    );
                    break;
                default:
                    url.searchParams.set(k, v);
                    break;
            }
        }
        return url;
    }

    isEmpty() {
        return Object.keys(this.#params).length === 0;
    }

    isResearchGradeOnly() {
        return this.#params.quality_grade === "research";
    }

    toJSON() {
        return this.#params;
    }
}

export { SpeciesFilter, FP };
