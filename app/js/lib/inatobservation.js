class INatObservation {
    #rawObservation;

    /**
     * @param {import("../types.js").INatDataObs} rawObservation
     */
    constructor(rawObservation) {
        this.#rawObservation = rawObservation;
    }

    coordsArePublic() {
        return !this.#isObservationObscured() && !this.#isTaxonObscured();
    }

    /**
     * @returns {number|undefined}
     */
    getAccuracy() {
        if (this.isObscured()) {
            if (this.#rawObservation.public_positional_accuracy !== null) {
                return this.#rawObservation.public_positional_accuracy;
            }
            return;
        }
        if (this.#rawObservation.positional_accuracy !== null) {
            return this.#rawObservation.positional_accuracy;
        }
    }

    /**
     * @returns {[number,number]}
     */
    getCoordinatesGeoJSON() {
        const coords = this.getCoordinatesString().split(",");
        return [parseFloat(coords[1]), parseFloat(coords[0])];
    }

    getCoordinatesString() {
        if (this.#rawObservation.private_location) {
            return this.#rawObservation.private_location;
        }
        return this.#rawObservation.location;
    }

    getCoordType() {
        if (this.coordsArePublic()) {
            return "public";
        }
        return this.isObscured() ? "obscured" : "trusted";
    }

    getID() {
        return this.#rawObservation.id;
    }

    getObsDate() {
        return new Date(this.#rawObservation.observed_on_details.date);
    }

    getObsDateString() {
        return this.#rawObservation.observed_on_details.date.replaceAll(
            "-",
            String.fromCharCode(8209),
        );
    }

    getPlaceGuess() {
        if (this.#rawObservation.private_place_guess) {
            return this.#rawObservation.private_place_guess;
        }
        if (this.#rawObservation.place_guess) {
            return this.#rawObservation.place_guess;
        }
        if (this.#rawObservation.private_location) {
            // For geoprivacy: "private", we can see the coordinates of trusted users, but there is no place_guess.
            return this.#rawObservation.private_location;
        }
        return "unknown";
    }

    getTaxonName() {
        return this.#rawObservation.taxon.name;
    }

    getURL() {
        return (
            "https://www.inaturalist.org/observations/" +
            this.#rawObservation.id
        );
    }

    getUserDisplayName() {
        if (this.#rawObservation.user.name) {
            return this.#rawObservation.user.name;
        }
        return this.#rawObservation.user.login;
    }

    getUserID() {
        return this.#rawObservation.user.id;
    }

    getUserLogin() {
        return this.#rawObservation.user.login;
    }

    #isObservationObscured() {
        switch (this.#rawObservation.geoprivacy) {
            case null:
            case "open":
                return false;
            case "obscured":
            case "private":
                return true;
        }
        console.error("unknown geoprivacy: " + this.#rawObservation.geoprivacy);
    }

    isObscured() {
        if (!this.#isObservationObscured() && !this.#isTaxonObscured()) {
            return false;
        }
        return this.#rawObservation.private_location ? false : true;
    }

    #isTaxonObscured() {
        switch (this.#rawObservation.taxon_geoprivacy) {
            case null:
            case "open":
                return false;
            case "obscured":
                return true;
        }
        console.error(
            "unknown taxon_geoprivacy: " +
                this.#rawObservation.taxon_geoprivacy,
        );
    }
}

export { INatObservation };
