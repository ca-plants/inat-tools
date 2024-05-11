class DB {
    #db;

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
            request.onsuccess = () => {
                resolve();
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

    static async getInstance(dbName, store) {
        const db = new DB();
        db.#db = await this.#init(dbName, store);
        return db;
    }

    static async #init(dbName, store) {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbName);
            request.onerror = (event) => {
                console.error(event);
                reject(event);
            };
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onupgradeneeded = (event) => {
                event.target.result.createObjectStore(store);
            };
        });
    }

    async put(store, key, data) {
        const transaction = this.#db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        return new Promise((resolve, reject) => {
            const request = objectStore.put(data, key);
            request.onerror = (event) => {
                reject(event);
            };
            request.onsuccess = () => {
                resolve();
            };
        });
    }
}

export { DB };
