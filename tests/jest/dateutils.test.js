import { DateUtils } from "../../app/js/lib/dateutils.js";

/**
 * @param {string} strDate
 * @param {string} expected
 */
function test(strDate, expected) {
    it(strDate, () => {
        const result = DateUtils.getTimeString(new Date(strDate));
        expect(result).toEqual(expected);
    });
}

test("2025-03-15 13:30:05-07:00", "13:30");
test("2025-03-15 09:01:05-07:00", "09:01");
