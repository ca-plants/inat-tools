declare class INatObservation {
    getObsDate(): Date;
}

declare class SpeciesFilter {
    getURL(url?: string | URL): URL;
}

declare namespace INatData {
    export interface TaxonData {
        id: string;
        rank: string;
        rank_level: number;
    }
    export interface TaxonObsSummary {
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
        taxon_id?: number;
        user_id?: string;
        year1?: number;
        year2?: number;
    }
}
