import { DateUtils } from "./dateutils.js";
import { DOMUtils } from "./domutils.js";
import { FP, SpeciesFilter } from "./speciesfilter.js";
import { UI } from "./ui.js";

class AutoCompleteConfig {

    #listID;
    #valueID;
    #fnRetrieve;

    /**
     * 
     * @param {string} listID 
     * @param {string} valueID 
     * @param {function (string) :xx} fnRetrieve 
     */
    constructor( listID, valueID, fnRetrieve ) {
        this.#listID = listID;
        this.#valueID = valueID;
        this.#fnRetrieve = fnRetrieve;
    }

    getListID() {
        return this.#listID;
    }

    /**
     * @param {string} value 
     */
    getResults( value ) {
        return this.#fnRetrieve( value );
    }

    getValueID() {
        return this.#valueID;
    }

}

const MIN_YEAR = 2000;

class SearchUI extends UI {

    #debounceTimer;

    async autoComplete( e, config ) {

        const dl = document.getElementById( config.getListID() );
        DOMUtils.removeChildren( dl );

        const value = e.target.value;
        if ( value.length < 3 ) {
            return;
        }

        const results = await config.getResults( value );
        for ( const [ k, v ] of Object.entries( results ) ) {
            dl.appendChild( DOMUtils.createElement( "option", { "value": k, "value_id": v } ) );
        }
    }

    changeFilter( e ) {
        DOMUtils.showElement( "search-crit", true );
        DOMUtils.showElement( e.target, false );
    }

    async #debounce( e, config, timeout = 500 ) {
        if ( !e.inputType ) {
            // Ignore events with no inputType (e.g., the event triggered after we set value).
            return;
        }
        clearTimeout( this.#debounceTimer );
        this.#debounceTimer = setTimeout( () => this.autoComplete( e, config, ), timeout );
    }

    handleAutoCompleteField( e, config ) {
        switch ( e.type ) {
            case "change": {
                // Clear ID.
                DOMUtils.setFormElementValue( config.getValueID(), "" );
                const value = e.target.value;
                const options = document.getElementById( config.getListID() ).childNodes;
                for ( const option of options ) {
                    if ( option.value === value ) {
                        DOMUtils.setFormElementValue( config.getValueID(), option.getAttribute( "value_id" ) );
                        return;
                    }
                }
            }
                break;
            case "focus":
                e.target.select();
                break;
            case "input":
                // Clear ID.
                DOMUtils.setFormElementValue( config.getValueID(), "" );
                // Clear any errors.
                e.target.setCustomValidity( "" );
                this.#debounce( e, config );
                break;
        }
    }

    async init() {
        await super.init();
        const e = document.getElementById( "cancel-query" );
        if ( e ) {
            e.addEventListener( "click", () => { this.getAPI().cancelQuery( true ); } );
        }
    }

