import { Cache } from "./cache.js";
import { Login } from "./login.js";

class QueryCancelledException extends Error {}

class INatAPI {
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

    async changeLogin() {
        // Clear the cache.
        const cache = await Cache.getInstance();
        await cache.clear();
        // Update the token.
        this.#token = await Login.getToken();
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
     * @param {string} str
     * @param {string} type
     * @param {string|function(any):string} nameGen
     * @returns {Promise<Object<string,string>>}
     */
    async #getAutoComplete(str, type, nameGen) {
        const url = new URL(
            "https://api.inaturalist.org/v1/" + type + "/autocomplete"
        );
        url.searchParams.set("q", str);
        const json = await this.getJSON(url);
        /** @type {Object<string,string>} */
        const results = {};
        for (const result of json.results) {
            results[
                typeof nameGen === "string" ? result[nameGen] : nameGen(result)
            ] = result.id;
        }
        return results;
    }

    /**
     * @param {string} str
     */
    async getAutoCompleteObserver(str) {
        return this.#getAutoComplete(str, "users", "login_exact");
    }

    /**
     * @param {string} str
     */
    async getAutoCompletePlace(str) {
        return this.#getAutoComplete(str, "places", "display_name");
    }

    /**
     * @param {string} str
     */
    async getAutoCompleteProject(str) {
        return this.#getAutoComplete(str, "projects", "title");
    }

    /**
     * @param {string} str
     */
    async getAutoCompleteTaxon(str) {
        return this.#getAutoComplete(str, "taxa", this.getTaxonFormName);
    }

    /**
     * @param {string} id
     * @param {string} url
     */
    async #getDataByID(id, url) {
        const cache = await Cache.getInstance();
        const key = url + id;
        // Check cache first.
        let data = await cache.get(key);
        if (data) {
            return data;
        }
        const json = await this.getJSON(new URL(key));
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

        let headers;
        if (token) {
            headers = {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: token,
                },
            };
        }

        await this.delay();
        this.checkForCancel();

        const response = await fetch(url, headers);
        const json = await response.json();
        return json;
    }

    /**
     * @param {string} placeID
     */
    async getPlaceData(placeID) {
        return this.#getDataByID(
            placeID,
            "https://api.inaturalist.org/v1/places/"
        );
    }

    /**
     * @param {string} projID
     */
    async getProjectData(projID) {
        return this.#getDataByID(
            projID,
            "https://api.inaturalist.org/v1/projects/"
        );
    }

    /**
     * @param {string} id
     * @returns {Promise<INatData.TaxonData>}
     */
    async getTaxonData(id) {
        return this.#getDataByID(id, "https://api.inaturalist.org/v1/taxa/");
    }

    /**
     * @param {INatData.TaxonData} taxon
     */
    static getTaxonName(taxon) {
        switch (taxon.rank) {
            case "subspecies":
            case "variety": {
                const parts = taxon.name.split(" ");
                parts.splice(
                    2,
                    0,
                    { subspecies: "subsp.", variety: "var." }[taxon.rank]
                );
                return parts.join(" ");
            }
            default:
                return taxon.name;
        }
    }

    /**
     * @param {INatData.TaxonData} taxon
     * @param {boolean} [addCommonName]
     * @returns {string}
     */
    getTaxonFormName(taxon, addCommonName = true) {
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
     * @returns {Promise<INatData.UserData>}
     */
    async getUserData(id) {
        return this.#getDataByID(id, "https://api.inaturalist.org/v1/users/");
    }
}

export { INatAPI, QueryCancelledException };
