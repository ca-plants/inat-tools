import { DataRetriever } from "../../app/js/lib/dataretriever.js";

const RES_BROMUS = {
    count: 0,
    taxon: {
        ancestry: "48460/47126/211194/47125/47163/47162/47434/514989/602023",
        name: "Bromus",
        preferred_common_name: "",
        id: 52701,
        parent_id: 0,
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
        id: 52702,
        parent_id: 0,
        ancestor_ids: [
            48460, 47126, 211194, 47125, 47163, 47162, 47434, 514989, 602023,
            52701, 1089683, 52702,
        ],
        rank: "",
        rank_level: 0,
    },
};

/**
 * @param {string} title
 * @param {INatData.TaxonObsSummary[]} include
 * @param {INatData.TaxonObsSummary[]} exclude
 * @param {number[]} expected
 */
function test(title, include, exclude, expected) {
    it(title, () => {
        const result = DataRetriever.removeExclusions(include, exclude);
        expect(result).toEqual(expected);
    });
}

test("species", [RES_BROMUS_DIANDRUS], [RES_BROMUS_DIANDRUS], []);
test("genus", [RES_BROMUS], [RES_BROMUS_DIANDRUS], []);
