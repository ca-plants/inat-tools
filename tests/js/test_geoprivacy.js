import test from "ava";
import { INatObservation } from "../../app/js/lib/inatobservation.js";
import { makeObservationData } from "./mockdata.js";
import { MockAPI, MockTaxa } from "./mockapi.js";

const API = new MockAPI();

const CUSCUTA = await API.getTaxonData(MockTaxa.Cuscuta.toString());

/**
 * @param {string} taxon_geoprivacy
 * @param {string|null} geoprivacy
 * @param {string} [private_location]
 * @returns{INatObservation}
 */
function makeObservation(taxon_geoprivacy, geoprivacy, private_location) {
    return new INatObservation(
        makeObservationData(CUSCUTA, {
            taxon_geoprivacy: taxon_geoprivacy,
            geoprivacy: geoprivacy,
            private_location: private_location,
        }),
    );
}

const geoprivacy = test.macro({
    /**
     * @param {INatObservation} obs
     * @param {boolean} expectedObscured
     */
    async exec(t, obs, expectedObscured) {
        t.deepEqual(obs.isObscured(), expectedObscured);
    },
    /**
     * @param {string|undefined} title
     */
    title(title) {
        return title ?? "";
    },
});

const pubcoords = test.macro({
    /**
     * @param {INatObservation} obs
     * @param {boolean} expectedObscured
     */
    async exec(t, obs, expectedObscured) {
        t.deepEqual(obs.coordsArePublic(), expectedObscured);
    },
    /**
     * @param {string|undefined} title
     */
    title(title) {
        return title ?? "";
    },
});

test("null", geoprivacy, makeObservation("open", null), false);
test("open", geoprivacy, makeObservation("open", "open"), false);
test("obscured", geoprivacy, makeObservation("open", "obscured"), true);
test(
    "obscured-trusted",
    geoprivacy,
    makeObservation("open", "obscured", "37,-122"),
    false,
);
test("private", geoprivacy, makeObservation("open", "private"), true);
test(
    "private-trusted",
    geoprivacy,
    makeObservation("open", "private", "37,-122"),
    false,
);
test("taxon-obscured", geoprivacy, makeObservation("obscured", "open"), true);
test(
    "taxon-obscured-trusted",
    geoprivacy,
    makeObservation("obscured", "open", "37,-122"),
    false,
);

test("pc-null", pubcoords, makeObservation("open", null), true);
test("pc-open", pubcoords, makeObservation("open", "open"), true);
test("pc-obscured", pubcoords, makeObservation("open", "obscured"), false);
test(
    "pc-obscured-trusted",
    pubcoords,
    makeObservation("open", "obscured", "37,-122"),
    false,
);
test("pc-private", pubcoords, makeObservation("open", "private"), false);
test(
    "pc-private-trusted",
    pubcoords,
    makeObservation("open", "private", "37,-122"),
    false,
);
test(
    "pc-taxon-obscured",
    pubcoords,
    makeObservation("obscured", "open"),
    false,
);
test(
    "pc-taxon-obscured-trusted",
    pubcoords,
    makeObservation("obscured", "open", "37,-122"),
    false,
);
