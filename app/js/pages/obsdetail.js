import jstoxml from "jstoxml";
import { hdom } from "@htmltools/hdom";
import { marked } from "marked";
import { ColDef } from "../lib/coldef.js";
import { DataRetriever } from "../lib/dataretriever.js";
import { INatObservation } from "../lib/inatobservation.js";
import { SearchUI } from "../lib/searchui.js";
import { SpeciesFilter } from "../lib/speciesfilter.js";
import { createDownloadLink } from "../lib/utils.js";
import { InatURL } from "../lib/inaturl.js";
import { DEFAULT_MAP_SOURCE, Map, MAP_SOURCES } from "../lib/map.js";
import { Clusterer } from "../tools/clusterer.js";
import { HistoDate, HistoTime, HistoYear } from "../lib/histo.js";

/** @typedef {{role:string}} ProjectMember */
/** @typedef {"public" | "obscured" | "trusted"} SelType */
/** @typedef {{observations:INatObservation[],coordTypeCounts:{public:number,trusted:number,obscured:number}}} SummarizedResults */
/** @typedef {{id:string,login:string,display_name:string,results:SummarizedResults}} UserSummary */
/** @typedef {SelType[]} SelArray */

const OPTIONS_FORM_ID = "form-options";
/** @type {SelArray} */
const ALL_COORD_TYPES = ["public", "trusted", "obscured"];

/** @type {Object<string,ColDef<INatObservation>>} */
const DETAIL_COLS = {
  OBS_DATE: new ColDef(
    "Date",
    (obs) => {
      return obs.getObsDateString().replaceAll("-", String.fromCharCode(8209));
    },
    (value, obs) => {
      return hdom.createLinkElement(obs.getURL(), value, {
        target: "_blank",
        title: obs.getObsTimeString() ?? "time not specified",
      });
    },
  ),
  TAXON: new ColDef("Taxon", (obs) => obs.getTaxonName()),
  OBSERVER: new ColDef(
    "Observer",
    (obs) => obs.getUserDisplayName(),
    (value, obs) => {
      return hdom.createLinkElement(
        InatURL.getUserLink(obs.getUserLogin()),
        value,
        { target: "_blank" },
      );
    },
  ),
  LOCATION: new ColDef(
    "Location",
    (obs) => {
      return obs.getPlaceGuess();
    },
    (value, obs) => {
      if (obs.isObscured()) {
        return "";
      }
      const url = new URL("https://www.google.com/maps/search/?api=1");
      url.searchParams.set("query", obs.getCoordinatesString());
      return hdom.createLinkElement(url, value, {
        target: "_blank",
      });
    },
  ),
  COORDS: new ColDef("Coords", (obs) => {
    return obs.getCoordType();
  }),
  PROJECT: new ColDef("Proj Mem", (obs, ui) => {
    return ui.getMembershipStatus(obs.getUserID());
  }),
  COMMENTS: new ColDef(
    "Comments",
    () => "",
    (value, obs) => {
      const desc = obs.getDescription();
      let html =
        marked.parse(desc) +
        obs
          .getComments()
          .map((c) => `${marked.parse(`**${c.user.login}:** ${c.body}`)}`)
          .join("");
      const div = hdom.createElement("div");
      div.innerHTML = html;
      return div;
    },
  ),
};

/** @type {Object<string,ColDef<UserSummary>>} */
const SUMMARY_COLS = {
  OBSERVER_LOGIN: new ColDef("Login", (summ) => summ.login),
  OBSERVER_NAME: new ColDef("Name", (summ) =>
    summ.display_name === summ.login ? "" : summ.display_name,
  ),
  OBSERVER: new ColDef(
    "Observer",
    (summ) => summ.display_name,
    (value, summ) => {
      return hdom.createLinkElement(InatURL.getUserLink(summ.login), value, {
        target: "_blank",
      });
    },
  ),
  NUM_OBS: new ColDef(
    "Total",
    (summ) => String(summ.results.observations.length),
    (value, summ, ui) => {
      return ui.getObserverINatLink(summ, value);
    },
    "right",
  ),
  NUM_PUBLIC: new ColDef(
    "Public",
    (summ) => String(summ.results.coordTypeCounts["public"]),
    (value, summ, ui) => {
      return ui.getObserverINatLink(summ, value, ["public"]);
    },
    "right",
  ),
  NUM_TRUSTED: new ColDef(
    "Trusted",
    (summ) => String(summ.results.coordTypeCounts["trusted"]),
    (value, summ, ui) => {
      return ui.getObserverINatLink(summ, value, ["trusted"]);
    },
    "right",
  ),
  NUM_OBSCURED: new ColDef(
    "Obscured",
    (summ) => String(summ.results.coordTypeCounts["obscured"]),
    (value, summ, ui) => {
      return ui.getObserverINatLink(summ, value, ["obscured"]);
    },
    "right",
  ),
  PROJECT: new ColDef("Proj Mem", (summ, ui) => {
    return ui.getMembershipStatus(summ.id);
  }),
};

const DISPLAY_OPTIONS = [
  { id: "details", label: "Details" },
  { id: "mapdata", label: "Map Data" },
  { id: "datehisto", label: "Histogram" },
  { id: "usersumm", label: "Summary by Observer" },
  { id: "map", label: "Map" },
];

