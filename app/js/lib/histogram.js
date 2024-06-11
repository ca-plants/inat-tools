import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot/+esm";
import { DateUtils } from "./dateutils.js";
// eslint-disable-next-line no-unused-vars
import { INatObservationX as INatObservation } from "../lib/inatobservationx.js";

class Histogram {
    /**
     * @param {INatObservation[]} observations
     */
    static createSVG(observations) {
        const plot = Plot.barY(this.#summarizeObservations(observations), {
            x: "date",
            y: "count",
        }).plot({
            x: {
                label: "Date",
                interval: 1,
                tickFormat: (t) => {
                    const md = DateUtils.getMonthAndDay(t, true);
                    return md.month.toString() + "/" + md.day.toString();
                },
            },
            y: {
                label: "Observations",
                interval: 1,
                tickFormat: (t) => parseInt(t).toString(),
            },
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
            const dayOfYear = DateUtils.getDayOfYear(obs.getObsDate());
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
}

export { Histogram };
