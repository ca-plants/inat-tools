import whichPolygon from "https://cdn.jsdelivr.net/npm/which-polygon@2.2.1/+esm";
import { Cache } from "./cache.js";
import { QueryCancelledException } from "./inatapi.js";
import { INatObservation } from "./inatobservation.js";

const INPROP = {
    COMMON_NAME: "preferred_common_name",
    PAGE: "page",
    PER_PAGE: "per_page",
    RESULTS: "results",
    TOTAL_RESULTS: "total_results",
};

class DataRetriever {
    /**
     * @param {INatAPI} api
     * @param {SpeciesFilter} filtInclude
     * @param {SpeciesFilter|undefined} filtExclude
     * @param {ProgressReporter} progressReporter
     * @returns {Promise<INatData.TaxonObsSummary[]>}
     */
    static async getSpeciesData(
        api,
        filtInclude,
        filtExclude,
        progressReporter
    ) {
        const include = await this.#retrieveSpeciesData(
            "species",
            api,
            filtInclude,
            progressReporter
        );
        if (!filtExclude) {
            return include;
        }

        // Record excluded taxa.
        const exclude = await this.#retrieveSpeciesData(
            "exclusions",
            api,
            filtExclude,
            progressReporter
        );

        return this.removeExclusions(include, exclude);
    }

    /**
     * @param {INatAPI} api
     * @param {SpeciesFilter} filter
     * @param {ProgressReporter} progressReporter
     * @returns {Promise<INatData.Observation[]>}
     */
    static async getObservationData(api, filter, progressReporter) {
        const url = filter.getURL(
            "https://api.inaturalist.org/v1/observations?verifiable=true&per_page=500"
        );
        /** @type {INatData.Observation[]} */
        const rawResults = await this.#retrievePagedData(
            url,
            "species",
            api,
            progressReporter
        );
        const boundary = filter.getBoundary();
        if (!boundary) {
            return rawResults;
        }

        const query = whichPolygon(boundary);
        /** @type {INatData.Observation[]} */
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
     * @param {INatAPI} api
     * @param {string} id
     * @param {ProgressReporter} progressReporter
     */
    static async getProjectMembers(api, id, progressReporter) {
        const url = new URL(
            "https://api.inaturalist.org/v1/projects/" + id + "/members"
        );
        return await this.#retrievePagedData(
            url,
            "project members",
            api,
            progressReporter
        );
    }

    /**
     * @param {INatData.TaxonObsSummary[]} include
     * @param {INatData.TaxonObsSummary[]} exclude
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
     * @param {INatAPI} api
     * @param {ProgressReporter} progressReporter
     */
    static async #retrievePagedData(baseURL, label, api, progressReporter) {
        /**
         * @param {number} pageNum
         */
        async function getPage(pageNum) {
            baseURL.searchParams.set(INPROP.PAGE, pageNum.toString());
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
            const totalResults = json[INPROP.TOTAL_RESULTS];

            if (totalResults > maxResults) {
                await progressReporter.modalAlert(
                    totalResults + " results found, maximum is " + maxResults
                );
                return;
            }

            const perPage = json[INPROP.PER_PAGE];
            const numPages = Math.ceil(totalResults / perPage);

            if (numPages > maxPages) {
                await progressReporter.modalAlert(
                    numPages + " pages found, maximum is " + maxPages
                );
                return;
            }

            results = json[INPROP.RESULTS];

            progressReporter.setNumPages(numPages);

            for (let page = 2; page <= numPages; page++) {
                progressReporter.setPage(page.toString());
                const json = await getPage(page);
                results.push(...json[INPROP.RESULTS]);
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
     * @param {INatAPI} api
     * @param {SpeciesFilter} filter
     * @param {ProgressReporter} progressReporter
     */
    static async #retrieveSpeciesData(label, api, filter, progressReporter) {
        // Include verifiable=true; this seems to be consistent with iNat web UI default.
        const url = filter.getURL(
            "https://api.inaturalist.org/v1/observations/species_counts?verifiable=true"
        );
        return await this.#retrievePagedData(url, label, api, progressReporter);
    }
}

export { DataRetriever, INPROP };
