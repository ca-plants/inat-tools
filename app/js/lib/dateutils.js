const cumulativeDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export class DateUtils {
    static MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
    static MONTH_NAMES = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

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
     * @param {number} dayOfYear
     * @param {boolean} isLeapYear
     */
    static getMonthAndDay(dayOfYear, isLeapYear) {
        for (let index = 0; index < cumulativeDays.length - 1; index++) {
            const adjust = isLeapYear && index > 0 ? 1 : 0;
            if (cumulativeDays[index + 1] + adjust > dayOfYear) {
                return {
                    month: index + 1,
                    day:
                        dayOfYear -
                        cumulativeDays[index] +
                        1 -
                        (isLeapYear && index > 1 ? 1 : 0),
                };
            }
        }
        return { month: 12, day: dayOfYear - (isLeapYear ? 334 : 333) };
    }

    /**
     * @param {Date} d
     * @returns {string}
     */
    static getTimeString(d) {
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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
