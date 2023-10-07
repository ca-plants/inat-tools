import { DOMUtils } from "./domutils.js";
import { INatAPI } from "./inatapi.js";
import { Login } from "./login.js";

class ProgressReporter {

    #api;

    constructor( api ) {
        this.#api = api;
    }

    hide() {
        DOMUtils.showElement( "progress", false );
        this.#api.cancelQuery( false );
    }

    async modalAlert( msg ) {
        alert( msg );
    }

    setLabel( label ) {
        DOMUtils.setElementText( "prog-label", label );
    }

    setNumPages( numPages ) {
        DOMUtils.showElement( "prog-page-of", numPages !== 0 );
        DOMUtils.setElementText( "prog-page-max", numPages );
    }

    setPage( page ) {
        DOMUtils.setElementText( "prog-page", page );
    }

    show() {
        DOMUtils.showElement( "progress", true );
    }

}
class UI {

    #api;

    getAPI() {
        return this.#api;
    }

    static async getInstance() {
        const ui = new UI();
        await ui.init();
        return ui;
    }

    getPathPrefix() {
        const homeURL = document.getElementById( "homelink" ).href;
        return new URL( homeURL ).pathname;
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
        const eLogin = document.getElementById( "nav-login" );
        DOMUtils.removeChildren( eLogin );
        eLogin.appendChild( DOMUtils.createLinkElement( this.getPathPrefix() + "login.html", linkText ) );
    }

}

export { UI };