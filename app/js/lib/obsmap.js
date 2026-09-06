import L from "leaflet";
import * as turf from "@turf/turf";
import { InatURL } from "./inaturl.js";
import { GJTools } from "./geojson.js";
import { hdom } from "@htmltools/hdom";

/**
 * @typedef {{label:string,url:string,attribution:string}} MapSource
 * @callback FnMapPopupHandler
 * @param {Object<string,any>} properties
 */

export const DEFAULT_MAP_SOURCE = "stadia";

/** @type {Object<string,MapSource>}> */
export const MAP_SOURCES = {
  geoapifycarto: {
    label: "Geoapify Carto",
    url: "https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?&apiKey=8acd76429dee413f8ebe45219867d721",
    attribution:
      'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | © OpenStreetMap <a href="https://www.openstreetmap.org/copyright" target="_blank">contributors</a>',
  },
  openstreetmap: {
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },
  opentopomap: {
    label: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>) | © OpenStreetMap <a href="https://www.openstreetmap.org/copyright" target="_blank">contributors</a>',
  },
  stadia: {
    label: "Stadia",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },
};

export class ObsMap {
  #map;
  /** @type {import("leaflet").TileLayer|undefined} */
  #tileLayer;
  /** @type {import("leaflet").GeoJSON|undefined} */
  #featureLayer;
  #fnPopupHandler;

  /**
   * @param {string} source
   * @param {FnMapPopupHandler} fnPopupHandler
   */
  constructor(source, fnPopupHandler) {
    this.#map = L.map("map");
    this.setSource(source);
    this.#fnPopupHandler = fnPopupHandler;
  }

  /**
   * @param {GeoJSON.FeatureCollection} gj
   */
  addObservations(gj) {
    /**
     * @param {Object<string,any>} properties
     * @param {ObsMap} map
     * @returns {HTMLElement}
     */
    function createPolygonPopup(properties, map) {
      const div = hdom.createElement("div");
      for (const property of [
        "taxon_name",
        "observations",
        "pop_num",
        "hectares",
        "cluster",
      ]) {
        switch (property) {
          case "cluster":
            hdom.appendTextValue(div, `Cluster ${properties.cluster}`);
            break;
          case "hectares":
            hdom.appendTextValue(div, `${properties.hectares} hectares`);
            break;
          case "observations":
            {
              /**
               * @type {import("geojson").Feature<import("geojson").Point>[]}
               */
              const observations = properties.observations;
              const ids = observations.map((obs) =>
                GJTools.getProperty(obs, "id"),
              );
              const allPublic = observations.every((obs) =>
                GJTools.getProperty(obs, "is_public"),
              );
              const url = InatURL.getObsIDLink(
                ids,
                allPublic ? "map" : "table",
              );
              div.appendChild(
                hdom.createLinkElement(
                  url,
                  `${properties.observations.length} observations`,
                  { target: "_blank" },
                ),
              );
            }
            break;
          case "pop_num":
            hdom.appendTextValue(
              div,
              `Population #${properties.pop_num} of ${maxPopNum}`,
            );
            break;
          case "taxon_name":
            if (properties.taxon_name) {
              hdom.appendTextValue(div, `${properties.taxon_name}`);
            }
            break;
          default:
            continue;
        }
        div.appendChild(hdom.createElement("br"));
      }

      // Add a link to zoom to these observations.
      const link = hdom.createLinkElement("", "Zoom to these observations");
      link.addEventListener("click", (e) => {
        e.preventDefault();
        /** @type {import("geojson").Feature<import("geojson").Point>[]} */
        const observations = properties.observations;
        const fc = turf.featureCollection(observations);
        map.closePopups();
        map.fitBounds(fc);
      });
      div.appendChild(link);

      return div;
    }

    /**
     * @param {import("leaflet").Layer} layer
     * @param {ObsMap} map
     * @returns {HTMLElement}
     */
    function popup(layer, map) {
      /** @type {import("geojson").Feature} */
      // @ts-ignore
      const feature = layer.feature;
      /** @type {Object<string,any>} */
      const properties = feature.properties ?? {};
      switch (feature.geometry.type) {
        case "Point":
          return map.#fnPopupHandler(properties);
      }
      return createPolygonPopup(properties, map);
    }

    /** Find the largest population number. */
    const maxPopNum = gj.features.reduce((n, f) => {
      if (
        f.geometry.type === "Polygon" &&
        f.properties &&
        f.properties.pop_num > n
      ) {
        return f.properties.pop_num;
      }
      return n;
    }, 0);

    this.#featureLayer = L.geoJSON(gj, {
      pointToLayer: (f, latLng) => {
        if (maxPopNum > 0 && f.properties.dbscan === "noise") {
          const accuracy = f.properties.accuracy;
          const color = accuracy === undefined ? "orange" : "red";
          const radius =
            6 + (accuracy === undefined ? 0 : Math.min(accuracy, 1000) / 50);
          return L.circleMarker(latLng, {
            radius: radius,
            fillOpacity: 0.3,
            color: "none",
            fillColor: color,
          });
        }
        return L.marker(latLng);
      },
    }).bindPopup((layer) => popup(layer, this));
    this.#featureLayer.addTo(this.#map);
  }

  clearFeatures() {
    if (this.#featureLayer) {
      this.#featureLayer.clearLayers();
    }
  }

  closePopups() {
    this.#map.closePopup();
  }

  /**
   * @param {GeoJSON.FeatureCollection} gj
   */
  fitBounds(gj) {
    this.#map.fitBounds(L.geoJSON(gj).getBounds());
  }

  /**
   * @param {string} id
   */
  setSource(id) {
    let source = MAP_SOURCES[id];
    if (!source) {
      console.warn(`map source "${id}" not found; using default source`);
      source = MAP_SOURCES[DEFAULT_MAP_SOURCE];
    }
    if (this.#tileLayer) {
      this.#map.removeLayer(this.#tileLayer);
    }
    this.#tileLayer = L.tileLayer(source.url, {
      attribution: source.attribution,
    });
    this.#tileLayer.addTo(this.#map);
  }
}
