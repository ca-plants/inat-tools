class INatObservation {

    static coordsArePublic( obs ) {
        return !this.#isObservationObscured( obs ) && !this.#isTaxonObscured( obs );
    }

    static getCoordinatesString( obs ) {
        if ( obs.private_location ) {
            return obs.private_location;
        }
        return obs.location;
    }

    static getCoordinatesGeoJSON( obs ) {
        const coords = this.getCoordinatesString( obs ).split( "," );
        return [ parseFloat( coords[ 1 ] ), parseFloat( coords[ 0 ] ) ];
    }

    static getCoordType( obs ) {
        if ( this.coordsArePublic( obs ) ) {
            return "public";
        }
        return this.isObscured( obs ) ? "obscured" : "trusted";
    }

    static getObsDateString( obs ) {
        return obs.observed_on_details.date.replaceAll( "-", String.fromCharCode( 8209 ) );
    }

    static getPlaceGuess( obs ) {
        return obs.private_place_guess ? obs.private_place_guess : obs.place_guess;
    }

    static getURL( obs ) {
        return "https://www.inaturalist.org/observations/" + obs.id;
    }

    static getUserDisplayName( obs ) {
        if ( obs.user.name ) {
            return obs.user.name;
        }
        return obs.user.login;
    }

    static getUserID( obs ) {
        return obs.user.id;
    }

    static getUserLogin( obs ) {
        return obs.user.login;
    }

    static #isObservationObscured( obs ) {
        switch ( obs.geoprivacy ) {
            case null:
            case "open":
                return false;
            case "obscured":
            case "private":
                return true;
        }
        console.error( "unknown geoprivacy: " + obs.geoprivacy );
    }

    static isObscured( obs ) {
        if ( !this.#isObservationObscured( obs ) && !this.#isTaxonObscured( obs ) ) {
            return false;
        }
        return obs.private_location ? false : true;
    }

    static #isTaxonObscured( obs ) {
        switch ( obs.taxon_geoprivacy ) {
            case null:
            case "open":
                return false;
            case "obscured":
                return true;
        }
        console.error( "unknown taxon_geoprivacy: " + obs.taxon_geoprivacy );
    }

}

export { INatObservation };