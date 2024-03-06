class DOMUtils {

    /**
     * 
     * @param {string} id 
     * @param {string} className 
     */
    static addClass( id, className ) {
        const e = document.getElementById( id );
        if ( e ) {
            e.classList.add( className );
        }
    }

    /**
     * @param {string|Element} e 
     * @param {string} type 
     * @param {*} fn 
     */
    static addEventListener( e, type, fn ) {
        const elem = this.getElement( e );
        if ( elem ) {
            elem.addEventListener( type, fn );
        }

    }

    /**
     * @param {string} name 
     * @param {Object.<string,string>|string} [attributes] 
     * @returns {Element}
     */
    static createElement( name, attributes ) {
        const e = document.createElement( name );
        switch ( typeof attributes ) {
            case "string":
                // Assume it's a class name.
                e.className = attributes;
                break;
            case "object":
                for ( const [ k, v ] of Object.entries( attributes ) ) {
                    e.setAttribute( k, v );
                }
                break;
        }
        return e;
    }

    /**
     * @param {*} attributes 
     * @returns {HTMLInputElement}
     */
    static createInputElement( attributes ) {
        const e = this.createElement( "input", attributes );
        if ( !( e instanceof HTMLInputElement ) ) {
            throw new Error();
        }
        return e;
    }

    static createLinkElement( url, eLinkText, attributes ) {
        const eLink = this.createElement( "a", attributes );
        eLink.setAttribute( "href", url );
        eLink.appendChild( ( eLinkText instanceof Node ) ? eLinkText : document.createTextNode( eLinkText ) );
        return eLink;
    }

    /**
     * @param {string|Element} e 
     * @param {boolean} state 
     */
    static enableCheckBox( e, state ) {
        const elem = this.getElement( e );
        if ( !( elem instanceof HTMLInputElement ) ) {
            return;
        }
        elem.checked = state;
    }

    /**
     * @param {string|Element} e 
     * @returns {Element|null}
     */
    static getElement( e ) {
        if ( typeof e === "string" ) {
            return document.getElementById( e );
        }
        return e;
    }

    /**
     * @param {string|Element} e 
     * @returns {Element}
     */
    static getRequiredElement( e ) {
        const elem = this.getElement( e );
        if ( !elem ) {
            throw new Error( JSON.stringify( e ) );
        }
        return elem;
    }

    /**
     * @param {string|Element|null} e 
     * @returns {string|undefined}
     */
    static getFormElementValue( e ) {
        if ( typeof e === "string" ) {
            // Assume it's an id.
            return this.getFormElementValue( this.getElement( e ) );
        }
        if ( e instanceof HTMLInputElement || e instanceof HTMLSelectElement ) {
            return e.value;
        }
    }

    static removeChildren( e ) {
        while ( e.firstChild ) {
            e.firstChild.remove();
        }
    }

    static removeClass( e, className ) {
        const elem = this.getElement( e );
        if ( elem ) {
            elem.classList.remove( className );
        }
    }

    static setElementText( id, text ) {
        const elem = this.getElement( id );
        if ( !elem ) {
            return;
        }
        this.removeChildren( elem );
        elem.appendChild( document.createTextNode( text ) );
    }

    /**
     * @param {string|HTMLElement} e 
     */
    static setFocusTo( e ) {
        const elem = this.getElement( e );
        if ( !elem ) {
            console.warn( "element " + e + " not found" );
            return;
        }
        if ( !( elem instanceof HTMLElement ) ) {
            console.warn( e + " is not an HTMLElement" );
            return;
        }
        elem.focus();
    }

    /**
     * @param {string|Element} e 
     * @param {string|undefined} value 
     */
    static setFormElementValue( e, value ) {
        const elem = this.getElement( e );
        if ( !elem ) {
            return;
        }
        elem.setAttribute( "value", value === undefined ? "" : value );
    }

    static showElement( e, show = true ) {
        if ( typeof e === "string" ) {
            // Assume it's an id.
            return this.showElement( document.getElementById( e ), show );
        }
        e.style.display = ( show ? "" : "none" );
    }
}

export { DOMUtils };