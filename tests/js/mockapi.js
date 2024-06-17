import { INatAPI } from "../../app/js/lib/inatapi.js";

const MockTaxa = {
    Insecta: 47158,
    Cuscuta: 56932,
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
            case MockTaxa.Insecta:
                return {
                    id: intID,
                    rank: "class",
                    rank_level: 20,
                    name: "Insecta",
                    preferred_common_name: "",
                    ancestor_ids: [],
                };
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
        }
        throw new Error();
    }

    async getUserData() {
        return { id: "", login: "testuser", name: "" };
    }
}

export { MockAPI, MockTaxa };
