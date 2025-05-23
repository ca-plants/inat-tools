import pkceChallenge from "pkce-challenge";
import { DB } from "../lib/db.js";
import { Login } from "../lib/login.js";
import { INatAPI } from "../lib/inatapi.js";
import { hdom } from "../lib/hdom.js";

const CLIENT_ID = "96Z8RROGQntitB5Omp-t6ZVS7kU6Z_H5rqRK3F0QVKU";
const OBJECT_STORE = "login";

class LoginUI {
    async authorize() {
        const cv = await pkceChallenge();
        const code_challenge = cv.code_challenge;
        const code_verifier = cv.code_verifier;

        const client_id = hdom.getFormElementValue("client_id");

        // Save client_id and verifier so we can use them later.
        const db = await DB.getInstance("InatLogin", OBJECT_STORE);
        await db.put(OBJECT_STORE, "code_verifier", code_verifier);
        await db.put(OBJECT_STORE, "client_id", client_id);

        // Save URL to return to.
        const queryString = new URLSearchParams(document.location.search);
        const referrer = queryString.get("url");
        await db.put(OBJECT_STORE, "referrer", referrer);

        const loginURL = new URL("https://www.inaturalist.org/oauth/authorize");
        loginURL.searchParams.set("code_challenge_method", "S256");
        loginURL.searchParams.set("response_type", "code");
        loginURL.searchParams.set("client_id", client_id);
        loginURL.searchParams.set(
            "redirect_uri",
            document.location.origin + document.location.pathname,
        );
        loginURL.searchParams.set("code_challenge", code_challenge);
        document.location = loginURL.toString();
    }

    async doLogout() {
        await Login.logout();
        this.returnToSender();
    }

    enableError() {
        hdom.showElement("error-section");
        const url = new URL(document.location.toString());
        hdom.getElement("error-text").appendChild(
            document.createTextNode(
                url.searchParams.get("error_description") ?? "",
            ),
        );
        hdom.addEventListener(
            "error-retry",
            "click",
            async () => await this.authorize(),
        );
        hdom.addEventListener("error-cancel", "click", () =>
            this.returnToSender(),
        );
    }

    enableLogout() {
        hdom.showElement("logout-section");
        hdom.addEventListener(
            "logout-button",
            "click",
            async () => await this.doLogout(),
        );
    }

    static async getInstance() {
        const ui = new LoginUI();
        await ui.init();
    }

    /**
     * @param {string} code
     */
    async getToken(code) {
        async function getAccessToken() {
            // Request access token as per https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
            const loginURL = new URL("https://www.inaturalist.org/oauth/token");

            const data = new URLSearchParams();
            data.set("grant_type", "authorization_code");
            data.set("code", code);
            data.set("redirect_uri", redirect_uri.toString());
            data.set("client_id", client_id);
            data.set("code_verifier", code_verifier);

            /** @type {RequestInit} */
            const headers = {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded; charset=UTF-8",
                },
                body: data,
            };
            const response = await fetch(loginURL, headers);
            return await response.json();
        }

        /**
         * @param {string} access_token
         */
        async function getAPIToken(access_token) {
            const headers = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + access_token,
                },
            };

            const response = await fetch(
                "https://www.inaturalist.org/users/api_token",
                headers,
            );
            return await response.json();
        }

        // Retrieve the saved client_id and verifier.
        const db = await DB.getInstance("InatLogin", OBJECT_STORE);
        const code_verifier = await db.get(OBJECT_STORE, "code_verifier");
        const client_id = await db.get(OBJECT_STORE, "client_id");

        const orig_url = await db.get(OBJECT_STORE, "referrer");
        const redirect_uri = new URL(
            document.location.pathname,
            document.location.origin,
        );
        redirect_uri.searchParams.set("url", orig_url);

        const accessJSON = await getAccessToken();
        const apiJSON = await getAPIToken(accessJSON.access_token);

        // Save the API token.
        await Login.setToken(apiJSON.api_token, new INatAPI(apiJSON.api_token));

        // Remove the code verifier from storage, and redirect back to page where "Login" was clicked.
        await db.delete(OBJECT_STORE, "code_verifier");
        document.location = orig_url;
    }

    async handleLocalLogin() {
        const client_id = hdom.getFormElementValue("client_id");
        if (!client_id) {
            alert("You must enter a client id.");
            return;
        }
        await this.authorize();
    }

    async init() {
        const url = new URL(document.location.toString());
        const code = url.searchParams.get("code");
        if (code) {
            await this.getToken(code);
            return;
        }

        const error = url.searchParams.get("error");
        if (error) {
            this.enableError();
            return;
        }

        const login_name = await Login.getLoginName();
        if (login_name) {
            this.enableLogout();
            return;
        }

        if (document.location.hostname !== "localhost") {
            // Save the client ID to a form element.
            hdom.setFormElementValue("client_id", CLIENT_ID);
            await this.authorize();
            return;
        }

        // Running on localhost. The production client ID won't work, so paste one in.
        hdom.showElement("login-section");
        hdom.addEventListener(
            "login",
            "click",
            async () => await this.handleLocalLogin(),
        );
        hdom.setFocusTo("client_id");
    }

    returnToSender() {
        const url = new URL(document.location.toString());
        const redir = url.searchParams.get("url");
        if (redir) {
            document.location = redir;
        }
    }
}

(async function () {
    await LoginUI.getInstance();
})();
