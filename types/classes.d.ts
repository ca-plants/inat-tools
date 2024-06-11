declare class INatObservation {
    getObsDate(): Date;
}

declare class SpeciesFilter {
    getURL(url?: string | URL): URL;
}

declare namespace Params {
    export interface PageObsDetail {
        f1: Params.SpeciesFilter;
        sel?: ("public" | "obscured" | "trusted")[];
    }
    export interface SpeciesFilter {
        month?: number;
        project_id?: string;
        quality_grade?: string;
        taxon_id?: number;
        user_id?: string;
    }
}
