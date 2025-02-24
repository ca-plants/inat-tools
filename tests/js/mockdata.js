/**
 * @param {import("../../app/js/types.js").INatDataTaxon} taxon
 * @returns {import("../../app/js/types.js").INatDataObs}
 */
export function makeObservationData(taxon) {
    const rawObservation = {
        taxon_geoprivacy: "",
        geoprivacy: "",
        private_location: "",
        id: "",
        location: "",
        observed_on_details: { date: "" },
        place_guess: "",
        private_place_guess: "",
        quality_grade: "research",
        taxon: taxon,
        user: { id: "", login: "", name: "" },
    };
    return rawObservation;
}
