import { hdom } from "@htmltools/hdom";

/**
 * @typedef {{
 * label:string,
 * observations:import("../types.js").INatObservation[]
 * }} HistoBin
 * @typedef {{
 * svg:SVGElement,
 * gXLabels:SVGElement
 * }} SVGData
 */

export class xHistogramYear {
  #bins;

  #dataHeight = 100;
  #dataWidth = 100;
  #labYWidth = 20;
  #labXHeight = 20;

  /** @type {SVGData} */
  #svg;
  #filter;

  /**
   * @param {import("../types.js").INatObservation[]} observations
   * @param {import("../types.js").SpeciesFilter} filter
   */
  constructor(observations, filter) {
    this.#bins = this.binObservations(observations);
    this.#filter = filter;
    this.#svg = this.#createSVG();
  }

  /**
   * @param {import("../types.js").INatObservation[]} observations
   * @returns {HistoBin[]}
   */
  binObservations(observations) {
    /** @type {Map<number,import("../types.js").INatObservation[]>} */
    const rawSummary = new Map();
    for (const obs of observations) {
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
   * @returns {SVGData}
   */
  #createSVG() {
    const svg = SVG.createElement("svg", { viewBox: this.#getViewBox() });

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
        x2: "100%",
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
    const numBins = this.#bins.length;
    const binWidth = this.getBinWidth();
    const gx = SVG.createElement("g", {}, svg);
    for (let index = 0; index < numBins; index++) {
      const g = SVG.createElement("g", { style: "visibility:hidden" }, gx);
      const x = binWidth * index + binWidth / 2;
      SVG.createElement(
        "line",
        {
          class: "tick",
          x1: x,
          y1: this.#dataHeight,
          x2: x,
          y2: this.#dataHeight + 1,
        },
        g,
      );
      const label = SVG.createElement(
        "text",
        { class: "label-x", x: x, y: this.#dataHeight + 5 },
        g,
      );
      hdom.setTextValue(label, this.#bins[index].label);
    }

    // Add y-axis labels.
    const maxCount = this.#bins.reduce(
      (m, bin) => Math.max(m, bin.observations ? bin.observations.length : 0),
      0,
    );
    const fontHeight = 3.8;
    const useableHeight = this.#dataHeight - fontHeight / 2;
    const maxLabels = Math.floor(useableHeight / fontHeight);
    const increment = Math.ceil(maxCount / maxLabels);
    let maxLabel = 0;
    let maxLabelY = 0;
    for (
      let index = increment;
      index < maxCount + increment;
      index += increment
    ) {
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
      maxLabel = index;
      maxLabelY = y;
    }

    // Add bars.
    const gBins = SVG.createElement("g", { id: "svg-datehisto-bins" }, svg);
    let x = 0;
    for (let index = 0; index < numBins; index++) {
      const bin = this.#bins[index];
      const height =
        (bin.observations.length / maxLabel) * (this.#dataHeight - maxLabelY);
      const g = SVG.createElement("g", {}, gBins);
      const rect = SVG.createElement(
        "rect",
        {
          class: "bin",
          x: x,
          width: binWidth,
          y: this.#dataHeight - height,
          height: height,
        },
        g,
      );
      const title = SVG.createElement("title", {}, rect);
      title.textContent = `${bin.label}\n${bin.observations.length} observations`;
      SVG.createElement(
        "path",
        {
          class: "bin",
          d: `M${x} ${this.#dataHeight}v-${height}h${binWidth}v${height}`,
        },
        g,
      );
      x += binWidth;
    }

    return { svg: svg, gXLabels: gx };
  }

  getBinWidth() {
    return this.#dataWidth / this.#bins.length;
  }

  getSVG() {
    return this.#svg.svg;
  }

  /**
   * @returns {string}
   */
  #getViewBox() {
    return `-${this.#labYWidth} 0 ${this.#dataWidth} ${this.#dataHeight + this.#labYWidth}`;
  }

  /**
   * @param {number} factor
   */
  setHorizontalScale(factor) {
    this.#dataWidth =
      factor * (this.#dataHeight + this.#labXHeight) - this.#labYWidth;
    this.#svg.svg.setAttribute("viewBox", this.#getViewBox());

    // Process x-axis labels.
    let maxLabelWidth = 0;
    const gLabels = this.#svg.gXLabels;
    for (const element of gLabels.children) {
      const eText = /** @type {SVGGraphicsElement} */ (element.children[1]);
      maxLabelWidth = Math.max(maxLabelWidth, eText.getBBox().width);
    }

    const binWidth = this.getBinWidth();
    const firstLabel = Math.ceil((maxLabelWidth - binWidth) / 2 / binWidth);
    const increment = Math.ceil((maxLabelWidth + 1) / binWidth);

    // Show non-overlapping, evenly spaced labels
    for (let index = 0; index < gLabels.children.length; index++) {
      const child = /** @type {HTMLElement} */ (gLabels.children[index]);
      if ((index - firstLabel) % increment === 0) {
        child.style.removeProperty("visibility");
      } else {
        child.style.visibility = "hidden";
      }
    }
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
