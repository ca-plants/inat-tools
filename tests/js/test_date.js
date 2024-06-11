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

const getMonthAndDay = test.macro({
    /**
     * @param {number} dayOfYear
     * @param {boolean} isLeapYear
     * @param {[number,number]} expected
     */
    async exec(t, dayOfYear, isLeapYear, expected) {
        const md = DateUtils.getMonthAndDay(dayOfYear, isLeapYear);
        t.is(md.month, expected[0]);
        t.is(md.day, expected[1]);
    },
    /**
     * @param {string|undefined} title
     * @param {number} dayOfYear
     * @param {boolean} isLeapYear
     */
    title(title, dayOfYear, isLeapYear) {
        return (
            "getMonthAndDay: " +
            (title
                ? title
                : dayOfYear.toString() +
                  "; isLeapYear=" +
                  isLeapYear.toString())
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

test(dayOfYear, "2024-01-01", 0);
test(dayOfYear, "2024-02-03", 33);
test(dayOfYear, "2024-02-29", 59);
test(dayOfYear, "2023-03-01", 59);
test(dayOfYear, "2023-03-01", 60, true);
test(dayOfYear, "2024-03-01", 60);
test(dayOfYear, "2023-12-31", 364);
test(dayOfYear, "2024-12-31", 365);

test(getMonthAndDay, 0, true, [1, 1]);
test(getMonthAndDay, 33, true, [2, 3]);
test(getMonthAndDay, 59, false, [3, 1]);
test(getMonthAndDay, 59, true, [2, 29]);
test(getMonthAndDay, 60, true, [3, 1]);
test(getMonthAndDay, 364, false, [12, 31]);
test(getMonthAndDay, 365, true, [12, 31]);

test(isLeapYear, 1900, true);
test(isLeapYear, 2000, false);
test(isLeapYear, 2023, false);
test(isLeapYear, 2024, true);
