import { DB } from "./db.js";

const OBJECT_STORE = "cache";

class Cache {

    static #instance;

    #db;

    async clear() {
        await this.#db.clear( OBJECT_STORE );
    }

    static async getInstance() {
        if ( this.#instance === undefined ) {
            this.#instance = new Cache();
            await this.#instance.#initCache();
        }
        return this.#instance;
    }

    async #initCache() {
        this.#db = await DB.getInstance( "InatCache", OBJECT_STORE );
    }

    async get( key, returnAll = false ) {
        const result = await this.#db.get( OBJECT_STORE, key );
        return result ? ( returnAll ? result : result.value ) : undefined;
    }

    async getAllKeys() {
        return await this.#db.getAllKeys( OBJECT_STORE );
    }

    async put( key, data ) {
        await this.#db.put( OBJECT_STORE, key, { date: Date.now(), value: data } );
    }

}

export { Cache };