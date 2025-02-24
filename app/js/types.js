/**
 * Types
 * @typedef {{
 *  geoprivacy: string | null;
 *  id: string;
 *  location: string;
 *  observed_on_details: { date: string };
 *  place_guess: string;
 *  private_location: string;
 *  private_place_guess: string;
 *  quality_grade: string;
 *  taxon: INatDataTaxon;
 *  taxon_geoprivacy: string;
 *  user: INatDataUser;
 * }} INatDataObs
 * @typedef {{
 *  id: number;
 *  parent_id: number;
 *  name: string;
 *  preferred_common_name: string;
 *  rank: string;
 *  rank_level: number;
 *  ancestor_ids: number[];
 * }} INatDataTaxon
 * @typedef {{count: number;taxon: INatDataTaxon}} INatDataTaxonObsSummary
 * @typedef {{id: string;login: string;name: string;}} INatDataUser
 * @typedef  {{
 *      f1: Params.SpeciesFilter;
 *      coords?: ("public" | "obscured" | "trusted")[];
 *      view?: "datehisto" | "details" | "geojson" | "usersumm";
 *      branch?: boolean;
 *  }} ParamsPageObsDetail
 *
 * Classes
 * @typedef {import("./lib/inatapi.js").INatAPI} INatAPI
 * @typedef {import("./lib/inatobservation.js").INatObservation} INatObservation
 * @typedef {import("./lib/progressreporter.js").ProgressReporter} ProgressReporter
 */