class ObsDetailUI extends SearchUI {
  /** @type {number|undefined} */
  #taxon_id;
  #f1;
  /** @type {import("../types.js").INatDataTaxon|undefined} */
  #taxon_data;
  /** @type {import("../types.js").INatObservation[]} */
  #rawResults = [];
  /** @type {SummarizedResults} */
  #summarizedResults = {
    observations: [],
    coordTypeCounts: { public: 0, trusted: 0, obscured: 0 },
  };
  /** @type {Object<string,ProjectMember>|undefined} */
  #project_members;
  /** @type {import("../types.js").ParamsPageObsDetail} */
  #hashParams;
  /** @type {number|undefined} */
  #debounceTimer;
  /** @type {import("geojson").FeatureCollection|undefined} */
  #downloadData;

  /** @type {import("../lib/histo.js").Histo|undefined} */
  #histo;

  /**
   * @param {import("../types.js").ParamsPageObsDetail} params
   */
  constructor(params) {
    super({ allowBoundary: true });
    this.#hashParams = params;
    this.#f1 = new SpeciesFilter(params.f1 ?? {});
  }

  clearResults() {
    return hdom.removeChildren("results");
  }

  /**
   * @returns {{content:string,fileName:string}}
   */
  #getHistoDownload() {
    /**
     * @param {Element} e
     * @returns {{}}
     */
    function getJSON(e) {
      /** @type {Object<string,string>} */
      const attrs = {};
      if (e.tagName === "svg") {
        attrs["xmlns"] = "http://www.w3.org/2000/svg";
      }
      for (const attr of e.attributes) {
        if (
          attr.name === "id" ||
          (e.tagName === "svg" && attr.name === "style")
        ) {
          continue;
        }
        attrs[attr.name] = attr.value;
      }
      /** @type {jstoxml.XmlElement} */
      const json = { _name: e.tagName.toLowerCase(), _attrs: attrs };

      /** @type {{}[]} */
      const children = [];
      for (const child of e.childNodes) {
        switch (child.nodeType) {
          case Node.ELEMENT_NODE:
            children.push(getJSON(/** @type {Element} */ (child)));
            break;
          case Node.TEXT_NODE:
            children.push(child.textContent ?? "");
            break;
        }
      }
      switch (children.length) {
        case 0:
          break;
        case 1:
          json["_content"] = children[0];
          break;
        default:
          json["_content"] = children;
          break;
      }
      return json;
    }

    const eHisto = hdom.getElement("svg-datehisto");

    const json = getJSON(eHisto);

    const svgXML = jstoxml.toXML(json, { indent: " " });
    return {
      content: svgXML,
      fileName: "histo.svg",
    };
  }

  /**
   * @param {number|undefined} [indent]
   * @param {string} [type]
   * @returns {{content:string,fileName:string}}
   */
  #getMapDataDownload(indent, type) {
    if (type === undefined) {
      type = hdom.getFormElementValue("download-type");
    }

    if (type === "gpx") {
      return {
        content: this.#getGPX(indent),
        fileName: "observations.gpx",
      };
    }

    const gj = this.#getGeoJSON();
    return {
      content: JSON.stringify(gj, undefined, indent),
      fileName: "observations.geojson",
    };
  }

  /**
   * @returns {{content:string,fileName:string}}
   */
  #getMapDownload() {
    return {
      content: JSON.stringify(this.#downloadData),
      fileName:
        this.#getMapMode() === "mt-pop"
          ? "populations.geojson"
          : "observations.geojson",
    };
  }

  /**
   * @returns {GeoJSON.FeatureCollection}
   */
  #getGeoJSON() {
    // If there is a boundary, include it in the GeoJSON.
    const params = this.#f1.getParams();
    /** @type {GeoJSON.Feature[]} */
    const features = params.boundary ? params.boundary.features : [];

    this.#addGeoJSONObservations(features);

    return { type: "FeatureCollection", features: features };
  }

  /**
   * @returns {GeoJSON.FeatureCollection<import("geojson").Point>}
   */
  #getGeoJSONPoints() {
    /** @type {GeoJSON.Feature<import("geojson").Point>[]} */
    const features = [];
    this.#addGeoJSONObservations(features);

    return { type: "FeatureCollection", features: features };
  }

  /**
   * @param {number|undefined} indent
   * @return {string}
   */
  #getGPX(indent) {
    const waypoints = [];
    for (const obs of this.#getSelectedObservations()) {
      const coords = obs.getCoordinatesGeoJSON();
      const waypoint = {
        _name: "wpt",
        _attrs: {
          lat: coords[1],
          lon: coords[0],
        },
        _content: {
          name: obs.getTaxonName(),
          desc: [
            obs.getObsDateString(),
            obs.getUserDisplayName(),
            obs.getURL(),
          ].join("\n"),
        },
      };
      waypoints.push(waypoint);
    }

    const json = {
      _name: "gpx",
      _attrs: {
        xmlns: "http://www.topografix.com/GPX/1/1",
        version: "1.1",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation":
          "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
        creator: "inat-tools",
      },
      _content: waypoints,
    };
    return jstoxml
      .toXML(json, {
        indent: typeof indent === "number" ? " ".repeat(indent) : undefined,
      })
      .trim();
  }

  /**
   * @param {import("../types.js").ParamsSpeciesFilter} params
   * @param {SummarizedResults} results
   * @param {string[]} [selectedTypes]
   */
  getINatObservationURL(params, results, selectedTypes) {
    /**
     * @param {string[]} selectedTypes
     */
    function getIDListURL(selectedTypes) {
      const selectedIDs = [];
      for (const obs of results.observations) {
        if (selectedTypes.includes(obs.getCoordType())) {
          selectedIDs.push(obs.getID());
        }
      }
      return InatURL.getObsIDLink(selectedIDs);
    }

    /**
     * @param {ObsDetailUI} ui
     */
    function showAll(ui) {
      const filter = new SpeciesFilter(params);
      const url = filter.getURL();
      if (!hdom.isChecked("branch")) {
        url.searchParams.set("lrank", ui.#getTaxonData().rank);
      }
      return url;
    }

    if (selectedTypes === undefined) {
      selectedTypes = this.getSelectedTypes();
    }

    if (params.boundary) {
      // If there's an arbitrary boundary, there's no way to tell iNaturalist.
      return getIDListURL(selectedTypes);
    }

    // If showing only observations with comments, use ID list.
    if (hdom.isChecked("comments")) {
      return getIDListURL(selectedTypes);
    }

    // If all types are selected, show everything.
    if (selectedTypes.length === ALL_COORD_TYPES.length) {
      return showAll(this);
    }

    // Figure out whether we can get the list using a query string or if we need a list of IDs.
    switch (this.getSelectedTypes(true).join(",")) {
      case "public": {
        const filter = new SpeciesFilter(params);
        const url = filter.getURL();
        if (!hdom.isChecked("branch")) {
          url.searchParams.set("lrank", this.#getTaxonData().rank);
        }
        url.searchParams.set("taxon_geoprivacy", "open");
        url.searchParams.set("geoprivacy", "open");
        return url;
      }
      default:
        return getIDListURL(selectedTypes);
    }
  }

  static async getInstance() {
    /** @type {import("../types.js").ParamsPageObsDetail} */
    let initArgs;
    try {
      initArgs = JSON.parse(
        decodeURIComponent(document.location.hash).substring(1),
      );
    } catch {
      initArgs = {};
    }

    const ui = new ObsDetailUI(initArgs);
    await ui.initInstance();
    return ui;
  }

  /**
   * @param {string} id
   * @returns {string}
   */
  getMembershipStatus(id) {
    if (!this.#project_members) {
      return "??";
    }
    const data = this.#project_members[id];
    if (!data) {
      return "no";
    }
    return data.role ? data.role : "yes";
  }

  /**
   * @param {SummarizedResults} results
   * @param {SelType[]} selectedTypes
   */
  static #getObsCount(results, selectedTypes) {
    return selectedTypes.reduce((c, t) => {
      return c + results.coordTypeCounts[t];
    }, 0);
  }

  /**
   * @param {UserSummary} userSumm
   * @param {number} count
   * @param {string[]} [selectedTypes]
   */
  getObserverINatLink(userSumm, count, selectedTypes) {
    if (count === 0) {
      return "0";
    }
    const params = this.#f1.getParams();
    params.user_id = userSumm.login;
    const url = this.getINatObservationURL(
      params,
      userSumm.results,
      selectedTypes,
    );
    if (url === "") {
      return count.toString();
    }
    return hdom.createLinkElement(url, count, {
      target: "_blank",
    });
  }

  /**
   * @param {boolean} [omitZeros]
   * @returns {SelArray}
   */
  getSelectedTypes(omitZeros = false) {
    /** @type {SelArray} */
    const types = [];
    for (const type of ALL_COORD_TYPES) {
      const id = "sel-" + type;
      if (
        hdom.isChecked(id) &&
        (!omitZeros || this.#summarizedResults.coordTypeCounts[type] > 0)
      ) {
        types.push(type);
      }
    }
    return types.length > 0 ? types : [...ALL_COORD_TYPES];
  }

  handleOptionChange() {
    if (!this.#rawResults) {
      return;
    }
    this.#summarizedResults = this.summarizeResults(this.#rawResults);
    this.updateDisplay();
  }

  async initInstance() {
    await super.init();

    // Add handlers for form.
    hdom.addEventListener("form", "submit", async (e) => {
      e.preventDefault();
      await this.onSubmit();
    });

    await this.initForm("f1", this.#f1);

    this.#initObsOptions();

    await this.onSubmit();
  }

  /**
   * @param {ObsDetailUI} ui
   * @returns {void}
   */
  onResize(ui) {
    const mode = getViewMode();
    switch (mode) {
      case "datehisto":
        {
          const svg = document.getElementById("svg-datehisto");
          if (!svg) {
            return;
          }
          const height = window.innerHeight - svg.getBoundingClientRect().top;
          svg.setAttribute("style", `height:${height}px;`);

          if (ui.#histo === undefined) {
            return;
          }

          ui.#histo.setHorizontalScale(
            // @ts-ignore
            svg.parentElement.clientWidth / svg.clientHeight,
          );
        }

        break;
      case "map":
        setMapHeight();
        break;
    }
  }

  async onSubmit() {
    this.#f1 = this.initFilterFromForm("f1") ?? new SpeciesFilter({});
    const api = this.getAPI();

    // Hide the display options.
    hdom.showElement("form-options", false);

    const taxonId = this.#f1.getTaxonID();
    if (!taxonId) {
      alert("You must specify a taxon.");
      hdom.setFocusTo("f1-taxon-name");
      return;
    }
    this.#taxon_id = parseInt(taxonId);
    this.#taxon_data = await api.getTaxonData(this.#taxon_id.toString());

    this.#rawResults = [];
    const results = await DataRetriever.getObservationData(
      api,
      this.#f1,
      this.getProgressReporter(),
    );
    if (!results) {
      // If retrieval failed, make sure the search form is displayed.
      this.showSearchForm();
      return;
    }
    this.#rawResults = results.map((r) => new INatObservation(r));
    this.#summarizedResults = this.summarizeResults(this.#rawResults);

    hdom.showElement("search-crit", false);
    hdom.removeChildren("results");

    // If a project is in the filter, retrieve project members.
    const projectID = this.#f1.getProjectID();
    if (projectID) {
      const members = await DataRetriever.getProjectMembers(
        api,
        projectID,
        this.getProgressReporter(),
      );
      this.#project_members = members ? {} : undefined;
      if (this.#project_members) {
        for (const member of members) {
          this.#project_members[member.user_id] = {
            role: member.role,
          };
        }
      }
    }

    // Show filter description.
    const resultsSummary = hdom.removeChildren("results-summary");
    const divDesc = hdom.createElement("div", {
      style: "flex:3;min-width:20rem",
    });
    divDesc.appendChild(
      document.createTextNode(await this.#f1.getDescription(api)),
    );
    resultsSummary.appendChild(divDesc);
    const link = getNeedsAttributeLink(this.#f1);
    if (link) {
      const divLink = hdom.createElement("div", {
        style: "flex:2;min-width:15rem;text-align:right",
      });
      divLink.appendChild(link);
      resultsSummary.appendChild(divLink);
    }
    resultsSummary.appendChild(
      this.createChangeFilterButton((e) => this.changeFilter(e)),
    );

    hdom.setCheckBoxState("comments", !!this.#hashParams.comments);

    if (
      this.#summarizedResults.coordTypeCounts["public"] === 0 &&
      this.#summarizedResults.coordTypeCounts["trusted"] === 0
    ) {
      hdom.enableElement("disp-map", false);
      hdom.enableElement("disp-mapdata", false);
    }
    window.onresize = () => this.onResize(this);

    // Select initial view.
    hdom.showElement("form-options", true);
    let view = this.#hashParams.view;
    const initialView = DISPLAY_OPTIONS.some((opt) => opt.id === view)
      ? hdom.getElement("disp-" + view)
      : hdom.getElement("disp-details");
    hdom.clickElement(
      initialView instanceof HTMLElement ? initialView : "disp-details",
    );
  }

  showDateHistogram() {
    const eResults = this.clearResults();

    const divHistoOptions = hdom.createElement("div", "section options");
    eResults.appendChild(divHistoOptions);

    const divTypeOptions = hdom.createElement("div", "flex");
    divHistoOptions.appendChild(divTypeOptions);
    const types = [
      {
        value: "date",
        label: "Date",
        handler: () => this.#setHistoType("date"),
      },
      {
        value: "year",
        label: "Year",
        handler: () => this.#setHistoType("year"),
      },
      {
        value: "time",
        label: "Time",
        handler: () => this.#setHistoType("time"),
      },
    ];
    for (const type of types) {
      divTypeOptions.appendChild(
        createRadioDiv(
          "histo-type",
          `hist-${type.value}`,
          type.value,
          type.label,
          type.handler,
        ),
      );
    }

    const downloadLink = createDownloadLink(
      this.getPathPrefix(),
      "Download Histogram",
      () => this.#getHistoDownload(),
    );
    divHistoOptions.appendChild(downloadLink);

    const hashMode = this.#hashParams.hist?.view;
    const histMode =
      hashMode === "time"
        ? "hist-time"
        : hashMode === "year"
          ? "hist-year"
          : "hist-date";
    hdom.clickElement(histMode);
  }

  showDetails() {
    const eResults = this.clearResults();
    const selectedTypes = this.getSelectedTypes();

    const cols = [
      DETAIL_COLS.OBS_DATE,
      DETAIL_COLS.TAXON,
      DETAIL_COLS.OBSERVER,
    ];
    // Don't include location column if all observations are obscured.
    if (selectedTypes.length > 1 || selectedTypes[0] !== "obscured") {
      cols.push(DETAIL_COLS.LOCATION);
    }
    cols.push(DETAIL_COLS.COORDS);
    if (this.#project_members) {
      cols.push(DETAIL_COLS.PROJECT);
    }
    if (hdom.isChecked("comments")) {
      cols.push(DETAIL_COLS.COMMENTS);
    }

    const eTable = ColDef.createTable(cols);

    const tbody = hdom.createElement("tbody");
    eTable.appendChild(tbody);

    for (const obs of this.#getSelectedObservations()) {
      tbody.appendChild(ColDef.createRow(obs, cols, [this]));
    }

    this.#wrapResults(eResults, eTable);
  }

  showMap() {
    const eResults = this.clearResults();

    removeObscured();

    const divMapOptions = hdom.createElement("div", "section options");
    eResults.appendChild(divMapOptions);

    const options = Object.entries(MAP_SOURCES).map((source) => {
      return { value: source[0], label: source[1].label };
    });
    const selectSource = hdom.createSelectElement("map-source", options);
    divMapOptions.appendChild(selectSource);

    const divPopOptions = hdom.createElement("div", {
      id: "mt-pop-options",
    });
    divMapOptions.appendChild(divPopOptions);
    divPopOptions.appendChild(
      createTextInputDiv(
        {
          id: "mt-pop-distance",
          type: "number",
          required: "",
          step: ".01",
          inputmode: "numeric",
          min: 0.01,
          max: 10,
          style: "width:4rem",
          value: this.#hashParams.map?.maxdist ?? 1,
        },
        "Max distance (km)",
      ),
    );

    const divTypeOptions = hdom.createElement("div", "flex");
    divMapOptions.appendChild(divTypeOptions);
    const types = [
      {
        value: "obs",
        label: "Observations",
        handler: () => this.#setMapTypeObs(map, gj),
      },
      {
        value: "pop",
        label: "Populations",
        handler: () => this.#setMapTypePop(map, gj),
      },
    ];
    for (const type of types) {
      divTypeOptions.appendChild(
        createRadioDiv(
          "map-type",
          `mt-${type.value}`,
          type.value,
          type.label,
          type.handler,
        ),
      );
    }
    const dlLink = createDownloadLink(this.getPathPrefix(), "Download", () =>
      this.#getMapDownload(),
    );
    divTypeOptions.appendChild(dlLink);

    const divMap = hdom.createElement("div", {
      class: "section",
      id: "map",
    });
    eResults.appendChild(divMap);
    setMapHeight();

    const source = this.#hashParams.map?.source ?? DEFAULT_MAP_SOURCE;
    const map = new Map(source);
    const gj = this.#getGeoJSONPoints();
    map.fitBounds(gj);

    hdom.setFormElementValue(selectSource, source);
    selectSource.addEventListener("change", () => {
      this.#updateHash();
      map.setSource(hdom.getFormElementValue(selectSource));
    });

    hdom.addEventListener("mt-pop-distance", "change", () =>
      this.#debounce(() => this.#setMapTypePop(map, gj)),
    );
    const mapMode = this.#getMapMode();
    hdom.clickElement(mapMode);
  }

  showMapData() {
    const eResults = this.clearResults();

    removeObscured();

    const eButtons = hdom.createElement("div", {
      class: "section flex-fullwidth",
    });

    const typeDiv = hdom.createElement("div", "form-input");
    const dlOptions = hdom.createSelectElementWithLabel(
      "download-type",
      "Format:",
      [
        { value: "geojson", label: "GeoJSON" },
        { value: "gpx", label: "GPX" },
      ],
    );
    for (const child of Object.values(dlOptions)) {
      typeDiv.appendChild(child);
    }
    const dlLink = createDownloadLink(this.getPathPrefix(), "Download", () =>
      this.#getMapDataDownload(),
    );
    const dlDiv = hdom.createElement("div", "buttons");
    dlDiv.appendChild(typeDiv);
    dlDiv.appendChild(dlLink);
    eButtons.appendChild(dlDiv);

    const urlGJ = new URL("https://geojson.io");
    urlGJ.hash =
      "data=data:application/json," +
      encodeURIComponent(
        this.#getMapDataDownload(undefined, "geojson").content,
      );
    const eBtnGeoJSONIO = hdom.createLinkElement(urlGJ, "View at geojson.io", {
      id: "geojson-io-link",
      target: "_blank",
    });
    eButtons.appendChild(eBtnGeoJSONIO);

    eResults.appendChild(eButtons);
    hdom.addEventListener("download-type", "change", () =>
      this.#updateGeoJSONFormat(),
    );

    const eDivText = hdom.createElement("div", { class: "section" });
    const textarea = hdom.createElement("textarea", {
      id: "geojson-value",
      rows: 15,
    });
    eDivText.appendChild(textarea);
    eResults.appendChild(eDivText);

    this.#updateGeoJSONFormat();
  }

  showUserSumm() {
    const eResults = this.clearResults();
    const selectedTypes = this.getSelectedTypes();

    // Summarize results.
    const summary = this.#getUserSummary();
    const sortedSummary = Object.values(summary).sort(
      (a, b) =>
        ObsDetailUI.#getObsCount(b.results, selectedTypes) -
        ObsDetailUI.#getObsCount(a.results, selectedTypes),
    );

    const cols = [SUMMARY_COLS.OBSERVER];
    const csvCols = [SUMMARY_COLS.OBSERVER_LOGIN, SUMMARY_COLS.OBSERVER_NAME];
    if (selectedTypes.length > 1) {
      cols.push(SUMMARY_COLS.NUM_OBS);
      csvCols.push(SUMMARY_COLS.NUM_OBS);
    }
    if (selectedTypes.includes("public")) {
      cols.push(SUMMARY_COLS.NUM_PUBLIC);
      csvCols.push(SUMMARY_COLS.NUM_PUBLIC);
    }
    if (selectedTypes.includes("trusted")) {
      cols.push(SUMMARY_COLS.NUM_TRUSTED);
      csvCols.push(SUMMARY_COLS.NUM_TRUSTED);
    }
    if (selectedTypes.includes("obscured")) {
      cols.push(SUMMARY_COLS.NUM_OBSCURED);
      csvCols.push(SUMMARY_COLS.NUM_OBSCURED);
    }
    if (this.#project_members) {
      cols.push(SUMMARY_COLS.PROJECT);
      csvCols.push(SUMMARY_COLS.PROJECT);
    }
    const eTable = ColDef.createTable(cols);

    const tbody = hdom.createElement("tbody");
    eTable.appendChild(tbody);

    for (const userSumm of sortedSummary) {
      // Only show rows with something to display.
      if (
        ALL_COORD_TYPES.some(
          (t) =>
            selectedTypes.includes(t) && userSumm.results.coordTypeCounts[t],
        )
      ) {
        tbody.appendChild(ColDef.createRow(userSumm, cols, [this]));
      }
    }

    const divHeader = hdom.createElement("div", "center");
    hdom.setTextValue(divHeader, "Download ");
    const downloadLink = createDownloadLink(
      this.getPathPrefix(),
      "Download CSV",
      () => {
        return {
          content: ColDef.getCSVData(sortedSummary, csvCols, this),
          fileName: "species.csv",
        };
      },
    );
    divHeader.appendChild(downloadLink);

    const divUserSumm = hdom.createElement("div", "section");
    divUserSumm.appendChild(divHeader);
    divUserSumm.appendChild(eTable);
    eResults.appendChild(divUserSumm);
  }

  /**
   * @param {import("../types.js").INatObservation[]} rawResults
   * @returns {SummarizedResults}
   */
  summarizeResults(rawResults) {
    const taxon_data = this.#getTaxonData();
    const taxonSummary = {
      taxon_id: taxon_data.id,
      rank: taxon_data.rank,
      coordTypeCounts: { public: 0, trusted: 0, obscured: 0 },
      /** @type {INatObservation[]} */ observations: [],
    };

    const includeComments = hdom.isChecked("comments");
    const includeDescendants = hdom.isChecked("branch");

    for (const result of rawResults) {
      if (!includeDescendants && result.getTaxonID() !== this.#taxon_id) {
        continue;
      }

      if (
        includeComments &&
        !result.hasComments() &&
        !result.hasDescription()
      ) {
        continue;
      }

      const ct = result.getCoordType();
      if (hdom.isChecked(`sel-${ct}`)) {
        taxonSummary.observations.push(result);
      }
      taxonSummary.coordTypeCounts[ct]++;
    }

    return taxonSummary;
  }

  updateDisplay() {
    this.#updateOptions();

    switch (getViewMode()) {
      case "datehisto":
        this.showDateHistogram();
        break;
      case "map":
        this.showMap();
        break;
      case "mapdata":
        this.showMapData();
        break;
      case "usersumm":
        this.showUserSumm();
        break;
      default:
        this.showDetails();
        break;
    }

    // Update view in iNaturalist target.
    this.#updateViewInINaturalistLink();

    // Make sure all checkboxes are checked.
    const ct = this.getSelectedTypes();
    for (const type of ALL_COORD_TYPES) {
      const cb = document.getElementById(`sel-${type}`);
      if (cb instanceof HTMLInputElement) {
        cb.checked = ct.includes(type);
      }
    }

    // Save current settings for bookmark.
    this.#updateHash();
  }

  /**
   * @param {import("geojson").Feature[]} features
   */
  #addGeoJSONObservations(features) {
    /**
     * @param {INatObservation} obs
     * @returns {Object<string,any>}
     */
    function propsDefault(obs) {
      const accuracy = obs.getAccuracy();
      /** @type {Object<string,any>} */
      const props = {
        id: obs.getID(),
        taxon_name: obs.getTaxonName(),
        url: obs.getURL(),
        date: obs.getObsDateString(),
        observer: obs.getUserDisplayName(),
        is_public: obs.getCoordType() === "public",
      };
      if (accuracy !== undefined) {
        props.accuracy = accuracy;
      }
      return props;
    }

    const fnProps = propsDefault;

    for (const obs of this.#getSelectedObservations()) {
      const properties = fnProps(obs);
      /** @type {GeoJSON.Feature<import("geojson").Point>} */
      const feature = {
        type: "Feature",
        properties: properties,
        geometry: {
          type: "Point",
          coordinates: obs.getCoordinatesGeoJSON(),
        },
      };
      features.push(feature);
    }
  }

  /**
   * @param {function} fn
   */
  #debounce(fn) {
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(fn, 500);
  }

  /**
   * @returns {"mt-obs"|"mt-pop"}
   */
  #getMapMode() {
    return this.#hashParams.map && this.#hashParams.map.view === "pop"
      ? "mt-pop"
      : "mt-obs";
  }

  /**
   * @returns {INatObservation[]}
   */
  #getSelectedObservations() {
    const selectedTypes = this.getSelectedTypes();

    return this.#summarizedResults.observations.filter((obs) =>
      selectedTypes.includes(obs.getCoordType()),
    );
  }

  #getTaxonData() {
    if (!this.#taxon_data) {
      throw new Error();
    }
    return this.#taxon_data;
  }

  /**
   * @returns {Object<string,UserSummary>}
   */
  #getUserSummary() {
    /** @type {Object<string,UserSummary>|undefined} */
    const userSummary = {};

    for (const obs of this.#summarizedResults.observations) {
      const id = obs.getUserID();
      let userSumm = userSummary[id];
      if (!userSumm) {
        userSumm = {
          id: id,
          login: obs.getUserLogin(),
          display_name: obs.getUserDisplayName(),
          results: {
            observations: [],
            coordTypeCounts: { public: 0, trusted: 0, obscured: 0 },
          },
        };
        userSummary[id] = userSumm;
      }
      userSumm.results.coordTypeCounts[obs.getCoordType()]++;

      userSumm.results.observations.push(obs);
    }

    return userSummary;
  }

  #initObsOptions() {
    /**
     * @param {string} value
     * @param {string} label
     * @param {ObsDetailUI} ui
     */
    function addDisplayOption(value, label, ui) {
      const id = "disp-" + value;
      const div = createRadioDiv("displayopt", id, value, label, () =>
        ui.updateDisplay(),
      );
      radios.appendChild(div);
    }

    const divIncludeOpts = hdom.createElement("div", "options");
    const form = hdom.getElement(OPTIONS_FORM_ID);

    form.appendChild(divIncludeOpts);

    const checkBoxes = hdom.createElement("div", {
      id: "coordoptions",
    });
    divIncludeOpts.appendChild(checkBoxes);
    ALL_COORD_TYPES.forEach((type) => {
      checkBoxes.appendChild(
        createCheckBoxDiv(
          `sel-${type}`,
          type,
          this.#hashParams.coords === undefined ||
            this.#hashParams.coords.includes(type),
          () => this.handleOptionChange(),
        ),
      );
    });

    divIncludeOpts.appendChild(
      createCheckBoxDiv(
        "comments",
        "Show comments",
        !!this.#hashParams.comments,
        () => this.handleOptionChange(),
      ),
    );

    divIncludeOpts.appendChild(
      createCheckBoxDiv(
        "branch",
        "Show descendants",
        !!this.#hashParams.branch,
        () => this.handleOptionChange(),
      ),
    );

    const radios = hdom.createElement("div", {
      class: "displayoptions",
    });
    DISPLAY_OPTIONS.forEach((opt) => addDisplayOption(opt.id, opt.label, this));

    const iNatDiv = hdom.createElement("div", "right");
    iNatDiv.appendChild(
      hdom.createLinkElement("", "View in iNaturalist", {
        target: "_blank",
        id: "viewininat",
      }),
    );

    const optionDiv = hdom.createElement("div", { class: "options" });
    optionDiv.appendChild(radios);
    optionDiv.appendChild(iNatDiv);
    form.appendChild(optionDiv);
  }

  /**
   * @param {"date"|"time"|"year"} type
   */
  #setHistoType(type) {
    // Delete current histogram if present.
    const e = document.getElementById("svg-datehisto");
    if (e) {
      e.remove();
    }
    const eResults = hdom.getElement("results");
    const iNatURL = this.getINatObservationURL(
      this.#f1.getParams(),
      this.#summarizedResults,
    ).toString();

    switch (type) {
      case "time":
        this.#histo = new HistoTime(
          eResults,
          this.#getSelectedObservations(),
          iNatURL,
        );
        break;
      case "year":
        this.#histo = new HistoYear(
          eResults,
          this.#getSelectedObservations(),
          iNatURL,
        );
        break;
      default:
        this.#histo = new HistoDate(
          eResults,
          this.#getSelectedObservations(),
          iNatURL,
        );
        break;
    }

    const svg = this.#histo.getSVG();
    svg.setAttribute("id", "svg-datehisto");
    this.onResize(this);

    this.#updateHash();
  }

  /**
   * @param {Map} map
   * @param {import("geojson").FeatureCollection} gj
   */
  #setMapTypeObs(map, gj) {
    hdom.showElement("mt-pop-options", false);
    map.clearFeatures();
    map.addObservations(gj);
    this.#downloadData = gj;
    this.#updateHash();
  }

  /**
   * @param {Map} map
   * @param {import("geojson").FeatureCollection<import("geojson").Point>} gj
   */
  #setMapTypePop(map, gj) {
    hdom.showElement("mt-pop-options", true);
    hdom.setFocusTo("mt-pop-distance");
    map.clearFeatures();

    const distance = getPopDistance();

    const clusterer = new Clusterer();
    const clustered = clusterer.cluster(gj, distance);
    const bordered = clusterer.addBorders(clustered, distance);

    map.addObservations(bordered);
    this.#downloadData = bordered;
    this.#updateHash();
  }

  #updateGeoJSONFormat() {
    hdom.setFormElementValue(
      "geojson-value",
      this.#getMapDataDownload(2).content,
    );

    // Update links based on selected type.
    switch (hdom.getFormElementValue("download-type")) {
      case "gpx":
        hdom.showElement("geojson-io-link", false);
        break;
      case "geojson":
        hdom.showElement("geojson-io-link", true);
        break;
    }
  }

  #updateHash() {
    /** @type {import("../types.js").ParamsPageObsDetail} */
    const params = {
      f1: this.#f1.getParams(),
      view: getViewMode(),
    };
    // Only save the coordinate types if some of the non-zero types are unchecked.
    if (
      ALL_COORD_TYPES.some(
        (t) =>
          this.#summarizedResults.coordTypeCounts[t] > 0 &&
          !hdom.isChecked(`sel-${t}`),
      )
    ) {
      params.coords = this.getSelectedTypes(true);
    }
    if (hdom.isChecked("comments")) {
      params.comments = true;
    }
    if (hdom.isChecked("branch")) {
      params.branch = true;
    }
    if (params.view === "datehisto") {
      params.hist = {};
      if (hdom.isChecked("hist-time")) {
        params.hist.view = "time";
      } else if (hdom.isChecked("hist-year")) {
        params.hist.view = "year";
      }
      if (Object.keys(params.hist).length === 0) {
        delete params.hist;
      }
    } else if (params.view === "map") {
      params.map = {};
      const source = hdom.getFormElementValue("map-source");
      if (source !== DEFAULT_MAP_SOURCE) {
        params.map.source = source;
      }
      if (hdom.isChecked("mt-pop")) {
        params.map.view = "pop";
        params.map.maxdist = getPopDistance();
      }
      if (Object.keys(params.map).length === 0) {
        delete params.map;
      }
    }
    this.#hashParams = params;
    document.location.hash = JSON.stringify(params);
  }

  #updateOptions() {
    /**
     * @param {number} count
     * @param {SelType} name
     */
    function addBucket(count, name) {
      const id = "sel-" + name;
      const cb = hdom.getElement(id);
      const label = hdom.getElement(`${id}-label`);
      hdom.setTextValue(label, `${count} ${name}`);
      hdom.setCheckBoxState(cb, selArray.includes(name));
      hdom.enableElement(cb, numTypes > 1);
      if (cb.parentElement) {
        hdom.showElement(cb.parentElement, count > 0);
      }
    }

    const selArray = this.getSelectedTypes();
    const r = this.#summarizedResults;
    const numTypes = ALL_COORD_TYPES.reduce(
      (count, t) =>
        count + Math.sign(this.#summarizedResults.coordTypeCounts[t]),
      0,
    );
    ALL_COORD_TYPES.forEach((t) =>
      addBucket(this.#summarizedResults.coordTypeCounts[t], t),
    );

    // Disable "Show comments" if none have comments.
    hdom.enableElement(
      "comments",
      r.observations.some((obs) => obs.getComments().length > 0),
    );
  }

  #updateViewInINaturalistLink() {
    const url = this.getINatObservationURL(
      this.#f1.getParams(),
      this.#summarizedResults,
    );
    /** @type {HTMLAnchorElement} */
    const link = hdom.getElement("viewininat");
    link.inert = url === "";
    link.href = url.toString();
  }

  /**
   * @param {Element} eResultsDiv
   * @param {Element} eResultDetail
   */
  #wrapResults(eResultsDiv, eResultDetail) {
    const section = hdom.createElement("div", "section");
    section.appendChild(eResultDetail);
    eResultsDiv.appendChild(section);
  }
}

