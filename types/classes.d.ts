declare class SpeciesFilter {
    getBoundary(): GeoJSON.FeatureCollection | undefined;
    getParams(): Params.SpeciesFilter;
    getURL(url?: string | URL): URL;
}

declare namespace INatData {
    export interface ProjectData {
        id: number;
        title: string;
        slug: string;
        user_ids: number[];
    }
    export interface ProjectMemberData {}
    export type QualityGrade = "needs_id" | "research";
}

declare namespace Params {
    export interface SpeciesFilter {
        month?: number | number[];
        place_id?: string;
        boundary?: GeoJSON.FeatureCollection;
        project_id?: string;
        quality_grade?: INatData.QualityGrade[];
        taxon_id?: string;
        user_id?: string;
        year1?: number;
        year2?: number;
        annotations?: { type: "ev-mammal" | "plants"; value: string }[];
        establishment?: "native" | "introduced";
        accuracy?: number;
        obscuration?: "obscured" | "private" | "none" | "taxon";
    }
}
