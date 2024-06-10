import test from "ava";
import { DateUtils } from "../../app/js/lib/dateutils.js";

const dayOfYear = test.macro({
    /**
     * @param {string} dString
     * @param {number} expected
     * @param {boolean|undefined} [isLeapYear]
     */
    async exec(t, dString, expected, isLeapYear) {
        const d = new Date(dString);
        t.is(DateUtils.getDayOfYear(d, isLeapYear), expected);
    },
    /**
     * @param {string|undefined} title
     * @param {string} dString
     * @param {number} expected
     * @param {boolean|undefined} [isLeapYear]
     */
    title(title, dString, expected, isLeapYear) {
        return (
            "dayOfYear: " +
            (title ? title : dString) +
            (isLeapYear === undefined
                ? ""
                : "; isLeapYear=" + isLeapYear.toString())
        );
    },
});

const isLeapYear = test.macro({
    /**
     * @param {number} year
     * @param {boolean} expected
     */
    async exec(t, year, expected) {
        t.is(DateUtils.isLeapYear(year), expected);
    },
    /**
     * @param {string|undefined} title
     * @param {number} year
     */
    title(title, year) {
        return "isLeapYear: " + (title ? title : year.toString());
    },
});

test(isLeapYear, 1900, true);
test(isLeapYear, 2000, false);
test(isLeapYear, 2023, false);
test(isLeapYear, 2024, true);

test(dayOfYear, "2024-01-01", 0);
test(dayOfYear, "2024-02-03", 33);
test(dayOfYear, "2023-03-01", 59);
test(dayOfYear, "2023-03-01", 60, true);
test(dayOfYear, "2024-03-01", 60);
test(dayOfYear, "2023-12-31", 364);
test(dayOfYear, "2024-12-31", 365);
