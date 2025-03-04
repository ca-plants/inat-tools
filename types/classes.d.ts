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
