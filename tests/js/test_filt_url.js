import test from "ava";

import { SpeciesFilter } from "../../app/js/lib/speciesfilter.js";

const url = test.macro({
    /**
     * @param {Params.SpeciesFilter} f1
     * @param {string} expected
     */
    async exec(t, f1, expected) {
        const filter = new SpeciesFilter(f1);
        t.is(filter.getURL().toString(), expected);
    },
    /**
     * @param {string|undefined} title
     */
    title(title) {
        return title ?? "";
    },
});

test(
    "month and year",
    url,
    { month: 12, year1: 2023, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&year=2023"
);
test(
    "month and years",
    url,
    { month: 12, year1: 2021, year2: 2023 },
    "https://www.inaturalist.org/observations?subview=grid&month=12&year=2021%2C2022%2C2023"
);
