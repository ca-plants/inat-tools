const cumulativeDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

class DateUtils {
    static getCurrentYear() {
        return new Date().getFullYear();
    }

    /**
     * @param {Date} d
     */
    static getDateString(d) {
        return (
            d.getFullYear().toString() +
            "-" +
            (d.getMonth() + 101).toString().substring(1) +
            "-" +
            (d.getDate() + 100).toString().substring(1)
        );
    }

    /**
     * @param {Date} d
     * @param {boolean|undefined} [isLeapYear]
     * @returns {number}
     */
    static getDayOfYear(d, isLeapYear) {
        const month = d.getUTCMonth();
        if (isLeapYear === undefined) {
            isLeapYear = this.isLeapYear(d.getUTCFullYear());
        }
        return (
            cumulativeDays[month] +
            d.getUTCDate() -
            1 +
            (month > 1 && isLeapYear ? 1 : 0)
        );
    }

    /**
     * @param {number} year
     * @returns {boolean}
     */
    static isLeapYear(year) {
        if (year % 4 !== 0) {
            return false;
        }
        return year % 400 !== 0;
    }
}

export { DateUtils };
