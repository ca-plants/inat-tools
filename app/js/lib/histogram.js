import * as Plot from "@observablehq/plot";
import { DateUtils } from "./dateutils.js";
import { InatURL } from "./inaturl.js";

/** @typedef {{tick:number,count:number,ids?:string[]}} Summary */

class Histogram {
    #observations;
    #filter;

    /**
     * @param {import("../types.js").INatObservation[]} observations
     * @param {import("../types.js").SpeciesFilter} filter
     */
    constructor(observations, filter) {
        this.#observations = observations;
        this.#filter = filter;
    }

    createSVG() {
        const data = this.summarizeObservations();
        const plot = Plot.plot({
            x: {
                label: null,
                interval: 1,
                tickFormat: (t) => this.formatTick(t),
                ticks: this.getTicks(data),
            },
            y: {
                label: null,
                interval: 1,
                tickFormat: (t) => parseInt(t).toString(),
            },
            marks: [
                Plot.barY(data, {
                    x: "tick",
                    y: "count",
                }),
                Plot.tip(
                    data,
                    Plot.pointerX({
                        x: {
                            value: (d) => (d.count ? d.tick : undefined),
                            label: "",
                        },
                        y: { value: "count", label: "" },
                        format: {
                            x: (d) => {
                                return this.formatTick(d);
                            },
                            y: (d) =>
                                d > 1
                                    ? `${d} observations`
                                    : `${d} observation`,
                        },
                    }),
                ),
                Plot.frame(),
            ],
        });
        plot.addEventListener("click", (event) => {
            this.viewInINat(event, plot.value, this.#filter);
        });

        plot.removeAttribute("width");
        plot.removeAttribute("height");
        return plot;
    }

    /**
     * @param {number} n
     * @returns {string}
     */
    // eslint-disable-next-line no-unused-vars
    formatTick(n) {
        throw new Error("must be implemented in subclass");
    }

    getObservations() {
        return this.#observations;
    }

    /**
     * @param {Summary[]} data
     * @returns {number[]}
     */
    // eslint-disable-next-line no-unused-vars
    getTicks(data) {
        throw new Error("must be implemented in subclass");
    }

    /**
     * @returns {Summary[]}
     */
    summarizeObservations() {
        throw new Error("must be implemented in subclass");
    }

    /**
     * @param {Event} event
     * @param {Summary} value
     * @param {import("../types.js").SpeciesFilter} filter
     */
    // eslint-disable-next-line no-unused-vars
    viewInINat(event, value, filter) {
        throw new Error("must be implemented in subclass");
    }
}

export class HistogramDate extends Histogram {
    /**
     * @param {number} n
     * @returns {string}
     */
    formatTick(n) {
        const md = DateUtils.getMonthAndDay(n, true);
        return md.month.toString() + "/" + md.day.toString();
    }

    /**
     * @param {Summary[]} data
     * @returns {number[]}
     */
    getTicks(data) {
        const start = data[0].tick;
        const end = data[data.length - 1].tick;
        const ticks = [start];

        const startMonth = DateUtils.getMonthAndDay(start, true).month;
        const endMonth = DateUtils.getMonthAndDay(end, true).month;

        // Add the first of each month.
        for (let month = startMonth + 1; month <= endMonth; month++) {
            ticks.push(
                DateUtils.getDayOfYear(new Date(2024, month - 1, 1), true),
            );
        }
        ticks.push(end);
        return ticks;
    }

    /**
     * @returns {Summary[]}
     */
    summarizeObservations() {
        /** @type {number[]} */
        const rawSummary = [];
        for (const obs of this.getObservations()) {
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
                    tick: index,
                    count: count ? count : 0,
                });
            }
        }

        return summary;
    }

    /**
     * @param {Event} event
     * @param {Summary} value
     * @param {import("../types.js").SpeciesFilter} filter
     */
    viewInINat(event, value, filter) {
        event.preventDefault();
        if (!value || !value.count) {
            return;
        }
        const url = filter.getURL();
        const md = DateUtils.getMonthAndDay(value.tick, true);
        url.searchParams.set("month", md.month.toString());
        url.searchParams.set("day", md.day.toString());
        window.open(url, "_blank");
    }
}

export class HistogramTime extends Histogram {
    /**
     * @param {number} hour
     * @returns {string}
     */
    formatTick(hour) {
        return DateUtils.getTimeStringHM(hour, 0);
    }

    /**
     * @param {Summary[]} data
     * @returns {number[]}
     */
    getTicks(data) {
        const ticks = [];

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            if (item) {
                ticks.push(item.tick);
            }
        }
        return ticks;
    }

    /**
     * @returns {Summary[]}
     */
    summarizeObservations() {
        /** @type {string[][]} */
        const rawSummary = [];
        for (const obs of this.getObservations()) {
            const d = obs.getObsDate();
            const h = d.getHours() + (d.getMinutes() >= 30 ? 1 : 0);
            if (rawSummary[h] === undefined) {
                rawSummary[h] = [];
            }
            rawSummary[h].push(obs.getID());
        }

        const summary = [];
        for (let index = 0; index < rawSummary.length; index++) {
            const count = rawSummary[index] ? rawSummary[index].length : 0;
            if (summary.length || count) {
                summary.push({
                    tick: index,
                    count: count ? count : 0,
                    ids: rawSummary[index] ?? [],
                });
            }
        }

        return summary;
    }

    /**
     * @param {Event} event
     * @param {Summary} value
     */
    viewInINat(event, value) {
        event.preventDefault();
        if (!value || !value.count) {
            return;
        }
        const url = InatURL.getObsIDLink(value.ids ?? [], "table");
        if (!value) {
            return;
        }
        window.open(url, "_blank");
    }
}
