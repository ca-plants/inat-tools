import { Cache } from "../lib/cache.js";
import { DOMUtils } from "../lib/domutils.js";

class CacheUI {

    async copyValue( e, key ) {
        e.preventDefault();
        const cache = await Cache.getInstance();
        const value = await cache.get( key );
        await navigator.clipboard.writeText( JSON.stringify( value ) );
    }
    static async init() {
        const ui = new CacheUI();
        await ui.showCache();
    }

    async showCache() {

        function formatDateTime( d ) {
            d = new Date( d );
            const sep = String.fromCharCode( 8209 );
            const dStr = d.getFullYear().toString() + sep + ( d.getMonth() + 100 ).toString().substring( 1 ) + sep
                + ( d.getDate() + 100 ).toString().substring( 1 );
            return dStr + " " + d.toTimeString().substring( 0, 8 );
        }

        async function getRow( key, ui ) {

            function getCol( value, atts ) {
                const td = DOMUtils.createElement( "td", atts );
                if ( value instanceof Node ) {
                    td.appendChild( value );
                } else {
                    td.appendChild( document.createTextNode( value ) );
                }
                tr.appendChild( td );
            }

            const tr = DOMUtils.createElement( "tr" );

            const data = await cache.get( key, true );
            const url = new URL( key );
            getCol( url.pathname, { class: "overflow", "title": key } );
            getCol( formatDateTime( data.date ), { style: "width:1px;" } );

            const copy = DOMUtils.createLinkElement( "", "Copy" );
            copy.addEventListener( "click", async ( e ) => { await ui.copyValue( e, key ); } );
            getCol( copy );

            return tr;
        }

        const table = DOMUtils.createElement( "table", { "style": "max-width:100%;" } );

        const thead = DOMUtils.createElement( "thead" );
        table.appendChild( thead );
        const tr = DOMUtils.createElement( "tr" );
        thead.appendChild( tr );
        for ( const col of [ "Key", "Cached" ] ) {
            const th = DOMUtils.createElement( "th" );
            tr.appendChild( th );
            th.appendChild( document.createTextNode( col ) );
        }

        const tbody = DOMUtils.createElement( "tbody" );
        table.appendChild( tbody );

        const cache = await Cache.getInstance();
        const keys = await cache.getAllKeys();

        for ( const key of keys ) {
            tbody.appendChild( await getRow( key, this ) );
        }

        document.getElementById( "results" ).appendChild( table );

    }

}

await CacheUI.init();