import { hdom } from "@htmltools/hdom";
import { csvFormatRows } from "d3-dsv";

/**
 * @callback FnColDefGetHeaderVal
 * @param {...any} args
 * @returns {HTMLElement|string}
 */

/**
 * @template T
 * @callback FnColDefGetStringVal
 * @param {T} entry
 * @param {...any} args
 * @returns {string}
 */

/**
 * @template T
 * @callback FnColDefGetColVal
 * @param {string} value
 * @param {T} entry
 * @param {...any} args
 * @returns {HTMLElement|string}
 */

/**
 * @template T
 */
export class ColDef {
  #th;
  /** @type {FnColDefGetStringVal<T>} */
  #fnValue;
  /** @type {FnColDefGetColVal<T>|undefined} */
  #fnCellContent;
  #className;

  /**
   * @param {string|FnColDefGetHeaderVal} th
   * @param {FnColDefGetStringVal<T>} fnValue
   * @param {FnColDefGetColVal<T>} [fnCellContent]
   * @param {string} [className]
   */
  constructor(th, fnValue, fnCellContent, className) {
    this.#th = th;
    this.#fnValue = fnValue;
    this.#fnCellContent = fnCellContent;
    this.#className = className;
  }

  /**
   * @param {Element} tr
   * @param {Node|string} content
   * @param {string|undefined} className
   */
  static addColElement(tr, content, className) {
    const td = hdom.createElement("td", className);
    if (content instanceof Node) {
      td.appendChild(content);
    } else {
      td.appendChild(document.createTextNode(content));
    }
    tr.appendChild(td);
  }

  /**
   * @param {any} entry
   * @template T
   * @param {ColDef<T>[]} cols
   * @param {any[]} [otherArgs]
   * @param {string|undefined} [className]
   */
  static createRow(entry, cols, otherArgs = [], className) {
    /**
     * @param {Node|string} content
     * @param {string|undefined} className
     */
    function getCol(content, className) {
      const td = hdom.createElement("td", className);
      if (content instanceof Node) {
        td.appendChild(content);
      } else {
        td.appendChild(document.createTextNode(content));
      }
      tr.appendChild(td);
    }

    const tr = hdom.createElement("tr", className);
    for (const col of cols) {
      getCol(col.getCellContent(entry, ...otherArgs), col.getClass());
    }

    return tr;
  }

  /**
   * @template T
   * @param {ColDef<T>[]} cols
   * @param {...any} otherArgs
   */
  static createTable(cols, ...otherArgs) {
    const table = hdom.createElement("table");

    const thead = hdom.createElement("thead");
    table.appendChild(thead);
    const tr = hdom.createElement("tr");
    thead.appendChild(tr);
    for (const col of cols) {
      const th = hdom.createElement("th", col.getClass());
      tr.appendChild(th);
      const content = col.getHeaderLabel(otherArgs);
      th.appendChild(
        typeof content === "string"
          ? document.createTextNode(content)
          : content,
      );
    }

    return table;
  }

  getClass() {
    return this.#className;
  }

  /**
   * @param {...any} [args]
   */
  getHeaderLabel(args) {
    return typeof this.#th === "string" ? this.#th : this.#th(args);
  }

  /**
   * @param {T} entry
   * @param {any[]} args
   * @returns {Element|string}
   */
  getCellContent(entry, ...args) {
    const value = this.getValue(entry, ...args);
    return this.#fnCellContent
      ? this.#fnCellContent(value, entry, ...args)
      : value;
  }

  /**
   * @template T
   * @param {T[]} results
   * @param {ColDef<T>[]} cols
   * @param {any[]} otherArgs
   * @returns {string}
   */
  static getCSVData(results, cols, ...otherArgs) {
    /** @type {string[][]} */
    const data = [];
    data.push(
      cols.map((col) => {
        const h = col.getHeaderLabel(...otherArgs);
        if (typeof h !== "string") {
          throw new Error();
        }
        return h;
      }),
    );

    for (const result of results) {
      const row = [];
      for (const col of cols) {
        row.push(col.getValue(result, ...otherArgs));
      }
      data.push(row);
    }

    return csvFormatRows(data);
  }

  /**
   * @param {T} entry
   * @param {any[]} args
   * @returns {string}
   */
  getValue(entry, ...args) {
    return this.#fnValue(entry, ...args);
  }
}
