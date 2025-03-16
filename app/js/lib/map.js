import L from "leaflet";
import { hdom } from "./hdom.js";

/**
 * @typedef {{label:string,url:string,attribution:string}} MapSource
 */

/** @type {Object<string,MapSource}> */
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
};

export class Map {
    #map;
    /** @type {import("leaflet").TileLayer|undefined} */
    #tileLayer;

    constructor() {
        this.#map = L.map("map");
        this.setSource("geoapifycarto");
    }

    /**
     * @param {GeoJSON.FeatureCollection} gj
     */
    addObservations(gj) {
        /**
         * @param {import("leaflet").Layer} layer
         * @returns {HTMLElement}
         */
        function popup(layer) {
            /** @type {import("geojson").Feature} */
            // @ts-ignore
            const feature = layer.feature;
            const properties = feature.properties;
            const div = hdom.createElement("div");
            let first = true;
            for (const property of ["taxon_name", "date", "observer"]) {
                if (!properties) {
                    continue;
                }
                if (!first) {
                    div.appendChild(hdom.createElement("br"));
                }
                first = false;
                switch (property) {
                    case "taxon_name":
                        div.appendChild(
                            hdom.createLinkElement(
                                properties.url,
                                properties.taxon_name,
                                { target: "_blank" },
                            ),
                        );
                        break;
                    default:
                        hdom.appendTextValue(div, properties[property]);
                        break;
                }
            }
            return div;
        }
        L.geoJSON(gj).bindPopup(popup).addTo(this.#map);
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
        const source = MAP_SOURCES[id];
        if (!source) {
            console.warn(`map source "${id}" not found`);
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