/**
 * @param {string} id
 * @param {string} label
 * @param {boolean} checked
 * @param {import("../lib/searchui.js").FnClickListener} fnClickHandler
 * @returns {HTMLElement}
 */
function createCheckBoxDiv(id, label, checked, fnClickHandler) {
  const div = hdom.createElement("div", "checkbox");
  const cb = hdom.createCheckBox(id, checked);
  hdom.addEventListener(cb, "click", fnClickHandler);
  div.appendChild(cb);
  div.appendChild(hdom.createLabelElement(id, label, { id: `${id}-label` }));
  return div;
}

/**
 * @param {string} name
 * @param {string} id
 * @param {string} value
 * @param {string} label
 * @param {import("../lib/searchui.js").FnClickListener} [fnClickHandler]
 * @returns {HTMLElement}
 */
function createRadioDiv(name, id, value, label, fnClickHandler) {
  const div = hdom.createElement("div", "radio");
  const rb = hdom.createInputElement({
    type: "radio",
    id: id,
    value: value,
    name: name,
  });
  const lbl = hdom.createLabelElement(id, label);
  div.appendChild(rb);
  div.appendChild(lbl);
  if (fnClickHandler) {
    hdom.addEventListener(rb, "click", fnClickHandler);
  }
  return div;
}

