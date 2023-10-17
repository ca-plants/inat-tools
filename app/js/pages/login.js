import pkceChallenge from "https://cdn.jsdelivr.net/npm/pkce-challenge@4.0.1/dist/index.js";
import { DB } from "../lib/db.js";
import { Login } from "../lib/login.js";
import { INatAPI } from "../lib/inatapi.js";
import { DOMUtils } from "../lib/domutils.js";

const CLIENT_ID = "96Z8RROGQntitB5Omp-t6ZVS7kU6Z_H5rqRK3F0QVKU";
const OBJECT_STORE = "login";

class LoginUI {

    async authorize() {

        const cv = await pkceChallenge();
        const code_challenge = cv.code_challenge;
        const code_verifier = cv.code_verifier;

        // Save verifier so we can use it later.
        const db = await DB.getInstance( "InatLogin", OBJECT_STORE );
        await db.put( OBJECT_STORE, "code_verifier", code_verifier );

        const loginURL = new URL( "https://www.inaturalist.org/oauth/authorize" );
        loginURL.searchParams.set( "code_challenge_method", "S256" );
        loginURL.searchParams.set( "response_type", "code" );
        loginURL.searchParams.set( "client_id", CLIENT_ID );
        loginURL.searchParams.set( "redirect_uri", document.location );
        loginURL.searchParams.set( "code_challenge", code_challenge );
        document.location = loginURL;

    }

    async doLogout() {
        await Login.logout();
        this.returnToSender();
    }

    enableError() {
        DOMUtils.showElement( "error-section" );
        const url = new URL( document.location );
        document.getElementById( "error-text" ).appendChild( document.createTextNode( url.searchParams.get( "error_description" ) ) );
        document.getElementById( "error-retry" ).addEventListener( "click", async () => await this.authorize() );
        document.getElementById( "error-cancel" ).addEventListener( "click", () => this.returnToSender() );
    }

    enableLogout() {
        DOMUtils.showElement( "logout-section" );
        document.getElementById( "logout-button" ).addEventListener( "click", async () => await this.doLogout() );
    }

    static async getInstance() {
        const ui = new LoginUI();
        await ui.init();
    }

    async getToken( code ) {

        async function getAccessToken() {

            // Request access token as per https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
            const loginURL = new URL( "https://www.inaturalist.org/oauth/token" );

            const data = new URLSearchParams();
            data.set( "grant_type", "authorization_code" );
            data.set( "code", code );
            data.set( "redirect_uri", redirect_uri );
            data.set( "client_id", CLIENT_ID );
            data.set( "code_verifier", code_verifier );

            const headers = {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                body: data
            };
            const response = await fetch( loginURL, headers );
            return await response.json();

        }

        async function getAPIToken( access_token ) {

            const headers = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + access_token
                },
            };

            const response = await fetch( "https://www.inaturalist.org/users/api_token", headers );
            return await response.json();

        }

        // Retrieve the saved verifier.
        const db = await DB.getInstance( "InatLogin", OBJECT_STORE );
        const code_verifier = await db.get( OBJECT_STORE, "code_verifier" );

        const url = new URL( document.location );
        const orig_url = url.searchParams.get( "url" );
        const redirect_uri = new URL( document.location.pathname, document.location.origin );
        redirect_uri.searchParams.set( "url", orig_url );

        const accessJSON = await getAccessToken();
        const apiJSON = await getAPIToken( accessJSON.access_token );

        // Save the API token.
        await Login.setToken( apiJSON.api_token, new INatAPI() );

        // Remove the code verifier from storage, and redirect back to page where "Login" was clicked.
        await db.delete( OBJECT_STORE, "code_verifier" );
        document.location = orig_url;

    }

    async init() {
        const url = new URL( document.location );
        const code = url.searchParams.get( "code" );
        if ( code ) {
            await this.getToken( code );
            return;
        }

        const error = url.searchParams.get( "error" );
        if ( error ) {
            this.enableError();
            return;
        }

        const login_name = await Login.getLoginName();
        if ( login_name ) {
            this.enableLogout();
        } else {
            await this.authorize();
        }
    }

    returnToSender() {
        const url = new URL( document.location );
        const redir = url.searchParams.get( "url" );
        document.location = redir;
    }

}

await LoginUI.getInstance();