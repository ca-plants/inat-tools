import { ProgressReporter } from "./progressreporter.js";
import { DOMUtils } from "./domutils.js";
import { INatAPI } from "./inatapi.js";
import { Login } from "./login.js";

const NAV_LOGIN_ID = "nav-login";

class UI {

    /** @type INatAPI */
    #api;

    getAPI() {
        return this.#api;
    }

    static async getInstance() {
        const ui = new UI();
        await ui.init();
    }

    getPathPrefix() {
        const homeLink = document.getElementById( "homelink" );
        if ( !homeLink ) {
            return "";
        }
        return new URL( homeLink[ "href" ] ).pathname;
    }

    getProgressReporter() {
        return new ProgressReporter( this.getAPI() );
    }

    async init() {
        this.#api = new INatAPI( await Login.getToken() );
        await this.setLoginLink();
    }

    async setLoginLink() {
        const loginName = await Login.getLoginName();
        const linkText = loginName ? loginName : "Login";
        const eLogin = document.getElementById( NAV_LOGIN_ID );
        if ( !eLogin ) {
            console.error( NAV_LOGIN_ID + " not found" );
            return;
        }
        eLogin.appendChild( document.createTextNode( linkText ) );
        DOMUtils.addEventListener( eLogin, "click", () => { this.updateLoginTarget(); } );
    }

    updateLoginTarget() {
        const url = new URL( this.getPathPrefix() + "login.html", document.location.origin );
        url.searchParams.set( "url", document.location );
        const eLogin = document.getElementById( NAV_LOGIN_ID );
        eLogin.setAttribute( "href", url );
    }

}

export { UI };