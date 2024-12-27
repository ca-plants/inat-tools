import { bbox } from "https://cdn.jsdelivr.net/npm/@turf/bbox@7/+esm";
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

/** @type {INatData.QualityGrade[]} */
const ALL_QUALITY_GRADES = ["needs_id", "research"];

class SpeciesFilter {
    /** @type {Params.SpeciesFilter} */
    #params = {};

    /**
     * @param {Params.SpeciesFilter} params
     */
    constructor(params) {
        Object.assign(this.#params, params);
        // If quality grade includes everything, set it to an empty array.
        if (params.quality_grade) {
            if (
                ALL_QUALITY_GRADES.every((g) =>
                    params.quality_grade?.includes(g)
                )
            ) {
                delete this.#params.quality_grade;
            }
        }
    }

    getAnnotations() {
        return this.#params.annotations;
    }

    getBoundary() {
        return this.#params.boundary;
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
        if (this.#params.establishment) {
            descrip += " which are " + this.#params.establishment;
        }
        descrip += " observed";
        if (this.#params.annotations) {
            for (const annotation of this.#params.annotations) {
                switch (annotation.type) {
                    case "ev-mammal":
                        switch (annotation.value) {
                            case "Organism":
                                descrip += " when organism is present";
                                break;
                        }
                        break;
                    case "plants":
                        switch (annotation.value) {
                            case "Flowering":
                                descrip += " when plant has flowers";
                                break;
                            case "Flower Buds":
                                descrip += " when plant has flower buds";
                                break;
                            case "Not Flowering":
                                descrip +=
                                    " when plant has no evidence of flowering";
                                break;
                        }
                        break;
                }
            }
        }
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
        } else if (this.#params.boundary) {
            descrip += " in specified boundary";
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
        if (this.#params.quality_grade) {
            if (this.#params.quality_grade.length > 1) {
                throw new Error(JSON.stringify(this.#params.quality_grade));
            }
            switch (this.#params.quality_grade[0]) {
                case "needs_id":
                    descrip += " (needs ID only)";
                    break;
                case "research":
                    descrip += " (research grade only)";
                    break;
            }
        }
        if (this.#params.accuracy !== undefined) {
            descrip += ` with an accuracy of ${
                this.#params.accuracy
            } meters or less`;
        }
        if (this.#params.obscuration === "taxon") {
            descrip += " where taxon is obscured";
        }

        if (exclusions) {
            descrip += ", excluding " + (await exclusions.getDescription(api));
        }
        return descrip;
    }

    getEstablishment() {
        return this.#params.establishment;
    }

    getMinAccuracy() {
        return this.#params.accuracy;
    }

    getMonths() {
        return { month1: this.#params.month };
    }

    /**
     * @returns {Params.SpeciesFilter}
     */
    getParams() {
        return structuredClone(this.#params);
    }

    getPlaceID() {
        return this.#params.place_id;
    }

    getProjectID() {
        return this.#params.project_id;
    }

    /**
     * @returns {string[]}
     */
    getQualityGrade() {
        return this.#params.quality_grade ?? [];
    }

    getTaxonID() {
        return this.#params.taxon_id;
    }

    /**
     * @param {string|URL} [urlStr]
     */
    getURL(urlStr = "https://www.inaturalist.org/observations?subview=grid") {
        /**
         * @param {URL} url
         * @param {{ type: string; value: string }[]} annotations
         */
        function setAnnotationParameters(url, annotations) {
            if (!annotations) {
                return;
            }
            for (const annotation of annotations) {
                switch (annotation.type) {
                    case "ev-mammal":
                        switch (annotation.value) {
                            case "Organism":
                                url.searchParams.set("term_id", "22");
                                url.searchParams.set("term_value_id", "24");
                                break;
                        }
                        break;
                    case "plants":
                        switch (annotation.value) {
                            case "Flowering":
                                url.searchParams.set("term_id", "12");
                                url.searchParams.set("term_value_id", "13");
                                break;
                            case "Flower Buds":
                                url.searchParams.set("term_id", "12");
                                url.searchParams.set("term_value_id", "15");
                                break;
                            case "Not Flowering":
                                url.searchParams.set("term_id", "12");
                                url.searchParams.set(
                                    "without_term_value_id",
                                    "13"
                                );
                                break;
                        }
                        break;
                }
            }
        }

        const url = new URL(urlStr);
        for (const [k, v] of Object.entries(this.#params)) {
            switch (k) {
                case "accuracy":
                    url.searchParams.set("acc_below_or_unknown", v + 1);
                    break;
                case "annotations":
                    setAnnotationParameters(url, v);
                    break;
                case "boundary":
                    {
                        const bounds = bbox(v);
                        url.searchParams.set("swlng", bounds[0].toString());
                        url.searchParams.set("swlat", bounds[1].toString());
                        url.searchParams.set("nelng", bounds[2].toString());
                        url.searchParams.set("nelat", bounds[3].toString());
                    }
                    break;
                case "establishment":
                    if (v === "native") {
                        url.searchParams.set("native", "true");
                    } else if (v === "introduced") {
                        url.searchParams.set("introduced", "true");
                    }
                    break;
                case "obscuration":
                    switch (v) {
                        case "taxon":
                            url.searchParams.set(
                                "taxon_geoprivacy",
                                "obscured"
                            );
                            break;
                        default:
                            url.searchParams.set(k, v);
                            break;
                    }
                    break;
                case "year1":
                    if (this.#params.month) {
                        // Only specific months are included; use year range list.
                        const years = [];
                        for (
                            let year = v;
                            year <= (this.#params.year2 ?? v);
                            year++
                        ) {
                            years.push(year);
                        }
                        url.searchParams.set("year", years.join());
                    } else {
                        url.searchParams.set(
                            "d1",
                            DateUtils.getDateString(new Date(v, 0, 1))
                        );
                    }
                    break;
                case "year2":
                    if (!this.#params.month) {
                        url.searchParams.set(
                            "d2",
                            DateUtils.getDateString(new Date(v, 11, 31))
                        );
                    }
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
        const qg = this.getQualityGrade();
        return qg.length === 1 && qg[0] === "research";
    }

    toJSON() {
        return this.#params;
    }
}

export { SpeciesFilter };
