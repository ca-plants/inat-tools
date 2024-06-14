import { Cache } from "./cache.js";
import { QueryCancelledException } from "./inatapi.js";
// eslint-disable-next-line no-unused-vars
import { INatAPI } from "./inatapi.js";
// eslint-disable-next-line no-unused-vars
import { ProgressReporter } from "./progressreporter.js";
// eslint-disable-next-line no-unused-vars
import { SpeciesFilter } from "./speciesfilter.js";

/** @typedef {{id:number,name:string,preferred_common_name:string,rank:string,rank_level:number}} RawTaxon */
/** @typedef {{geoprivacy:string|null,id:string,location:string,observed_on_details:{date:string},place_guess:string,private_location:string,private_place_guess:string,quality_grade:string,taxon:RawTaxon,taxon_geoprivacy:string,user:{id:string,login:string,name:string}}} RawObservation */
/** @typedef {{count:number,taxon:RawTaxon}} TaxonResult */

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
     * @returns {Promise<TaxonResult[]>}
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
     * @returns {Promise<RawObservation[]>}
     */
    static async getObservationData(api, filter, progressReporter) {
        const url = filter.getURL(
            "https://api.inaturalist.org/v1/observations?verifiable=true&per_page=500"
        );
        return await this.#retrievePagedData(
            url,
            "species",
            api,
            progressReporter
        );
    }

    /**
     * @param {INatAPI} api
     * @param {string} id
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

    static removeExclusions(include, exclude) {
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
        progressReporter.setPage(1);

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
                progressReporter.setPage(page);
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
