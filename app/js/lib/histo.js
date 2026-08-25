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

    let minYear = Number.MAX_SAFE_INTEGER;
    let maxYear = Number.MIN_SAFE_INTEGER;
    for (const key of rawSummary.keys()) {
      minYear = Math.min(minYear, key);
      maxYear = Math.max(maxYear, key);
    }

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

    const dataWidth = 100;
    const dataHeight = 100;

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

    // Add x-axis labels.
    const numBins = data.length;
    const binWidth = dataWidth / numBins;
    for (let index = 0; index < numBins; index++) {
      const x = binWidth * index + binWidth / 2;
      SVG.createElement(
        "line",
        {
          class: "tick",
          x1: x,
          y1: dataHeight,
          x2: x,
          y2: dataHeight + 1,
        },
        svg,
      );
      const label = SVG.createElement(
        "text",
        { class: "label-x", x: x, y: dataHeight + 5 },
        svg,
      );
      hdom.setTextValue(label, data[index].label);
    }

    // Add y-axis labels.
    const maxCount = data.reduce(
      (m, bin) => Math.max(m, bin.observations ? bin.observations.length : 0),
      0,
    );
    const fontHeight = 3.8;
    const useableHeight = dataHeight - fontHeight / 2;
    for (let index = 1; index <= maxCount; index++) {
      const y =
        fontHeight / 2 + useableHeight - (useableHeight * index) / maxCount;
      SVG.createElement(
        "line",
        { class: "tick", x1: -1, y1: y, x2: 0, y2: y },
        svg,
      );
      const label = SVG.createElement(
        "text",
        { class: "label-y", x: -2, y: y },
        svg,
      );
      hdom.setTextValue(label, index.toString());
    }

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