/**
 * @param {Object<string,string|number>} attributes
 * @param {string} label
 * @returns {HTMLElement}
 */
function createTextInputDiv(attributes, label) {
  const div = hdom.createElement("div", "textinput");
  const text = hdom.createInputElement(attributes);
  const lbl = hdom.createLabelElement(attributes.id.toString(), label);
  div.appendChild(lbl);
  div.appendChild(text);
  return div;
}

/**
 * @param {SpeciesFilter} filter
 * @returns {Element|undefined}
 */
function getNeedsAttributeLink(filter) {
  /**
   * @param {SpeciesFilter} filter
   * @param {string} termID
   * @param {string} descrip
   */
  function getLink(filter, termID, descrip) {
    const params = filter.getParams();
    delete params.annotations;
    delete params.quality_grade;
    const url = new URL("https://www.inaturalist.org/observations/identify");
    url.searchParams.set("reviewed", "any");
    url.searchParams.set("quality_grade", "needs_id,research");
    url.searchParams.set("without_term_id", termID);
    filter = new SpeciesFilter(params);
    const link = hdom.createLinkElement(
      filter.getURL(url),
      `Observations with no ${descrip} annotation`,
      { target: "_blank" },
    );
    const div = hdom.createElement("div");
    div.appendChild(link);
    return div;
  }

  const annotations = filter.getAnnotations();
  if (annotations) {
    for (const annotation of annotations) {
      switch (annotation.type) {
        case "ev-mammal":
          return getLink(filter, "22", "evidence of presence");
        case "plants":
          return getLink(filter, "12", "plant phenology");
      }
    }
  }
}

