import { SpeciesFilter } from "../../app/js/lib/speciesfilter.js";

/**
 * @param {string} name
 * @param {Params.SpeciesFilter} f1
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
    "https://www.inaturalist.org/observations?subview=grid&month=12&year=2023"
);
test(
    "month and years",
    { month: 12, year1: 2021, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&year=2021%2C2022%2C2023"
);
