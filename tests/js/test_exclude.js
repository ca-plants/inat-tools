import test from "ava";
import { DataRetriever } from "../../app/js/lib/dataretriever.js";

const RES_BROMUS = {
    count: 0,
    taxon: {
        ancestry: "48460/47126/211194/47125/47163/47162/47434/514989/602023",
        name: "Bromus",
        preferred_common_name: "",
        id: "52701",
        ancestor_ids: [
            48460, 47126, 211194, 47125, 47163, 47162, 47434, 514989, 602023,
        ],
        rank: "",
        rank_level: 0,
    },
};

const RES_BROMUS_DIANDRUS = {
    count: 0,
    taxon: {
        ancestry:
            "48460/47126/211194/47125/47163/47162/47434/514989/602023/52701/1089683",
        name: "Bromus diandrus",
        preferred_common_name: "",
        id: "52702",
        ancestor_ids: [
            48460, 47126, 211194, 47125, 47163, 47162, 47434, 514989, 602023,
            52701, 1089683, 52702,
        ],
        rank: "",
        rank_level: 0,
    },
};

const exclude = test.macro({
    /**
     * @param {INatData.TaxonObsSummary[]} include
     * @param {INatData.TaxonObsSummary[]} exclude
     * @param {number[]} expected
     */
    async exec(t, include, exclude, expected) {
        const result = DataRetriever.removeExclusions(include, exclude);
        t.deepEqual(result, expected);
    },
    /**
     * @param {string|undefined} title
     */
    title(title) {
        return title ?? "";
    },
});

test("species", exclude, [RES_BROMUS_DIANDRUS], [RES_BROMUS_DIANDRUS], []);
test("genus", exclude, [RES_BROMUS], [RES_BROMUS_DIANDRUS], []);
