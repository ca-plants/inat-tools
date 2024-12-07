declare class INatAPI {
    cancelQuery(yn: boolean): void;
    getJSON(url: URL | string, token?: string): Promise<any>;
    getPlaceData(id: string): Promise<INatData.PlaceData>;
    getProjectData(id: string): Promise<INatData.ProjectData>;
    getTaxonData(id: string): Promise<INatData.TaxonData>;
    getTaxonFormName(
        taxon: INatData.TaxonData,
        addCommonName?: boolean
    ): string;
    getUserData(id: string): Promise<INatData.UserData>;
}

declare class INatObservation {
    constructor(rawObservation: INatData.Observation);
    getCoordinatesGeoJSON(): [number, number];
    getObsDate(): Date;
}

declare class ProgressReporter {
    hide(): void;
    modalAlert(message: string): Promise<void>;
    setLabel(label: string): void;
    setNumPages(np: number): void;
    setPage(p: string): void;
    show(): void;
}

declare class SpeciesFilter {
    getBoundary(): GeoJSON.FeatureCollection | undefined;
    getURL(url?: string | URL): URL;
}

declare namespace INatData {
    export interface ControlledTerm {
        id: number;
        taxon_ids: number[];
    }
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
    export interface PlaceData {
        display_name: string;
    }
    export interface ProjectData {
        title: string;
    }
    export interface ProjectMemberData {}
    export interface TaxonData {
        id: number;
        parent_id: number;
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
        branch?: boolean;
    }
    export interface SpeciesFilter {
        month?: number;
        place_id?: string;
        boundary?: GeoJSON.FeatureCollection;
        project_id?: string;
        quality_grade?: string;
        taxon_id?: string;
        user_id?: string;
        year1?: number;
        year2?: number;
        annotations?: { type: "ev-mammal" | "plants"; value: string }[];
        establishment?: "native" | "introduced";
    }
}
