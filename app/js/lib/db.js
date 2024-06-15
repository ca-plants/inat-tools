class DB {
    #db;

    /**
     * @param {IDBDatabase} db
     */
    constructor(db) {
        this.#db = db;
    }

    /**
     * @param {string} store
     */
    async clear(store) {
        const transaction = this.#db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.clear();
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = (event) => {
                resolve(event);
            };
        });
    }

    /**
     * @param {string} store
     * @param {string} key
     */
    async delete(store, key) {
        const transaction = this.#db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.delete(key);
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    /**
     * @param {string} store
     * @param {string} key
     */
    async get(store, key) {
        const transaction = this.#db.transaction(store);
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.get(key);
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    /**
     * @param {string} store
     */
    async getAllKeys(store) {
        const transaction = this.#db.transaction(store);
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.getAllKeys();
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    /**
     * @param {string} dbName
     * @param {string} store
     */
    static async getInstance(dbName, store) {
        const idb = await this.#init(dbName, store);
        return new DB(idb);
    }

    /**
     * @param {string} dbName
     * @param {string} store
     */
    static async #init(dbName, store) {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbName);
            request.onerror = (event) => {
                console.error(event);
                reject(event);
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onupgradeneeded = () => {
                request.result.createObjectStore(store);
            };
        });
    }

    /**
     * @param {string} store
     * @param {string} key
     * @param {*} data
     */
    async put(store, key, data) {
        const transaction = this.#db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.put(data, key);
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = (event) => {
                resolve(event);
            };
        });
    }
}

export { DB };