    initEventListeners( prefix ) {

        /**
         * @param {Element} e 
         */
        function handleYearChange( e ) {
            const prefix = e.id.substring( 0, e.id.length - 1 );
            SearchUI.setYearMinMax( prefix );
            SearchUI.setYearMode( prefix );
        }

        /**
         * @param {Element} e 
         */
        function handleYearModeChange( e ) {

            /**
             * @param {string|number} year 
             */
            function setValues( year ) {
                DOMUtils.setFormElementValue( e.id + "1", year.toString() );
                DOMUtils.setFormElementValue( e.id + "2", year.toString() );
                SearchUI.setYearMinMax( e.id );
            }

            switch ( DOMUtils.getFormElementValue( e ) ) {
                case "Any":
                    setValues( "" );
                    break;
                case "This":
                    setValues( DateUtils.getCurrentYear() );
                    break;
                case "Last":
                    setValues( DateUtils.getCurrentYear() - 1 );
                    break;
            }

        }

        function initField( ui, id, config ) {
            const input = document.getElementById( id );
            if ( !input ) {
                return;
            }
            input.addEventListener( "change", ( e ) => ui.handleAutoCompleteField( e, config ) );
            input.addEventListener( "focus", ( e ) => ui.handleAutoCompleteField( e, config ) );
            input.addEventListener( "input", ( e ) => ui.handleAutoCompleteField( e, config ) );
        }

        const fields = [
            { name: "observer", fn: ( v ) => this.getAPI().getAutoCompleteObserver( v ) },
            { name: "place", fn: ( v ) => this.getAPI().getAutoCompletePlace( v ) },
            { name: "proj", fn: ( v ) => this.getAPI().getAutoCompleteProject( v ) },
            { name: "taxon", fn: ( v ) => this.getAPI().getAutoCompleteTaxon( v ) },
        ];

        for ( const field of fields ) {
            initField(
                this,
                prefix + "-" + field.name + "-name",
                new AutoCompleteConfig( prefix + "-" + field.name + "-name-list", prefix + "-" + field.name + "-id", field.fn )
            );
        }

        const eSelect = document.getElementById( prefix + "-year" );
        if ( eSelect ) {
            eSelect.addEventListener( "change", ( e ) => handleYearModeChange( e.target ) );
            document.getElementById( prefix + "-year1" ).addEventListener( "change", ( e ) => handleYearChange( e.target ) );
            document.getElementById( prefix + "-year2" ).addEventListener( "change", ( e ) => handleYearChange( e.target ) );
        }

    }

    /**
     * 
     * @param {string} prefix 
     * @returns {SpeciesFilter}
     */
    initFilterFromForm( prefix ) {

        const FILT_AUTOCOMPLETE_FIELDS = [
            { name: "proj", query_param: FP.PROJ_ID, label: "project" },
            { name: "place", query_param: FP.PLACE_ID, label: "place" },
            { name: "observer", query_param: FP.USER_ID, label: "observer" },
            { name: "taxon", query_param: FP.TAXON_ID, label: "taxon" },
        ];

        const filterArgs = {};

        let hasErrors = false;

        for ( const field of FILT_AUTOCOMPLETE_FIELDS ) {
            const id = DOMUtils.getFormElementValue( prefix + "-" + field.name + "-id" );
            const input = DOMUtils.getElement( prefix + "-" + field.name + "-name" );
            if ( id ) {
                filterArgs[ field.query_param ] = id;
            } else {
                // Make sure the associated text input is blank.
                if ( input instanceof HTMLInputElement ) {
                    if ( input.value ) {
                        input.setCustomValidity( "Invalid " + field.label + "." );
                        DOMUtils.setFocusTo( input );
                        hasErrors = true;
                    } else {
                        input.setCustomValidity( "" );
                    }
                }
            }
        }

        const month1 = DOMUtils.getFormElementValue( prefix + "-month1" );
        if ( month1 ) {
            filterArgs[ FP.MONTH ] = month1;
        }

        const year1 = DOMUtils.getFormElementValue( prefix + "-year1" );
        const year2 = DOMUtils.getFormElementValue( prefix + "-year2" );
        if ( year1 ) {
            filterArgs[ FP.YEAR1 ] = year1;
        }
        if ( year2 ) {
            filterArgs[ FP.YEAR2 ] = year2;
        }

        if ( document.getElementById( prefix + "-researchgrade" ).checked ) {
            filterArgs[ FP.QUALITY_GRADE ] = "research";
        }

        document.getElementById( "form" ).reportValidity();
        if ( hasErrors ) {
            return;
        }
        return new SpeciesFilter( filterArgs );
    }

