import { DB } from "./db.js";

const OBJECT_STORE = "cache";

class Cache {
    /** @type Cache */
    static #instance;

    /** @type {DB} */
    // @ts-ignore
    #db;

    async clear() {
        await this.#db.clear(OBJECT_STORE);
    }

    /**
     * @param {string} key
     */
    async delete(key) {
        await this.#db.delete(OBJECT_STORE, key);
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

    /**
     * @param {string} key
     */
    async get(key, returnAll = false) {
        const result = await this.#db.get(OBJECT_STORE, key);
        return result ? (returnAll ? result : result.value) : undefined;
    }

    async getAllKeys() {
        return await this.#db.getAllKeys(OBJECT_STORE);
    }

    async #initCache() {
        this.#db = await DB.getInstance("InatCache", OBJECT_STORE);
    }

    /**
     * @param {string} key
     * @param {object} data
     */
    async put(key, data) {
        await this.#db.put(OBJECT_STORE, key, {
            date: Date.now(),
            value: data,
        });
    }
}

export { Cache };
