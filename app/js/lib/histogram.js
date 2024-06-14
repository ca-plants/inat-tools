import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot/+esm";
import { DateUtils } from "./dateutils.js";

/** @typedef {{date:number,count:number}} Summary */

class Histogram {
    /**
     * @param {INatObservation[]} observations
     * @param {SpeciesFilter} filter
     */
    static createSVG(observations, filter) {
        /**
         * @param {number} doy
         */
        function formatDate(doy) {
            const md = DateUtils.getMonthAndDay(doy, true);
            return md.month.toString() + "/" + md.day.toString();
        }

        /**
         * @param {Summary[]} data
         */
        function getTicks(data) {
            const start = data[0].date;
            const end = data[data.length - 1].date;
            const ticks = [start];

            const startMonth = DateUtils.getMonthAndDay(start, true).month;
            const endMonth = DateUtils.getMonthAndDay(end, true).month;

            // Add the first of each month.
            for (let month = startMonth + 1; month <= endMonth; month++) {
                ticks.push(
                    DateUtils.getDayOfYear(new Date(2024, month - 1, 1), true)
                );
            }
            ticks.push(end);
            return ticks;
        }

        const data = this.#summarizeObservations(observations);
        const plot = Plot.plot({
            x: {
                label: null,
                interval: 1,
                tickFormat: (t) => formatDate(t),
                ticks: getTicks(data),
            },
            y: {
                label: null,
                interval: 1,
                tickFormat: (t) => parseInt(t).toString(),
            },
            marks: [
                Plot.barY(data, {
                    x: "date",
                    y: "count",
                    tip: {
                        format: {
                            x: (d) => formatDate(d),
                        },
                    },
                }),
                Plot.frame(),
            ],
        });
        plot.addEventListener("click", (event) => {
            this.#viewInINat(event, plot.value, filter);
        });

        plot.removeAttribute("width");
        plot.removeAttribute("height");
        return plot;
    }

    /**
     * @param {INatObservation[]} observations
     * @returns {Summary[]}
     */
    static #summarizeObservations(observations) {
        /** @type {number[]} */
        const rawSummary = [];
        for (const obs of observations) {
            const dayOfYear = DateUtils.getDayOfYear(obs.getObsDate(), true);
            if (rawSummary[dayOfYear]) {
                rawSummary[dayOfYear] = rawSummary[dayOfYear] + 1;
            } else {
                rawSummary[dayOfYear] = 1;
            }
        }

        const summary = [];
        for (let index = 0; index < rawSummary.length; index++) {
            const count = rawSummary[index];
            if (summary.length || count) {
                summary.push({
                    date: index,
                    count: count ? count : 0,
                });
            }
        }

        return summary;
    }

    /**
     * @param {Event} event
     * @param {{date:number,count:number}} value
     * @param {SpeciesFilter} filter
     */
    static #viewInINat(event, value, filter) {
        event.preventDefault();
        const url = filter.getURL();
        if (!value || !value.count) {
            return;
        }
        const md = DateUtils.getMonthAndDay(value.date, true);
        url.searchParams.set("month", md.month.toString());
        url.searchParams.set("day", md.day.toString());
        window.open(url, "_blank");
    }
}

export { Histogram };
