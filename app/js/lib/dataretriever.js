import whichPolygon from "which-polygon";
import { Cache } from "./cache.js";
import { QueryCancelledException, TAXON_FIELDS } from "./inatapi.js";
import { INatObservation } from "./inatobservation.js";

export class DataRetriever {
    /**
     * @param {import("../types.js").INatAPI} api
     * @param {import("../types.js").SpeciesFilter} filtInclude
     * @param {import("../types.js").SpeciesFilter|undefined} filtCompare
     * @param {import("../types.js").EnumCompareType|undefined} compareType
     * @param {import("../types.js").ProgressReporter} progressReporter
     * @returns {Promise<import("../types.js").INatDataTaxonObsSummary[]>}
     */
    static async getSpeciesData(
        api,
        filtInclude,
        filtCompare,
        compareType,
        progressReporter,
    ) {
        const include = await this.#retrieveSpeciesData(
            "species",
            api,
            filtInclude,
            progressReporter,
        );
        if (!filtCompare) {
            return include;
        }

        // Record comparison taxa.
        const compare = await this.#retrieveSpeciesData(
            "comparison species",
            api,
            filtCompare,
            progressReporter,
        );

        if (compareType === "exclude") {
            return this.removeExclusions(include, compare);
        }

        return this.subtract(include, compare);
    }

    /**
     * @param {import("../types.js").INatAPI} api
     * @param {import("../types.js").SpeciesFilter} filter
     * @param {import("../types.js").ProgressReporter} progressReporter
     * @returns {Promise<import("../types.js").INatDataObs[]>}
     */
    static async getObservationData(api, filter, progressReporter) {
        const url = filter.getURL(
            "https://api.inaturalist.org/v2/observations?verifiable=true&order_by=observed_on&per_page=500&" +
                `fields=(geoprivacy:!t,id:!t,location:!t,observed_on_details:!t,place_guess:!t,private_location:!t,private_place_guess:!t,quality_grade:!t,taxon:${TAXON_FIELDS},taxon_geoprivacy:!t,user:(id:!t,login:!t,name:!t))`,
        );
        /** @type {import("../types.js").INatDataObs[]} */
        const rawResults = await this.#retrievePagedData(
            url,
            "species",
            api,
            progressReporter,
        );
        const boundary = filter.getBoundary();
        if (!boundary) {
            return rawResults;
        }

        const query = whichPolygon(boundary);
        /** @type {import("../types.js").INatDataObs[]} */
        const filteredResults = [];
        for (const result of rawResults) {
            const obs = new INatObservation(result);
            if (query(obs.getCoordinatesGeoJSON())) {
                filteredResults.push(result);
            }
        }
        return filteredResults;
    }

    /**
     * @param {import("../types.js").INatAPI} api
     * @param {number|string} id
     * @param {import("../types.js").ProgressReporter} progressReporter
     * @returns {Promise<import("../types.js").INatDataProjectMember[]>}
     */
    static async getProjectMembers(api, id, progressReporter) {
        const url = new URL(
            "https://api.inaturalist.org/v2/projects/" +
                id +
                "/members?fields=(user_id:!t,role:!t,observations_count:!t,user:(login:!t,name:!t))",
        );
        return await this.#retrievePagedData(
            url,
            "project members",
            api,
            progressReporter,
        );
    }

    /**
     * @param {import("../types.js").INatDataTaxonObsSummary[]} include
     * @param {import("../types.js").INatDataTaxonObsSummary[]} exclude
     * @return {import("../types.js").INatDataTaxonObsSummary[]}
     */
    static removeExclusions(include, exclude) {
        /** @type {Object<string,boolean>} */
        const exclusions = {};
        for (const result of exclude) {
            // Walk backwards through ancestors to exclude this taxon and all of its parents.
            const ancestors = result.taxon.ancestor_ids;
            for (let index = ancestors.length - 1; index >= 0; index--) {
                const id = ancestors[index];
                if (exclusions[id]) {
                    break;
                }
                exclusions[id] = true;
            }
        }

        // Remove excluded taxa from result set.
        const results = [];
        for (const result of include) {
            if (!exclusions[result.taxon.id]) {
                results.push(result);
            }
        }
        return results;
    }

    /**
     * @param {URL} baseURL
     * @param {string} label
     * @param {import("../types.js").INatAPI} api
     * @param {import("../types.js").ProgressReporter} progressReporter
     */
    static async #retrievePagedData(baseURL, label, api, progressReporter) {
        /**
         * @param {number} pageNum
         */
        async function getPage(pageNum) {
            baseURL.searchParams.set("page", pageNum.toString());
            return await api.getJSON(baseURL);
        }

        const key = baseURL.toString();
        const cache = await Cache.getInstance();
        let results = await cache.get(key);
        if (results) {
            return results;
        }

        progressReporter.setLabel(label);
        progressReporter.setNumPages(0);
        progressReporter.setPage("1");

        const maxResults = 10000;
        const maxPages = 50;

        try {
            progressReporter.show();

            const json = await getPage(1);
            const totalResults = json["total_results"];

            if (totalResults > maxResults) {
                await progressReporter.modalAlert(
                    totalResults + " results found, maximum is " + maxResults,
                );
                return;
            }

            const perPage = json["per_page"];
            const numPages = Math.ceil(totalResults / perPage);

            if (numPages > maxPages) {
                await progressReporter.modalAlert(
                    `${numPages} pages found for ${label}, maximum is ${maxPages}`,
                );
                return;
            }

            results = json["results"];

            progressReporter.setNumPages(numPages);

            for (let page = 2; page <= numPages; page++) {
                progressReporter.setPage(page.toString());
                const json = await getPage(page);
                results.push(...json["results"]);
            }

            await cache.put(key, results);

            return results;
        } catch (error) {
            if (error instanceof QueryCancelledException) {
                return;
            }
            throw error;
        } finally {
            progressReporter.hide();
        }
    }

    /**
     * @param {string} label
     * @param {import("../types.js").INatAPI} api
     * @param {import("../types.js").SpeciesFilter} filter
     * @param {import("../types.js").ProgressReporter} progressReporter
     * @returns {Promise<import("../types.js").INatDataTaxonObsSummary[]>}
     */
    static async #retrieveSpeciesData(label, api, filter, progressReporter) {
        // Include verifiable=true; this seems to be consistent with iNat web UI default.
        const url = filter.getURL(
            `https://api.inaturalist.org/v2/observations/species_counts?verifiable=true&fields=(taxon:${TAXON_FIELDS},count:!t)`,
        );
        return await this.#retrievePagedData(url, label, api, progressReporter);
    }

    /**
     * @param {import("../types.js").INatDataTaxonObsSummary[]} include
     * @param {import("../types.js").INatDataTaxonObsSummary[]} compare
     * @return {import("../types.js").INatDataTaxonObsSummary[]}
     */
    static subtract(include, compare) {
        // Index the comparison set.
        /** @type {Map<string,import("../types.js").INatDataTaxonObsSummary>} */
        const compareIndex = new Map();
        for (const result of compare) {
            compareIndex.set(result.taxon.name, result);
        }

        // Remove excluded taxa from result set.
        const results = [];
        for (const result of include) {
            const name = result.taxon.name;
            const compareCount = compareIndex.get(name)?.count;
            result.diff = result.count - (compareCount ?? 0);
            results.push(result);
        }
        return results;
    }
}
