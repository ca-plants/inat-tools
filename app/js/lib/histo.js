import { hdom } from "@htmltools/hdom";
import { DateUtils } from "./dateutils.js";

/**
 * @typedef {{
 * label:string,
 * observations:import("../types.js").INatObservation[]
 * }} HistoBin
 * @typedef {{
 * svg:SVGElement,
 * gBins:SVGElement,
 * gXLabels:SVGElement,
 * maxXLabelWidth:number,
 * heightFactor:number,
 * }} SVGData
 */

export class Histo {
  #bins;

  #dataHeight = 100;
  #dataWidth = 100;
  #labYWidth = 20;
  #labXHeight = 20;

  #iNatURL;

  /** @type {SVGData} */
  #svg;

  /**
   * @param {HTMLElement} parent
   * @param {import("../types.js").INatObservation[]} observations
   * @param {string} iNatURL
   */
  constructor(parent, observations, iNatURL) {
    this.#bins = this.binObservations(observations);
    this.#iNatURL = iNatURL;
    this.#svg = this.#createSVG(parent);
  }

  /**
   * @param {import("../types.js").INatObservation[]} _observations
   * @returns {HistoBin[]}
   */
  binObservations(_observations) {
    throw new Error("must be implemented in subclass");
  }

  /**
   * @param {HTMLElement} parent
   * @returns {SVGData}
   */
  #createSVG(parent) {
    const svg = SVG.createElement("svg", { viewBox: this.#getViewBox() });
    parent.appendChild(svg);

    const style = hdom.createElement("style");
    hdom.setTextValue(
      style,
      `text {font-family:sans-serif}
    line.axis {stroke:black;stroke-width:.25}
    path.bin {stroke:black;stroke-width:.25;fill:grey}
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
    const binWidth = this.#getBinWidth();
    const gx = SVG.createElement("g", {}, svg);
    let maxLabelWidth = 0;
    let maxLabelHeight = 0;
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
      const label = /** @type {SVGGraphicsElement} */ (
        SVG.createElement(
          "text",
          { class: "label-x", x: x, y: this.#dataHeight + 5 },
          g,
        )
      );
      hdom.setTextValue(label, this.#bins[index].label);
      maxLabelWidth = Math.max(maxLabelWidth, label.getBBox().width);
      maxLabelHeight = Math.max(maxLabelHeight, label.getBBox().height);
    }
    this.#labYWidth = maxLabelWidth + 1;
    this.#labXHeight = maxLabelHeight + 2;

    // Add y-axis labels.
    const maxCount = this.#bins.reduce(
      (m, bin) => Math.max(m, bin.observations ? bin.observations.length : 0),
      0,
    );
    const fontHeight = 3.8;
    const maxTickPos = fontHeight / 2;
    const maxTickHeight = this.#dataHeight - maxTickPos;
    const maxNumberOfLabels = Math.floor(this.#dataHeight / fontHeight);
    const labelIncrement = Math.ceil(maxCount / maxNumberOfLabels);
    const numberOfLabels = Math.ceil(maxCount / labelIncrement);
    const maxLabelValue = numberOfLabels * labelIncrement;
    const heightFactor = maxTickHeight / maxLabelValue;

    const url = new URL(this.#iNatURL);
    let maxLabelYWidth = 0;
    for (let index = 0; index < numberOfLabels; index++) {
      const labelValue = (index + 1) * labelIncrement;
      const y =
        maxTickPos +
        maxTickHeight -
        (maxTickHeight * labelValue) / maxLabelValue;
      SVG.createElement(
        "line",
        { class: "tick", x1: -1, y1: y, x2: 0, y2: y },
        svg,
      );
      const label = /** @type {SVGGraphicsElement} */ SVG.createElement(
        "text",
        { class: "label-y", x: -2, y: y },
        svg,
      );
      hdom.setTextValue(label, labelValue.toString());
      maxLabelYWidth = Math.max(maxLabelYWidth, label.getBBox().width);
    }

    // Add bars.
    const gBins = SVG.createElement("g", { id: "svg-datehisto-bins" }, svg);
    let x = 0;
    for (let index = 0; index < numBins; index++) {
      const bin = this.#bins[index];
      const link = SVG.createElement(
        "a",
        { target: "_blank", href: this.getInatURL(url, bin).toString() },
        gBins,
      );

      const path = SVG.createElement(
        "path",
        {
          class: "bin",
          d: this.#getBinOutlinePath(x, binWidth, bin, heightFactor),
        },
        link,
      );
      const title = SVG.createElement("title", {}, path);
      title.textContent = `${bin.label}\n${bin.observations.length} observations`;

      x += binWidth;
    }

    return {
      svg: svg,
      gXLabels: gx,
      gBins: gBins,
      maxXLabelWidth: maxLabelWidth,
      heightFactor: heightFactor,
    };
  }

  /**
   * @param {number} x
   * @param {number} binWidth
   * @param {HistoBin} bin
   * @param {number} [heightFactor]
   * @returns {string}
   */
  #getBinOutlinePath(x, binWidth, bin, heightFactor) {
    const height =
      bin.observations.length * (heightFactor ?? this.#svg.heightFactor);
    return `M${x} ${this.#dataHeight}v-${height}h${binWidth}v${height}`;
  }

  #getBinWidth() {
    return this.#dataWidth / this.#bins.length;
  }

  /**
   *
   * @param {Iterable<number>} keys
   * @returns {[number,number]}
   */
  getIndexRange(keys) {
    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (const key of keys) {
      min = Math.min(min, key);
      max = Math.max(max, key);
    }
    return [min, max];
  }

  /**
   * @param {URL} _url
   * @param {HistoBin} _bin
   * @returns {URL}
   */
  getInatURL(_url, _bin) {
    throw new Error("must be implemented in subclass");
  }

  getSVG() {
    return this.#svg.svg;
  }

  /**
   * @returns {string}
   */
  #getViewBox() {
    return `-${this.#labYWidth} 0 ${this.#dataWidth + this.#labYWidth} ${this.#dataHeight + this.#labXHeight}`;
  }

  /**
   * @param {number} factor
   */
  setHorizontalScale(factor) {
    this.#dataWidth =
      factor * (this.#dataHeight + this.#labXHeight) - this.#labYWidth;
    this.#svg.svg.setAttribute("viewBox", this.#getViewBox());

    const maxLabelWidth = this.#svg.maxXLabelWidth;
    const gLabels = this.#svg.gXLabels;
    const binWidth = this.#getBinWidth();
    const firstLabel = Math.ceil((maxLabelWidth - binWidth) / 2 / binWidth);
    const increment = Math.ceil((maxLabelWidth + 1) / binWidth);

    // Show non-overlapping, evenly spaced labels
    for (let index = 0; index < gLabels.children.length; index++) {
      const x = binWidth * index + binWidth / 2;
      const g = /** @type {HTMLElement} */ (gLabels.children[index]);

      if ((index - firstLabel) % increment === 0) {
        g.style.removeProperty("visibility");
      } else {
        g.style.visibility = "hidden";
      }

      const tick = g.children[0];
      tick.setAttribute("x1", x.toString());
      tick.setAttribute("x2", x.toString());

      const text = g.children[1];
      text.setAttribute("x", x.toString());
    }

    // Resize bins.
    for (let index = 0; index < this.#svg.gBins.children.length; index++) {
      const x = binWidth * index;
      const g = this.#svg.gBins.children[index];

      const path = g.children[0];
      path.setAttribute(
        "d",
        this.#getBinOutlinePath(x, binWidth, this.#bins[index]),
      );
    }
  }
}

export class HistoDate extends Histo {
  /**
   * @param {import("../types.js").INatObservation[]} observations
   * @returns {HistoBin[]}
   */
  binObservations(observations) {
    /** @type {Map<number,import("../types.js").INatObservation[]>} */
    const rawSummary = new Map();
    for (const obs of observations) {
      const dayOfYear = DateUtils.getDayOfYear(
        new Date(obs.getObsDateString()),
        true,
      );
      let obsList = rawSummary.get(dayOfYear);
      if (obsList === undefined) {
        obsList = [];
        rawSummary.set(dayOfYear, obsList);
      }
      obsList.push(obs);
    }

    /** @type {HistoBin[]} */
    const summary = [];
    const range = this.getIndexRange(rawSummary.keys());
    for (let index = range[0]; index <= range[1]; index++) {
      const md = DateUtils.getMonthAndDay(index, true);
      summary.push({
        label: `${md.month}/${md.day}`,
        observations: rawSummary.get(index) ?? [],
      });
    }

    return summary;
  }

  /**
   * @param {URL} url
   * @param {HistoBin} bin
   * @returns {URL}
   */
  getInatURL(url, bin) {
    const md = bin.label.split("/");
    url.searchParams.set("month", md[0]);
    url.searchParams.set("day", md[1]);
    return url;
  }
}

export class HistoTime extends Histo {
  /**
   * @param {import("../types.js").INatObservation[]} observations
   * @returns {HistoBin[]}
   */
  binObservations(observations) {
    /** @type {Map<number,import("../types.js").INatObservation[]>} */
    const rawSummary = new Map();
    for (const obs of observations) {
      const t = obs.getObsTimeString();
      if (!t) {
        continue;
      }
      const hm = t.split(":");
      const h = parseInt(hm[0]);
      let obsList = rawSummary.get(h);
      if (obsList === undefined) {
        obsList = [];
        rawSummary.set(h, obsList);
      }
      obsList.push(obs);
    }

    /** @type {HistoBin[]} */
    const summary = [];
    const range = this.getIndexRange(rawSummary.keys());
    for (let index = range[0]; index <= range[1]; index++) {
      summary.push({
        label: `${index}:00`,
        observations: rawSummary.get(index) ?? [],
      });
    }

    return summary;
  }

  /**
   * @param {URL} url
   * @param {HistoBin} bin
   * @returns {URL}
   */
  getInatURL(url, bin) {
    const hm = bin.label.split(":");
    url.searchParams.set("hour", hm[0]);
    return url;
  }
}

export class HistoYear extends Histo {
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

    /** @type {HistoBin[]} */
    const summary = [];
    const range = this.getIndexRange(rawSummary.keys());
    for (let index = range[0]; index <= range[1]; index++) {
      summary.push({
        label: index.toString(),
        observations: rawSummary.get(index) ?? [],
      });
    }

    return summary;
  }

  /**
   * @param {URL} url
   * @param {HistoBin} bin
   * @returns {URL}
   */
  getInatURL(url, bin) {
    url.searchParams.set("year", bin.label);
    return url;
  }
}

class SVG {
  /**
   * @template T extends SVGElement
   * @param {string} elName
   * @param {Object<string,string|number|undefined>|string} [attributes]
   * @param {SVGElement} [parent]
   * @returns {T}
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
    // @ts-ignore
    return e;
  }
}
