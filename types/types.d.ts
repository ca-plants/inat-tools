export type SpeciesFilterParams = {
    month?: number;
    quality_grade?: string;
    taxon_id?: string;
    user_id?: string;
};

export type TaxonData = {
    id: string;
    rank: string;
};
