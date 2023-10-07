import { DB } from "./db.js";

const OBJECT_STORE = "login";

class Login extends DB {

    static #db;

    static async #getDB() {
        if ( this.#db === undefined ) {
            this.#db = await DB.getInstance( "InatLogin", OBJECT_STORE );
        }
        return this.#db;
    }

    static async getLoginName() {
        const db = await this.#getDB();
        return await db.get( OBJECT_STORE, "login" );
    }

    static async getToken() {
        const db = await this.#getDB();
        return await db.get( OBJECT_STORE, "token" );
    }

    static async logout() {
        const db = await this.#getDB();
        await db.clear( OBJECT_STORE );
    }

    static async setToken( token, api ) {

        // Retrieve user info.
        const json = await api.getJSON( "https://api.inaturalist.org/v1/users/me", token );

        const db = await this.#getDB();
        await db.put( OBJECT_STORE, "login", json.results[ 0 ].login );
        await db.put( OBJECT_STORE, "token", token );
    }

}

export { Login };