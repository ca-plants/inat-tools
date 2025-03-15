import { Cache } from "./cache.js";

export const TAXON_FIELDS =
    "(id:!t,parent_id:!t,name:!t,preferred_common_name:!t,rank:!t,rank_level:!t,ancestor_ids:!t)";

const URL_AC_PLACE = new URL(
    "https://api.inaturalist.org/v2/places?fields=(id:!t,display_name:!t)",
);
const URL_AC_PROJECT = new URL(
    "https://api.inaturalist.org/v2/projects?fields=(id:!t,title:!t)",
);
const URL_AC_TAXA = new URL(
    "https://api.inaturalist.org/v2/taxa/autocomplete?fields=(id:!t,name:!t,preferred_common_name:!t,rank:!t,rank_level:!t)",
);
const URL_AC_USERS = new URL(
    "https://api.inaturalist.org/v2/users/autocomplete?fields=(id:!t,login:!t)",
);

export class QueryCancelledException extends Error {}

export class INatAPI {
    /** @type {number|undefined} */
    #lastCallTime;
    #cancelQuery = false;
    #token;

    /**
     * @param {string} [token]
     */
    constructor(token) {
        this.#token = token;
    }

    /**
     * @param {boolean} yn
     */
    cancelQuery(yn) {
        this.#cancelQuery = yn === true;
    }

    checkForCancel() {
        if (this.#cancelQuery) {
            this.#cancelQuery = false;
            throw new QueryCancelledException();
        }
    }

    async delay() {
        // Limit API calls to 1 per second.

        /**
         * @param {number} ms
         */
        async function sleep(ms) {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        }

        this.checkForCancel();
        const time = Date.now();
        if (this.#lastCallTime) {
            const delay = 1000 - (time - this.#lastCallTime);
            if (delay > 0) {
                await sleep(delay);
            }
        }
        this.#lastCallTime = time;
    }

    /**
     * @template T
     * @param {T[]} raw
     * @param {function(T):string} fnGetDisplayName
     * @param {function(T):number} fnGetDisplayID
     * @returns {Promise<Object<string,number>>}
     */
    async #getAutoCompleteProcessed(raw, fnGetDisplayName, fnGetDisplayID) {
        /** @type {Object<string,number>} */
        const processed = {};
        return raw.reduce((processed, raw) => {
            processed[fnGetDisplayName(raw)] = fnGetDisplayID(raw);
            return processed;
        }, processed);
    }

    /**
     * @template T
     * @param {URL} url
     * @param {string} str
     * @returns {Promise<T[]>}
     */
    async #getAutoCompleteRaw(url, str) {
        url.searchParams.set("q", str);
        /** @type {{results:T[]}} */
        const json = await this.getJSON(url);
        return json.results;
    }

    /**
     * @param {string} str
     * @returns {Promise<Object<string,number>>}
     */
    async getAutoCompleteObserver(str) {
        /** @type {{id:number,login:string}[]} */
        const raw = await this.#getAutoCompleteRaw(URL_AC_USERS, str);
        return this.#getAutoCompleteProcessed(
            raw,
            (r) => r.login,
            (r) => r.id,
        );
    }

    /**
     * @param {string} str
     * @returns {Promise<Object<string,number>>}
     */
    async getAutoCompletePlace(str) {
        /** @type {{id:number,display_name:string}[]} */
        const raw = await this.#getAutoCompleteRaw(URL_AC_PLACE, str);
        return this.#getAutoCompleteProcessed(
            raw,
            (r) => r.display_name,
            (r) => r.id,
        );
    }

    /**
     * @param {string} str
     * @returns {Promise<Object<string,number>>}
     */
    async getAutoCompleteProject(str) {
        /** @type {{id:number,title:string}[]} */
        const raw = await this.#getAutoCompleteRaw(URL_AC_PROJECT, str);
        return this.#getAutoCompleteProcessed(
            raw,
            (r) => r.title,
            (r) => r.id,
        );
    }

    /**
     * @param {string} str
     * @returns {Promise<Object<string,number>>}
     */
    async getAutoCompleteTaxon(str) {
        /** @type {{id:number,name:string,preferred_common_name:string,rank:string,rank_level:number}[]} */
        const raw = await this.#getAutoCompleteRaw(URL_AC_TAXA, str);
        return this.#getAutoCompleteProcessed(
            raw,
            (r) => INatAPI.getTaxonFormName(r),
            (r) => r.id,
        );
    }

    /**
     * @param {string} id
     * @param {string} url
     * @param {string} fields
     */
    async #getDataByID(id, url, fields) {
        const cache = await Cache.getInstance();
        const key = `https://api.inaturalist.org/v2/${url}/${id}?fields=${fields}`;
        // Check cache first.
        let data = await cache.get(key);
        if (data) {
            return data;
        }
        const json = await this.getJSON(key);
        data = json.results[0];
        // Add to cache.
        await cache.put(key, data);
        return data;
    }

    /**
     * @param {URL|string} url
     * @param {string} [token]
     */
    async getJSON(url, token) {
        if (!token) {
            token = this.#token;
        }

        let headers = new Headers();
        if (token) {
            headers.append("Content-Type", "application/json");
            headers.append("Accept", "application/json");
            headers.append("Authorization", token);
        }

        await this.delay();
        this.checkForCancel();

        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            headers: headers,
        });
        return await response.json();
    }

    /**
     * @param {string} placeID
     * @returns {Promise<import("../types.js").INatDataPlace>}
     */
    async getPlaceData(placeID) {
        return this.#getDataByID(placeID, "places", "(display_name:!t)");
    }

    /**
     * @param {string} projID
     * @returns {Promise<import("../types.js").INatDataProject>}
     */
    async getProjectData(projID) {
        return this.#getDataByID(
            projID,
            "projects",
            "(id:!t,title:!t,slug:!t,user_ids:!t)",
        );
    }

    /**
     * @param {string} id
     * @returns {Promise<import("../types.js").INatDataTaxon>}
     */
    async getTaxonData(id) {
        return this.#getDataByID(id, "taxa", TAXON_FIELDS);
    }

    /**
     * @param {{name:string,rank:string}} taxon
     * @returns {string}
     */
    static getTaxonName(taxon) {
        switch (taxon.rank) {
            case "subspecies":
            case "variety": {
                const parts = taxon.name.split(" ");
                parts.splice(
                    2,
                    0,
                    { subspecies: "subsp.", variety: "var." }[taxon.rank],
                );
                return parts.join(" ");
            }
            default:
                return taxon.name;
        }
    }

    /**
     * @param {{name:string,preferred_common_name:string,rank:string,rank_level:number}} taxon
     * @param {boolean} [addCommonName]
     * @returns {string}
     */
    static getTaxonFormName(taxon, addCommonName = true) {
        let commonName = addCommonName
            ? taxon["preferred_common_name"]
            : undefined;
        commonName = commonName ? " (" + commonName + ")" : "";
        if (taxon.rank_level > 10) {
            const rank = taxon["rank"];
            return (
                rank[0].toUpperCase() +
                rank.substring(1) +
                " " +
                taxon["name"] +
                commonName
            );
        }
        return INatAPI.getTaxonName(taxon) + commonName;
    }

    /**
     * @param {string} id
     * @returns {Promise<import("../types.js").INatDataUser>}
     */
    async getUserData(id) {
        return this.#getDataByID(id, "users", "(id:!t,login:!t,name:!t)");
    }
}
