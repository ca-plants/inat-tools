const FP = {
    MONTH: "month",
    PLACE_ID: "place_id",
    PROJ_ID: "project_id",
    QUALITY_GRADE: "quality_grade",
    TAXON_ID: "taxon_id",
    USER_ID: "user_id",
    YEAR: "year",
};

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

class SpeciesFilter {

    #params = {};

    constructor( params ) {
        for ( const name of Object.values( FP ) ) {
            if ( params[ name ] ) {
                this.#params[ name ] = params[ name ];
            }
        }
    }

    async getDescription( api, exclusions ) {
        let descrip = "Species";

        if ( this.#params[ FP.TAXON_ID ] ) {
            const taxon = await api.getTaxonData( this.#params[ FP.TAXON_ID ] );
            descrip = api.getTaxonFormName( taxon, false );
        }
        descrip += " observed";
        if ( this.#params[ FP.USER_ID ] ) {
            const user = await api.getUserData( this.#params[ FP.USER_ID ] );
            descrip += " by " + user.login;
        }
        if ( this.#params[ FP.PROJ_ID ] ) {
            const proj = await api.getProjectData( this.#params[ FP.PROJ_ID ] );
            descrip += " in project \"" + proj.title + "\"";
        }
        if ( this.#params[ FP.PLACE_ID ] ) {
            const place = await api.getPlaceData( this.#params[ FP.PLACE_ID ] );
            descrip += " in " + place.display_name;
        }
        if ( this.#params[ FP.MONTH ] ) {
            descrip += " in " + MONTH_NAMES[ this.#params[ FP.MONTH ] - 1 ];
        }
        if ( this.#params[ FP.YEAR ] ) {
            descrip += " in " + this.#params[ FP.YEAR ];
        }
        switch ( this.#params[ FP.QUALITY_GRADE ] ) {
            case "needs_id":
                descrip += " (needs ID only)";
                break;
            case "research":
                descrip += " (research grade only)";
                break;
        }
        if ( exclusions ) {
            descrip += ", excluding " + await exclusions.getDescription( api );
        }
        return descrip;
    }

    getParams() {
        return structuredClone( this.#params );
    }

    getParamValue( name ) {
        return this.#params[ name ];
    }

    getURL( urlStr ) {
        const url = new URL( urlStr );
        for ( const [ k, v ] of Object.entries( this.#params ) ) {
            switch ( k ) {
                default:
                    url.searchParams.set( k, v );
                    break;
            }
        }
        return url;
    }

    isEmpty() {
        return Object.keys( this.#params ).length === 0;
    }

    isResearchGradeOnly() {
        return this.#params[ FP.QUALITY_GRADE ] === "research";
    }

    toJSON() {
        return this.#params;
    }

}

export { SpeciesFilter, FP };