import test from "ava";

import { INatAPI } from "../../app/js/lib/inatapi.js";
import { SpeciesFilter } from "../../app/js/lib/speciesfilter.js";

class MockAPI extends INatAPI {
    async getPlaceData() {
        return { display_name: "Tilden Regional Park, CA, US" };
    }

    async getProjectData() {
        return { title: "projname" };
    }

    /**
     * @param {string} id
     */
    async getTaxonData(id) {
        switch (id) {
            case "47158":
                return {
                    id: "",
                    rank: "class",
                    rank_level: 20,
                    name: "Insecta",
                    preferred_common_name: "",
                };
            case "56932":
                return {
                    id: "",
                    rank: "genus",
                    rank_level: 20,
                    name: "Cuscuta",
                    preferred_common_name: "",
                };
        }
        throw new Error();
    }

    async getUserData() {
        return { login: "testuser" };
    }
}

const descrip = test.macro({
    /**
     * @param {Params.SpeciesFilter} f1
     * @param {Params.SpeciesFilter|undefined} f2
     * @param {string} expected
     */
    async exec(t, f1, f2, expected) {
        const filter = new SpeciesFilter(f1);
        t.is(
            await filter.getDescription(
                new MockAPI(),
                f2 ? new SpeciesFilter(f2) : undefined
            ),
            expected
        );
    },
    /**
     * @param {string|undefined} title
     */
    title(title) {
        return title ?? "";
    },
});

test(
    "project",
    descrip,
    { project_id: "1" },
    undefined,
    'Species observed in project "projname"'
);
test("month", descrip, { month: 3 }, undefined, "Species observed in March");
test(
    "year",
    descrip,
    { year1: 2023, year2: 2023 },
    undefined,
    "Species observed in 2023"
);
test(
    "year after",
    descrip,
    { year1: 2022 },
    undefined,
    "Species observed in 2022 or later"
);
test(
    "year before",
    descrip,
    { year2: 2022 },
    undefined,
    "Species observed in 2022 or earlier"
);
test(
    "year range",
    descrip,
    { year1: 2021, year2: 2023 },
    undefined,
    "Species observed from 2021 through 2023"
);
test(
    "place",
    descrip,
    { place_id: "3523" },
    undefined,
    "Species observed in Tilden Regional Park, CA, US"
);
test(
    "place - research grade",
    descrip,
    { place_id: "3523", quality_grade: "research" },
    undefined,
    "Species observed in Tilden Regional Park, CA, US (research grade only)"
);
test(
    "place - not research grade",
    descrip,
    { place_id: "3523", quality_grade: "needs_id" },
    undefined,
    "Species observed in Tilden Regional Park, CA, US (needs ID only)"
);
test(
    "taxon in place",
    descrip,
    { place_id: "3523", taxon_id: "56932" },
    undefined,
    "Genus Cuscuta observed in Tilden Regional Park, CA, US"
);
test(
    "insects in place",
    descrip,
    { taxon_id: "47158", place_id: "3523" },
    undefined,
    "Class Insecta observed in Tilden Regional Park, CA, US"
);
test(
    "insects by observer in place",
    descrip,
    { taxon_id: "47158", place_id: "3523", user_id: "4218" },
    undefined,
    "Class Insecta observed by testuser in Tilden Regional Park, CA, US"
);
test(
    "insects in place excluding insects by observer in place",
    descrip,
    { taxon_id: "47158", place_id: "3523" },
    { taxon_id: "47158", place_id: "3523", user_id: "4218" },
    "Class Insecta observed in Tilden Regional Park, CA, US, excluding Class Insecta observed by testuser in Tilden Regional Park, CA, US"
);
