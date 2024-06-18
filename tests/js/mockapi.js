import { INatAPI } from "../../app/js/lib/inatapi.js";

const MockTaxa = {
    Cuscuta: 56932,
    Homo_sapiens: 43584,
    Insecta: 47158,
    Pinus: 47561,
    Sus_scrofa: 42134,
};

class MockAPI extends INatAPI {
    /**
     * @returns {Promise<INatData.ControlledTerm[]>}
     */
    async getControlledTerms() {
        return [
            {
                id: 12,
                taxon_ids: [47126],
            },
        ];
    }

    async getPlaceData() {
        return { display_name: "Tilden Regional Park, CA, US" };
    }

    async getProjectData() {
        return { title: "projname" };
    }

    /**
     * @param {string} id
     * @returns {Promise<INatData.TaxonData>}
     */
    async getTaxonData(id) {
        const intID = parseInt(id);
        switch (intID) {
            case MockTaxa.Cuscuta:
                return {
                    id: intID,
                    rank: "genus",
                    rank_level: 20,
                    name: "Cuscuta",
                    preferred_common_name: "",
                    ancestor_ids: [
                        48460, 47126, 211194, 47125, 47124, 48515, 52345,
                        993829,
                    ],
                };
            case MockTaxa.Homo_sapiens:
                return {
                    id: intID,
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
                    rank: "class",
                    rank_level: 20,
                    name: "Insecta",
                    preferred_common_name: "",
                    ancestor_ids: [48460, 1, 47120, 372739],
                };
            case MockTaxa.Pinus:
                return {
                    id: intID,
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
