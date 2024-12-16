import { Cache } from "./cache.js";
import { DateUtils } from "./dateutils.js";
import { DB } from "./db.js";

const OBJECT_STORE = "login";

class Login {
    /** @type {DB} */
    static #db;

    static async #clearCache() {
        const cache = await Cache.getInstance();
        await cache.clear();
    }

    static async #getDB() {
        if (this.#db === undefined) {
            this.#db = await DB.getInstance("InatLogin", OBJECT_STORE);
        }
        return this.#db;
    }

    /**
     * @returns {Promise<{date:Date,expires:Date,login:string,token:string}|undefined>}
     */
    static async #getInfo() {
        const db = await this.#getDB();
        const info = await db.get(OBJECT_STORE, "login");
        if (info) {
            // Make sure it's not expired.
            if (info.expires.valueOf() <= Date.now()) {
                this.logout();
                return;
            }
            return info;
        }
    }

    /**
     * @returns {Promise<string|undefined>}
     */
    static async getLoginName() {
        const info = await this.#getInfo();
        if (info) {
            return info.login;
        }
    }

    /**
     * @returns {Promise<string|undefined>}
     */
    static async getToken() {
        const info = await this.#getInfo();
        if (info) {
            return info.token;
        }
    }

    static async logout() {
        const db = await this.#getDB();
        await db.clear(OBJECT_STORE);
        await this.#clearCache();
    }

    /**
     * @param {string} token
     * @param {INatAPI} api
     */
    static async setToken(token, api) {
        // Retrieve user info.
        /** @type {{results:Object<string,{}>[]}} */
        const json = await api.getJSON(
            "https://api.inaturalist.org/v1/users/me",
            token
        );

        const db = await this.#getDB();
        const d = Date.now();
        await db.put(OBJECT_STORE, "login", {
            date: d,
            expires: d + DateUtils.MILLIS_PER_DAY,
            login: json.results[0].login,
            token: token,
        });

        await this.#clearCache();
    }
}

export { Login };
