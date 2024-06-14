import { Cache } from "./cache.js";
import { Login } from "./login.js";

class QueryCancelledException extends Error {}

class INatAPI {
    #lastCallTime;
    #cancelQuery = false;
    #token;

    constructor(token) {
        this.#token = token;
    }

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

    async #getAutoComplete(str, type, nameGen) {
        const url = new URL(
            "https://api.inaturalist.org/v1/" + type + "/autocomplete"
        );
        url.searchParams.set("q", str);
        const json = await this.getJSON(url);
        const results = {};
        for (const result of json.results) {
            results[
                typeof nameGen === "string" ? result[nameGen] : nameGen(result)
            ] = result.id;
        }
        return results;
    }

    async getAutoCompleteObserver(str) {
        return this.#getAutoComplete(str, "users", "login_exact");
    }

    async getAutoCompletePlace(str) {
        return this.#getAutoComplete(str, "places", "display_name");
    }

    async getAutoCompleteProject(str) {
        return this.#getAutoComplete(str, "projects", "title");
    }

    async getAutoCompleteTaxon(str) {
        return this.#getAutoComplete(str, "taxa", this.getTaxonFormName);
    }

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

    async getPlaceData(placeID) {
        return this.#getDataByID(
            placeID,
            "https://api.inaturalist.org/v1/places/"
        );
    }

    async getProjectData(projID) {
        return this.#getDataByID(
            projID,
            "https://api.inaturalist.org/v1/projects/"
        );
    }

    /**
     * @param {number} taxonID
     * @returns {Promise<import("../../../types/types.js").TaxonData>}
     */
    async getTaxonData(taxonID) {
        return this.#getDataByID(
            taxonID,
            "https://api.inaturalist.org/v1/taxa/"
        );
    }

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

    async getUserData(id) {
        return this.#getDataByID(id, "https://api.inaturalist.org/v1/users/");
    }
}

export { INatAPI, QueryCancelledException };
