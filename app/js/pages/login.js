import { SearchUI } from "../lib/searchui.js";
import { Login } from "../lib/login.js";
import { DOMUtils } from "../lib/domutils.js";

class LoginUI extends SearchUI {

    async #changeLogin() {
        await this.#setState();
        await this.setLoginLink();
        await this.getAPI().changeLogin();
    }

    static async getInstance() {
        const ui = new LoginUI();
        await ui.init();
    }

    async init() {
        await super.init();

        const loginForm = document.getElementById( "form" );
        const logoutButton = document.getElementById( "logout" );

        loginForm.addEventListener( "submit", async ( e ) => await this.onSubmit( e ) );
        logoutButton.addEventListener( "click", async ( e ) => await this.logout( e ) );

        await this.#setState();
    }

    async logout() {
        await Login.logout();
        this.#changeLogin();
    }

    async onSubmit( e ) {

        e.preventDefault();

        const token = document.getElementById( "token" ).value;

        await Login.logout();
        await Login.setToken( token, this.getAPI() );

        this.#changeLogin();
    }

    async #setState() {

        const loginForm = document.getElementById( "form" );
        const logoutButton = document.getElementById( "logout" );

        const loginName = await Login.getLoginName();
        if ( loginName ) {
            DOMUtils.showElement( loginForm, false );
            DOMUtils.showElement( logoutButton );
            logoutButton.focus();
        } else {
            DOMUtils.showElement( loginForm );
            DOMUtils.showElement( logoutButton, false );
            document.getElementById( "token" ).focus();
        }

    }
}

await LoginUI.getInstance();