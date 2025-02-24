import { INatAPI } from "../../app/js/lib/inatapi.js";

const MockTaxa = {
    Cuscuta: 56932,
    Cuscuta_californica: 57019,
    Cuscuta_pacifica: 76553,
    Cuscuta_pacifica_pacifica: 80645,
    Homo_sapiens: 43584,
    Insecta: 47158,
    Pinus: 47561,
    Sus_scrofa: 42134,
};

class MockAPI extends INatAPI {
    async getPlaceData() {
        return { display_name: "Tilden Regional Park, CA, US" };
    }

    /**
     * @returns {Promise<INatData.ProjectData>}
     */
    async getProjectData() {
        return { id: 0, title: "projname", slug: "projname", user_ids: [] };
    }

    /**
     * @param {string} id
     * @returns {Promise<import("../../app/js/types.js").INatDataTaxon>}
     */
    async getTaxonData(id) {
        const intID = parseInt(id);
        switch (intID) {
            case MockTaxa.Cuscuta:
                return {
                    id: intID,
                    parent_id: 0,
                    rank: "genus",
                    rank_level: 20,
                    name: "Cuscuta",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460,
                        47126,
                        211194,
                        47125,
                        47124,
                        48515,
                        52345,
                        993829,
                        MockTaxa.Cuscuta,
                    ],
                };
            case MockTaxa.Cuscuta_californica:
                return {
                    id: intID,
                    parent_id: MockTaxa.Cuscuta,
                    rank: "species",
                    rank_level: 10,
                    name: "Cuscuta californica",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460,
                        47126,
                        211194,
                        47125,
                        47124,
                        48515,
                        52345,
                        993829,
                        MockTaxa.Cuscuta,
                        MockTaxa.Cuscuta_californica,
                    ],
                };
            case MockTaxa.Cuscuta_pacifica:
                return {
                    id: intID,
                    parent_id: MockTaxa.Cuscuta,
                    rank: "species",
                    rank_level: 10,
                    name: "Cuscuta pacifica",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460,
                        47126,
                        211194,
                        47125,
                        47124,
                        48515,
                        52345,
                        993829,
                        MockTaxa.Cuscuta,
                        MockTaxa.Cuscuta_pacifica,
                    ],
                };
            case MockTaxa.Cuscuta_pacifica_pacifica:
                return {
                    id: intID,
                    parent_id: MockTaxa.Cuscuta_pacifica,
                    rank: "var",
                    rank_level: 0,
                    name: "Cuscuta pacifica pacifica",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460,
                        47126,
                        211194,
                        47125,
                        47124,
                        48515,
                        52345,
                        993829,
                        MockTaxa.Cuscuta,
                        MockTaxa.Cuscuta_pacifica,
                        MockTaxa.Cuscuta_pacifica_pacifica,
                    ],
                };
            case MockTaxa.Homo_sapiens:
                return {
                    id: intID,
                    parent_id: 0,
                    rank: "species",
                    rank_level: 20,
                    name: "Homo sapiens",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460, 1, 2, 355675, 40151, 848317, 848320, 848323,
                        43367, 786045, 936377, 936369, 1036675, 43575, 846252,
                        43583,
                    ],
                };
            case MockTaxa.Insecta:
                return {
                    id: intID,
                    parent_id: 0,
                    rank: "class",
                    rank_level: 20,
                    name: "Insecta",
                    preferred_common_name: "",
                    ancestor_ids: [48460, 1, 47120, 372739],
                };
            case MockTaxa.Pinus:
                return {
                    id: intID,
                    parent_id: 0,
                    rank: "genus",
                    rank_level: 20,
                    name: "Pinus",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460, 47126, 211194, 136329, 47375, 47562, 1456301,
                    ],
                };
            case MockTaxa.Sus_scrofa:
                return {
                    id: intID,
                    parent_id: 0,
                    rank: "species",
                    rank_level: 20,
                    name: "Sus scrofa",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460, 1, 2, 355675, 40151, 848317, 848320, 848324,
                        152870, 848343, 42118, 1365630, 1365636, 42126,
                    ],
                };
        }
        throw new Error();
    }

    async getUserData() {
        return { id: "", login: "testuser", name: "" };
    }
}

export { MockAPI, MockTaxa };