    async initForm( prefix, filter = new SpeciesFilter( {} ) ) {

        function initMonth( filter ) {
            const month = filter.getParamValue( FP.MONTH );
            if ( !month ) {
                return;
            }
            DOMUtils.setFormElementValue( prefix + "-month1", month );
        }

        function initYear( filter ) {
            const year1 = filter.getParamValue( FP.YEAR1 );
            const year2 = filter.getParamValue( FP.YEAR2 );
            DOMUtils.setFormElementValue( prefix + "-year1", year1 ? year1 : "" );
            DOMUtils.setFormElementValue( prefix + "-year2", year2 ? year2 : "" );
            SearchUI.setYearMinMax( prefix + "-year" );
            SearchUI.setYearMode( prefix + "-year" );
        }

        async function initObserver( api, filter ) {
            const id = filter.getParamValue( FP.USER_ID );
            DOMUtils.setFormElementValue( prefix + "-observer-id", id );
            if ( !id ) {
                return;
            }
            // Look up name based on ID.
            const data = await api.getUserData( id );
            if ( !data ) {
                return;
            }
            DOMUtils.setFormElementValue( prefix + "-observer-name", data.login );
        }

        async function initPlace( api, filter ) {
            // Check for place.
            const placeID = filter.getParamValue( FP.PLACE_ID );
            DOMUtils.setFormElementValue( prefix + "-place-id", placeID );
            if ( !placeID ) {
                return;
            }
            // Look up name based on ID.
            const placeData = await api.getPlaceData( placeID );
            if ( !placeData ) {
                return;
            }
            DOMUtils.setFormElementValue( prefix + "-place-name", placeData.display_name );
        }

        async function initProject( api, filter ) {
            // Check for project.
            const projID = filter.getParamValue( FP.PROJ_ID );
            DOMUtils.setFormElementValue( prefix + "-proj-id", projID );
            if ( !projID ) {
                return;
            }
            // Look up name based on ID.
            const projectData = await api.getProjectData( projID );
            if ( !projectData ) {
                return;
            }
            DOMUtils.setFormElementValue( prefix + "-proj-name", projectData.title );
        }

        async function initTaxon( api, filter ) {
            // Check for taxon.
            const taxonID = filter.getParamValue( FP.TAXON_ID );
            DOMUtils.setFormElementValue( prefix + "-taxon-id", taxonID );
            if ( !taxonID ) {
                return;
            }
            // Look up name based on ID.
            const taxonData = await api.getTaxonData( taxonID );
            if ( !taxonData ) {
                return;
            }
            DOMUtils.setFormElementValue( prefix + "-taxon-name", api.getTaxonFormName( taxonData ) );
        }

        await initProject( this.getAPI(), filter );
        await initPlace( this.getAPI(), filter );
        await initObserver( this.getAPI(), filter );
        await initTaxon( this.getAPI(), filter );
        initMonth( filter );
        initYear( filter );

        const qualityGrade = filter.getParamValue( FP.QUALITY_GRADE );
        DOMUtils.enableCheckBox( prefix + "-researchgrade", qualityGrade === "research" );

    }

    /**
     * @param {string} prefix 
     */
    static setYearMinMax( prefix ) {
        const d1 = document.getElementById( prefix + "1" );
        const d2 = document.getElementById( prefix + "2" );
        if ( d1 && d2 ) {
            const d1Val = DOMUtils.getFormElementValue( d1 );
            const d2Val = DOMUtils.getFormElementValue( d2 );
            d1.setAttribute( "max", d2Val ? d2Val : DateUtils.getCurrentYear().toString() );
            d2.setAttribute( "min", d1Val ? d1Val : MIN_YEAR.toString() );
            d2.setAttribute( "max", DateUtils.getCurrentYear().toString() );
        }
    }

    /**
     * @param {string} prefix 
     */
    static setYearMode( prefix ) {

        function getMode() {
            const d1 = DOMUtils.getFormElementValue( prefix + "1" );
            const d2 = DOMUtils.getFormElementValue( prefix + "2" );
            if ( d1 === d2 && d1 !== undefined ) {
                if ( d1 === "" ) {
                    return "Any";
                }
                if ( parseInt( d1 ) === DateUtils.getCurrentYear() ) {
                    return "This";
                }
                if ( parseInt( d1 ) === DateUtils.getCurrentYear() - 1 ) {
                    return "Last";
                }
            }
            return "Range";
        }

        DOMUtils.setFormElementValue( prefix, getMode() );

    }

}

export { AutoCompleteConfig, SearchUI };