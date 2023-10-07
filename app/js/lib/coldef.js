import { DOMUtils } from "./domutils.js";

class ColDef {

    #th;
    #fnValue;
    #className;

    constructor( th, fnValue, className ) {
        this.#th = th;
        this.#fnValue = fnValue;
        this.#className = className;
    }

    static addColElement( tr, content, className ) {
        const td = DOMUtils.createElement( "td", className );
        if ( content instanceof Node ) {
            td.appendChild( content );
        } else {
            td.appendChild( document.createTextNode( content ) );
        }
        tr.appendChild( td );
    }

    static createTable( cols ) {
        const table = DOMUtils.createElement( "table" );

        const thead = DOMUtils.createElement( "thead" );
        table.appendChild( thead );
        const tr = DOMUtils.createElement( "tr" );
        thead.appendChild( tr );
        for ( const col of cols ) {
            const th = DOMUtils.createElement( "th", { class: col.getClass() } );
            tr.appendChild( th );
            th.appendChild( document.createTextNode( col.getHeaderLabel() ) );
        }

        return table;

    }

    getClass() {
        return this.#className;
    }

    getHeaderLabel() {
        return this.#th;
    }

    getValue( entry, ui ) {
        return this.#fnValue( entry, ui );
    }

}

export { ColDef };