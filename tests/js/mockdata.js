/**
 * @param {import("../../app/js/types.js").INatDataTaxon} taxon
 * @param {{taxon_geoprivacy?:string,geoprivacy?:string|null,private_location?:string}} [options={}]
 * @returns {import("../../app/js/types.js").INatDataObs}
 */
export function makeObservationData(taxon, options = {}) {
    const rawObservation = {
        taxon_geoprivacy: options.taxon_geoprivacy ?? "",
        geoprivacy: options.geoprivacy ?? "",
        observed_on: "",
        private_location: options.private_location ?? "",
        positional_accuracy: 0,
        public_positional_accuracy: 0,
        id: "",
        location: "",
        time_observed_at: "",
        place_guess: "",
        private_place_guess: "",
        quality_grade: "research",
        taxon: taxon,
        user: { id: "", login: "", name: "" },
    };
    return rawObservation;
}
