import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot/+esm";
import { DateUtils } from "./dateutils.js";

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

        const plot = Plot.barY(this.#summarizeObservations(observations), {
            x: "date",
            y: "count",
            tip: { format: { x: (d) => formatDate(d) } },
        }).plot({
            x: {
                label: "Date",
                interval: 1,
                tickFormat: (t) => formatDate(t),
            },
            y: {
                label: "Observations",
                interval: 1,
                tickFormat: (t) => parseInt(t).toString(),
            },
        });
        plot.addEventListener("click", (event) => {
            this.#viewInINat(event, plot.value, filter);
        });
        return plot;
    }

    /**
     * @param {INatObservation[]} observations
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
