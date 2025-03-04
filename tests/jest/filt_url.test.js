import { SpeciesFilter } from "../../app/js/lib/speciesfilter.js";

/**
 * @param {string} name
 * @param {import("../../app/js/types.js").ParamsSpeciesFilter} f1
 * @param {string} expected
 */
function test(name, f1, expected) {
    it(name, () => {
        const filter = new SpeciesFilter(f1);
        expect(filter.getURL().toString()).toBe(expected);
    });
}

test(
    "month and year",
    { month: 12, year1: 2023, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&d1=2023-01-01&d2=2023-12-31",
);
test(
    "month and years",
    { month: 12, year1: 2021, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&d1=2021-01-01&d2=2023-12-31",
);
test(
    "month and start year",
    { month: 12, year1: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&d1=2023-01-01",
);
test(
    "month and start year",
    { month: 11, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=11&d2=2023-12-31",
);
