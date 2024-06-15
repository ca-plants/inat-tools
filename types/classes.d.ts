declare class INatAPI {
    cancelQuery(yn: boolean): void;
    async getJSON(url: URL | string, token?: string): Promise<any>;
    async getPlaceData(id: string): Promise<INatData.PlaceData>;
    async getProjectData(id: string): Promise<INatData.ProjectData>;
    async getTaxonData(id: string): Promise<INatData.TaxonData>;
    getTaxonFormName(
        taxon: INatData.TaxonData,
        addCommonName?: boolean
    ): string;
    async getUserData(id: string): Promise<INatData.UserData>;
}

declare class INatObservation {
    getObsDate(): Date;
}

declare class ProgressReporter {
    hide(): void;
    modalAlert(message: string): Promise;
    setLabel(label: string): void;
    setNumPages(np: number): void;
    setPage(p: string): void;
    show(): void;
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
        user: UserData;
    }
    export interface TaxonData {
        id: number;
        name: string;
        preferred_common_name: string;
        rank: string;
        rank_level: number;
        ancestor_ids: number[];
    }
    export interface TaxonObsSummary {
        count: number;
        taxon: TaxonData;
    }
    export interface UserData {
        id: string;
        login: string;
        name: string;
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
