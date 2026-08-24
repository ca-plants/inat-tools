/**
 * @typedef {{
 * label:string,
 * observations:import("../types.js").INatObservation[]
 * }} HistoBin
 */

import { hdom } from "@htmltools/hdom";

export class xHistogramYear {
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

  /**
   * @returns {HistoBin[]}
   */
  binObservations() {
    /** @type {Map<number,import("../types.js").INatObservation[]>} */
    const rawSummary = new Map();
    for (const obs of this.#observations) {
      const year = new Date(obs.getObsDateString()).getFullYear();
      let obsList = rawSummary.get(year);
      if (obsList === undefined) {
        obsList = [];
        rawSummary.set(year, obsList);
      }
      obsList.push(obs);
    }

    console.log(rawSummary);
    let minYear = Number.MAX_SAFE_INTEGER;
    let maxYear = Number.MIN_SAFE_INTEGER;
    for (const key of rawSummary.keys()) {
      minYear = Math.min(minYear, key);
      maxYear = Math.max(maxYear, key);
    }
    console.log(minYear);
    console.log(maxYear);

    /** @type {HistoBin[]} */
    const summary = [];
    for (let index = minYear; index <= maxYear; index++) {
      summary.push({
        label: index.toString(),
        observations: rawSummary.get(index) ?? [],
      });
    }

    return summary;
  }

  /**
   * @returns {SVGElement}
   */
  createSVG() {
    const data = this.binObservations();
    console.log(data);

    const svg = SVG.createElement("svg", { viewBox: "-20 0 120 120" });

    const style = hdom.createElement("style");
    hdom.setTextValue(
      style,
      `text {font-family:sans-serif}
    line.axis {stroke:black;stroke-width:.25}
    rect.bin {fill:grey;}
    path.bin {stroke:black;stroke-width:.25;fill:none}
    text.label-x {font-size:2.5pt;text-anchor:middle}
    text.label-y {font-size:2.5pt;text-anchor:end;alignment-baseline:central}
    line.tick {stroke:black;stroke-width:.25}`,
    );
    svg.appendChild(style);

    // Create axes.
    SVG.createElement(
      "line",
      {
        class: "axis",
        x1: 0,
        y1: 100,
        x2: 100,
        y2: 100,
      },
      svg,
    );
    SVG.createElement(
      "line",
      {
        class: "axis",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 100,
      },
      svg,
    );

    return svg;
  }

  /**
   * @param {Event} event
   * @param {HistoBin} value
   * @param {import("../types.js").SpeciesFilter} filter
   */
  viewInINat(event, value, filter) {
    event.preventDefault();
    if (!value || !value.count) {
      return;
    }
    const url = filter.getURL();
    url.searchParams.set("year", value.tick.toString());
    window.open(url, "_blank");
  }
}

class SVG {
  /**
   * @param {string} elName
   * @param {Object<string,string|number|undefined>|string} [attributes]
   * @param {SVGElement} [parent]
   * @returns {SVGElement}
   */
  static createElement(elName, attributes, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", elName);
    switch (typeof attributes) {
      case "string":
        // Assume it's a class name.
        e.setAttribute("class", attributes);
        break;
      case "object":
        for (const [k, v] of Object.entries(attributes)) {
          if (v !== undefined) {
            e.setAttribute(k, v.toString());
          }
        }
        break;
    }
    if (parent) {
      parent.appendChild(e);
    }
    return e;
  }
}
