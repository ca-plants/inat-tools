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

    static getFormElementValue( e ) {
        if ( typeof e === "string" ) {
            // Assume it's an id.
            return this.getFormElementValue( document.getElementById( e ) );
        }
        if ( !e ) {
            return;
        }
        return e.value;
    }

    static removeChildren( e ) {
        while ( e.firstChild ) {
            e.firstChild.remove();
        }
    }

    static removeClass( id, className ) {
        const e = document.getElementById( id );
        e.classList.remove( className );
    }

    static setElementText( id, text ) {
        const e = document.getElementById( id );
        this.removeChildren( e );
        e.appendChild( document.createTextNode( text ) );
    }

    static setFormElementValue( e, value ) {
        if ( typeof e === "string" ) {
            // Assume it's an id.
            return this.setFormElementValue( document.getElementById( e ), value );
        }
        if ( !e ) {
            return;
        }
        e.value = ( value === undefined ? "" : value );
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