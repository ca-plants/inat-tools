import { MockAPI, MockTaxa } from "../js/mockapi.js";
import { SearchUI } from "../../app/js/lib/searchui.js";

/**
 * @param {number} taxonID
 * @param {string[]} expected
 */
async function test(taxonID, expected) {
    it(taxonID.toString(), async () => {
        const result = await SearchUI.getAnnotationsForTaxon(
            taxonID,
            new MockAPI()
        );
        expect(result).toEqual(expected);
    });
}

describe("annotations", () => {
    test(MockTaxa.Cuscuta, ["plants"]);
    test(MockTaxa.Sus_scrofa, ["ev-mammal"]);
    test(MockTaxa.Homo_sapiens, []);
    test(MockTaxa.Pinus, []);
});
