import L from "leaflet";
import { hdom } from "./hdom.js";

export class Map {
    #map;

    constructor() {
        this.#map = L.map("map");
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.#map);
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
            console.log(properties);
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
}
