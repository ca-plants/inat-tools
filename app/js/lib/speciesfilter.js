import { bbox } from "@turf/bbox";
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

/** @type {import("../types.js").INatDataQualityGrade[]} */
const ALL_QUALITY_GRADES = ["needs_id", "research"];

export class SpeciesFilter {
    /** @type {import("../types.js").ParamsSpeciesFilter} */
    #params = {};

    /**
     * @param {import("../types.js").ParamsSpeciesFilter} params
     */
    constructor(params) {
        Object.assign(this.#params, params);
        // If quality grade includes everything, set it to an empty array.
        if (params.quality_grade) {
            if (
                ALL_QUALITY_GRADES.every((g) =>
                    params.quality_grade?.includes(g),
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
     * @param {import("../types.js").INatAPI} api
     * @param {SpeciesFilter} [comparisonFilter]
     * @param {import("../types.js").EnumCompareType} [compareType]
     */
    async getDescription(api, comparisonFilter, compareType) {
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
            if (typeof this.#params.month === "number") {
                descrip += " in " + MONTH_NAMES[this.#params.month - 1];
            } else {
                descrip += ` in ${
                    MONTH_NAMES[this.#params.month[0] - 1]
                } through ${
                    MONTH_NAMES[
                        this.#params.month[this.#params.month.length - 1] - 1
                    ]
                }`;
            }
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

        if (comparisonFilter) {
            descrip += ", excluding ";
            if (compareType === "subtract") {
                descrip +=
                    " species with a different number of observations in ";
            }
            descrip += await comparisonFilter.getDescription(api);
        }
        return descrip;
    }

    getEstablishment() {
        return this.#params.establishment;
    }

    getMinAccuracy() {
        return this.#params.accuracy;
    }

    getMonth() {
        return this.#params.month;
    }

    /**
     * @returns {import("../types.js").ParamsSpeciesFilter}
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
         * @param {"place_id"|'project_id'|"taxon_id"|"user_id"} name
         */
        function addString(name) {
            if (params[name] !== undefined) {
                url.searchParams.set(name, params[name]);
            }
        }

        /**
         * @param {{ type: string; value: string }[]} annotations
         */
        function setAnnotationParameters(annotations) {
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
                                    "13",
                                );
                                break;
                        }
                        break;
                }
            }
        }

        const params = this.#params;
        const url = new URL(urlStr);
        if (this.#params.accuracy !== undefined) {
            url.searchParams.set(
                "acc_below_or_unknown",
                String(this.#params.accuracy + 1),
            );
        }
        if (this.#params.annotations !== undefined) {
            setAnnotationParameters(this.#params.annotations);
        }
        if (this.#params.boundary !== undefined) {
            const bounds = bbox(this.#params.boundary);
            url.searchParams.set("swlng", bounds[0].toString());
            url.searchParams.set("swlat", bounds[1].toString());
            url.searchParams.set("nelng", bounds[2].toString());
            url.searchParams.set("nelat", bounds[3].toString());
        }
        switch (this.#params.establishment) {
            case "native":
                url.searchParams.set("native", "true");
                break;
            case "introduced":
                url.searchParams.set("introduced", "true");
                break;
        }
        if (this.#params.month !== undefined) {
            const m = this.#params.month;
            url.searchParams.set(
                "month",
                typeof m === "number" ? m.toString() : m.join(","),
            );
        }
        switch (this.#params.obscuration) {
            case "taxon":
                url.searchParams.set("taxon_geoprivacy", "obscured");
                break;
            case "none":
            case "obscured":
            case "private":
                url.searchParams.set("obscuration", this.#params.obscuration);
                break;
        }

        addString("place_id");
        addString("project_id");

        if (params.quality_grade !== undefined) {
            url.searchParams.set(
                "quality_grade",
                params.quality_grade.join(","),
            );
        }

        addString("taxon_id");
        addString("user_id");

        if (params.year1 !== undefined) {
            url.searchParams.set(
                "d1",
                DateUtils.getDateString(new Date(params.year1, 0, 1)),
            );
        }
        if (this.#params.year2 !== undefined) {
            url.searchParams.set(
                "d2",
                DateUtils.getDateString(new Date(this.#params.year2, 11, 31)),
            );
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