function getPopDistance() {
  return parseFloat(hdom.getFormElementValue("mt-pop-distance"));
}

/**
 * @returns {import("../types.js").EnumObsDetailView}
 */
function getViewMode() {
  const radioVal = hdom.getFormElementValue(
    hdom.getFormElement(OPTIONS_FORM_ID, "displayopt"),
  );
  switch (radioVal) {
    case "datehisto":
    case "mapdata":
    case "map":
    case "usersumm":
      return radioVal;
  }
  return "details";
}

function removeObscured() {
  const ePublic = hdom.getElement("sel-public");
  const eTrusted = hdom.getElement("sel-trusted");
  const eObscured = hdom.getElement("sel-obscured");

  // If neither public nor trusted is checked, check them before unchecking obscured.
  if (
    (!ePublic || !hdom.isChecked(ePublic)) &&
    (!eTrusted || !hdom.isChecked(eTrusted))
  ) {
    if (ePublic) hdom.setCheckBoxState(ePublic, true);
    if (eTrusted) hdom.setCheckBoxState(eTrusted, true);
  }
  if (eObscured) {
    hdom.setCheckBoxState("sel-obscured", false);
  }
}

function setMapHeight() {
  const divMap = hdom.getElement("map");
  divMap.style.setProperty(
    "height",
    `${window.screen.availHeight - divMap.offsetTop - 8}px`,
  );
}

(async function () {
  await ObsDetailUI.getInstance();
})();
