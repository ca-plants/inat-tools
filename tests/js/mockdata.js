/**
 * @param {INatData.TaxonData} taxon
 * @returns {INatData.Observation}
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
