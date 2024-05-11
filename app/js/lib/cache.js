import { DB } from "./db.js";

/** @typedef {{date:Date,expires:Date,value:any}} CacheEntry */

const OBJECT_STORE = "cache";

const SETTINGS = { cacheExpirationMillis: 1000 * 60 * 60 };

class Cache {
    /** @type Cache */
    static #instance;

    /** @type {DB} */
    // @ts-ignore
    #db;

    async clear() {
        await this.#db.clear(OBJECT_STORE);
    }

    async clearExpired() {
        const keys = await this.getAllKeys();

        for (const key of keys) {
            const entry = await this.getEntry(key);
            if (this.isExpired(entry)) {
                this.delete(key);
            }
        }
    }

    /**
     * @param {string} key
     */
    async delete(key) {
        await this.#db.delete(OBJECT_STORE, key);
    }

    /**
     * @param {string} key
     */
    async get(key) {
        const result = await this.getEntry(key);
        return result ? result.value : undefined;
    }

    /**
     * @returns {Promise<string[]>}
     */
    async getAllKeys() {
        return await this.#db.getAllKeys(OBJECT_STORE);
    }

    /**
     * @param {string} key
     * @returns {Promise<CacheEntry>}
     */
    async getEntry(key) {
        return await this.#db.get(OBJECT_STORE, key);
    }

    /**
     * @returns {Promise<Cache>}
     */
    static async getInstance() {
        if (this.#instance === undefined) {
            this.#instance = new Cache();
            await this.#instance.#initCache();
        }
        return this.#instance;
    }

    async #initCache() {
        this.#db = await DB.getInstance("InatCache", OBJECT_STORE);
    }

    /**
     * @param {CacheEntry} entry
     * @returns {boolean}
     */
    isExpired(entry) {
        return entry.expires.valueOf() <= Date.now();
    }

    /**
     * @param {string} key
     * @param {object} data
     */
    async put(key, data) {
        const d = Date.now();
        await this.#db.put(OBJECT_STORE, key, {
            date: d,
            expires: d + SETTINGS.cacheExpirationMillis,
            value: data,
        });
    }
}

export { Cache };
