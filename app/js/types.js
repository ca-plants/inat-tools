/**
 * Enums
 * @typedef {"exclude"|"subtract"} EnumCompareType
 * @typedef {"datehisto" | "details" | "mapdata" | "usersumm" | "map"} EnumObsDetailView
 *
 * Types - INat Data
 * @typedef {{
 *  geoprivacy: string | null;
 *  id: string;
 *  location: string;
 *  observed_on: string;
 *  place_guess: string;
 *  positional_accuracy: number|null;
 *  public_positional_accuracy: number|null;
 *  private_location: string;
 *  private_place_guess: string;
 *  quality_grade: string;
 *  taxon: INatDataTaxon;
 *  taxon_geoprivacy: string;
 *  time_observed_at: string;
 *  user: INatDataUser;
 * }} INatDataObs
 * @typedef {{display_name:string}} INatDataPlace
 * @typedef {{id: number;title: string;slug: string;user_ids: number[];}} INatDataProject
 * @typedef {{user_id:number,role:string,observations_count:number,user:{login:string,name:string}}} INatDataProjectMember
 * @typedef {"needs_id" | "research"} INatDataQualityGrade
 * @typedef {{
 *  id: number;
 *  parent_id: number;
 *  name: string;
 *  preferred_common_name: string;
 *  rank: string;
 *  rank_level: number;
 *  ancestor_ids: number[];
 * }} INatDataTaxon
 * @typedef {{taxon: INatDataTaxon,count: number;diff?:number}} INatDataTaxonObsSummary
 * @typedef {{id: string;login: string;name: string;}} INatDataUser
 *
 * Types - Parameters
 * @typedef {{
 *      f1?: ParamsSpeciesFilter;
 *      coords?: ("public" | "obscured" | "trusted")[];
 *      view?: EnumObsDetailView
 *      branch?: boolean;
 *      hist?:{view?:"date"|"time"};
 *      map?:{source?:string,view?:"obs"|"pop";maxdist?:number}
 *  }} ParamsPageObsDetail
 * @typedef {{
 *  accuracy?: number;
 *  annotations?: { type: "ev-mammal" | "plants"; value: string }[];
 *  boundary?: GeoJSON.FeatureCollection;
 *  establishment?: "native" | "introduced";
 *  month?: number | number[];
 *  obscuration?: "obscured" | "private" | "none" | "taxon";
 *  place_id?: string;
 *  project_id?: string;
 *  quality_grade?: INatDataQualityGrade[];
 *  taxon_id?: string;
 *  user_id?: string;
 *  year1?: number;
 *  year2?: number;
 * }} ParamsSpeciesFilter
 *
 * Classes
 * @typedef {import("./lib/inatapi.js").INatAPI} INatAPI
 * @typedef {import("./lib/inatobservation.js").INatObservation} INatObservation
 * @typedef {import("./lib/progressreporter.js").ProgressReporter} ProgressReporter
 * @typedef {import("./lib/speciesfilter.js").SpeciesFilter} SpeciesFilter
 */
