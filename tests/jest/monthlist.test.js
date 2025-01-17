import { getMonthList } from "../../app/js/lib/searchui.js";

/**
 * @param {string} month1
 * @param {string} month2
 * @param {number|number[]|undefined} expected
 */
async function test(month1, month2, expected) {
    it(`${month1} to ${month2}`, async () => {
        const result = getMonthList(month1, month2);
        expect(result).toEqual(expected);
    });
}

describe("monthlist", () => {
    test("1", "1", 1);
    test("1", "12", undefined);
    test("1", "2", [1, 2]);
    test("10", "12", [10, 11, 12]);
    test("10", "2", [10, 11, 12, 1, 2]);
});
