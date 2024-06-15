import { DateUtils } from "./dateutils.js";

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

    getMonths() {
        return { month1: this.#params.month };
    }

    getParams() {
        return structuredClone(this.#params);
    }

    /**
     * @deprecated
     * @param {"project_id"|"quality_grade"} name
     */
    getParamValue(name) {
        return this.#params[name];
    }

    getPlaceID() {
        return this.#params.place_id;
    }

    getProjectID() {
        return this.#params.project_id;
    }

    getTaxonID() {
        return this.#params.taxon_id;
    }

    /**
     * @param {string|URL} [urlStr]
     */
    getURL(urlStr = "https://www.inaturalist.org/observations") {
        const url = new URL(urlStr);
        for (const [k, v] of Object.entries(this.#params)) {
            switch (k) {
                case "year1":
                    url.searchParams.set(
                        "d1",
                        DateUtils.getDateString(new Date(v, 0, 1))
                    );
                    break;
                case "year2":
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

    getUserID() {
        return this.#params.user_id;
    }

    getYears() {
        return { year1: this.#params.year1, year2: this.#params.year2 };
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

export { SpeciesFilter };
