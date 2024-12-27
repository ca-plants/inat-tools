import { MockAPI, MockTaxa } from "../js/mockapi.js";
import { SpeciesFilter } from "../../app/js/lib/speciesfilter.js";

/**
 * @param {string} name
 * @param {Params.SpeciesFilter} f1
 * @param {Params.SpeciesFilter|undefined} f2
 * @param {string} expected
 */
function test(name, f1, f2, expected) {
    const filter = new SpeciesFilter(f1);
    it(name, async () => {
        const desc = await filter.getDescription(
            new MockAPI(),
            f2 ? new SpeciesFilter(f2) : undefined
        );
        expect(desc).toBe(expected);
    });
}

test(
    "project",
    { project_id: "1" },
    undefined,
    'Species observed in project "projname"'
);
test("month", { month: 3 }, undefined, "Species observed in March");
test(
    "year",
    { year1: 2023, year2: 2023 },
    undefined,
    "Species observed in 2023"
);
test(
    "year after",
    { year1: 2022 },
    undefined,
    "Species observed in 2022 or later"
);
test(
    "year before",
    { year2: 2022 },
    undefined,
    "Species observed in 2022 or earlier"
);
test(
    "year range",
    { year1: 2021, year2: 2023 },
    undefined,
    "Species observed from 2021 through 2023"
);
test(
    "place",
    { place_id: "3523" },
    undefined,
    "Species observed in Tilden Regional Park, CA, US"
);
test(
    "boundary",
    { boundary: { type: "FeatureCollection", features: [] } },
    undefined,
    "Species observed in specified boundary"
);
test(
    "place - research grade",
    { place_id: "3523", quality_grade: ["research"] },
    undefined,
    "Species observed in Tilden Regional Park, CA, US (research grade only)"
);
test(
    "place - not research grade",
    { place_id: "3523", quality_grade: ["needs_id"] },
    undefined,
    "Species observed in Tilden Regional Park, CA, US (needs ID only)"
);
test(
    "taxon in place",
    { place_id: "3523", taxon_id: "56932" },
    undefined,
    "Genus Cuscuta observed in Tilden Regional Park, CA, US"
);
test(
    "flowering plants",
    {
        taxon_id: "56932",
        annotations: [{ type: "plants", value: "Flowering" }],
    },
    undefined,
    "Genus Cuscuta observed when plant has flowers"
);
test(
    "budding plants",
    {
        taxon_id: "56932",
        annotations: [{ type: "plants", value: "Flower Buds" }],
    },
    undefined,
    "Genus Cuscuta observed when plant has flower buds"
);
test(
    "plants not flowering",
    {
        taxon_id: "56932",
        annotations: [{ type: "plants", value: "Not Flowering" }],
    },
    undefined,
    "Genus Cuscuta observed when plant has no evidence of flowering"
);
test(
    "pig organism",
    {
        taxon_id: MockTaxa.Sus_scrofa.toString(),
        annotations: [{ type: "ev-mammal", value: "Organism" }],
    },
    undefined,
    "Species Sus scrofa observed when organism is present"
);
test(
    "insects in place",
    { taxon_id: "47158", place_id: "3523" },
    undefined,
    "Class Insecta observed in Tilden Regional Park, CA, US"
);
test(
    "insects by observer in place",
    { taxon_id: "47158", place_id: "3523", user_id: "4218" },
    undefined,
    "Class Insecta observed by testuser in Tilden Regional Park, CA, US"
);
test(
    "insects in place excluding insects by observer in place",
    { taxon_id: "47158", place_id: "3523" },
    { taxon_id: "47158", place_id: "3523", user_id: "4218" },
    "Class Insecta observed in Tilden Regional Park, CA, US, excluding Class Insecta observed by testuser in Tilden Regional Park, CA, US"
);
test(
    "place and establishment",
    { place_id: "3523", establishment: "native" },
    undefined,
    "Species which are native observed in Tilden Regional Park, CA, US"
);
test(
    "place and accuracy",
    { place_id: "3523", accuracy: 1000 },
    undefined,
    "Species observed in Tilden Regional Park, CA, US with an accuracy of 1000 meters or less"
);
test(
    "place and taxon obscured",
    { place_id: "3523", obscuration: "taxon" },
    undefined,
    "Species observed in Tilden Regional Park, CA, US where taxon is obscured"
);
