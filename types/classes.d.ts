declare class INatObservation {
    getObsDate(): Date;
}

declare class SpeciesFilter {
    getURL(url?: string | URL): URL;
}

declare namespace INatData {
    export interface Observation {
        geoprivacy: string | null;
        id: string;
        location: string;
        observed_on_details: { date: string };
        place_guess: string;
        private_location: string;
        private_place_guess: string;
        quality_grade: string;
        taxon: TaxonData;
        taxon_geoprivacy: string;
        user: { id: string; login: string; name: string };
    }
    export interface TaxonData {
        id: string;
        name: string;
        preferred_common_name: string;
        rank: string;
        rank_level: number;
    }
    export interface TaxonObsSummary {
        count: number;
        taxon: TaxonData;
    }
}

declare namespace Params {
    export interface PageObsDetail {
        f1: Params.SpeciesFilter;
        coords?: ("public" | "obscured" | "trusted")[];
        view?: "datehisto" | "details" | "geojson" | "usersumm";
    }
    export interface SpeciesFilter {
        month?: number;
        place_id?: string;
        project_id?: string;
        quality_grade?: string;
        taxon_id?: string;
        user_id?: string;
        year1?: number;
        year2?: number;
    }
}
