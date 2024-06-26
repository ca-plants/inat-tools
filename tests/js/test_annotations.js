import test from "ava";

import { MockAPI, MockTaxa } from "./mockapi.js";
import { SearchUI } from "../../app/js/lib/searchui.js";

const annotations = test.macro({
    /**
     * @param {number} taxonID
     * @param {string[]} expected
     */
    async exec(t, taxonID, expected) {
        const result = await SearchUI.getAnnotationsForTaxon(
            taxonID,
            new MockAPI()
        );
        t.deepEqual(result, expected);
    },
    /**
     * @param {string|undefined} title
     * @param {number} taxonID
     */
    title(title, taxonID) {
        return title ?? taxonID.toString();
    },
});

test(annotations, MockTaxa.Cuscuta, ["plants"]);
test(annotations, MockTaxa.Sus_scrofa, ["ev-mammal"]);
test(annotations, MockTaxa.Homo_sapiens, []);
test(annotations, MockTaxa.Pinus, []);
