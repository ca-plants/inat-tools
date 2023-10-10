import test from "ava";
import { DataRetriever } from "../../app/js/lib/dataretriever.js";

const RES_BROMUS = {
    taxon: {
        "ancestry": "48460/47126/211194/47125/47163/47162/47434/514989/602023",
        "name": "Bromus",
        "id": 52701,
        "ancestor_ids": [
            48460,
            47126,
            211194,
            47125,
            47163,
            47162,
            47434,
            514989,
            602023
        ],
    }
};

const RES_BROMUS_DIANDRUS = {
    taxon: {
        "ancestry": "48460/47126/211194/47125/47163/47162/47434/514989/602023/52701/1089683",
        "name": "Bromus diandrus",
        "id": 52702,
        "ancestor_ids": [
            48460,
            47126,
            211194,
            47125,
            47163,
            47162,
            47434,
            514989,
            602023,
            52701,
            1089683,
            52702
        ],
    }
};

const exclude = test.macro( {
    async exec( t, include, exclude, expected ) {
        const result = DataRetriever.removeExclusions( include, exclude );
        t.deepEqual( result, expected );
    },
    title( title ) {
        return title;
    },
} );

test( "species", exclude, [ RES_BROMUS_DIANDRUS ], [ RES_BROMUS_DIANDRUS ], [] );
test( "genus", exclude, [ RES_BROMUS ], [ RES_BROMUS_DIANDRUS ], [] );
