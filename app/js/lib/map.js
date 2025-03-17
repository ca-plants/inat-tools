import L from "leaflet";
import { hdom } from "./hdom.js";

/**
 * @typedef {{label:string,url:string,attribution:string}} MapSource
 */

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

export class Map {
    #map;
    /** @type {import("leaflet").TileLayer|undefined} */
    #tileLayer;
    /** @type {import("leaflet").GeoJSON|undefined} */
    #featureLayer;

    /**
     * @param {string} source
     */
    constructor(source) {
        this.#map = L.map("map");
        this.setSource(source);
    }

    /**
     * @param {GeoJSON.FeatureCollection} gj
     */
    addObservations(gj) {
        /**
         * @param {HTMLElement} div
         * @param {import("geojson").GeoJsonProperties} properties
         */
        function createPointPopup(div, properties) {
            let first = true;
            for (const property of [
                "taxon_name",
                "date",
                "observer",
                "accuracy",
                "cluster",
            ]) {
                if (!properties || properties[property] === undefined) {
                    continue;
                }
                if (!first) {
                    div.appendChild(hdom.createElement("br"));
                }
                first = false;
                switch (property) {
                    case "accuracy":
                        hdom.appendTextValue(
                            div,
                            `Accuracy ${properties.accuracy} meters`,
                        );
                        break;
                    case "cluster":
                        hdom.appendTextValue(
                            div,
                            `Cluster ${properties.cluster}`,
                        );
                        break;
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
        }

        /**
         * @param {HTMLElement} div
         * @param {import("geojson").GeoJsonProperties} properties
         */
        function createPolygonPopup(div, properties) {
            let first = true;
            for (const property of ["pop_num", "hectares", "cluster"]) {
                if (!properties) {
                    continue;
                }
                if (!first) {
                    div.appendChild(hdom.createElement("br"));
                }
                first = false;
                switch (property) {
                    case "cluster":
                        hdom.appendTextValue(
                            div,
                            `Cluster ${properties.cluster}`,
                        );
                        break;
                    case "hectares":
                        hdom.appendTextValue(
                            div,
                            `${properties.hectares} hectares`,
                        );
                        break;
                    case "pop_num":
                        hdom.appendTextValue(
                            div,
                            `Population #${properties.pop_num + 1} of ${maxPopNum + 1}`,
                        );
                        break;
                }
            }
            1;
        }

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
            switch (feature.geometry.type) {
                case "Point":
                    createPointPopup(div, properties);
                    break;
                case "Polygon":
                    createPolygonPopup(div, properties);
                    break;
            }
            return div;
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
        }, -1);

        this.#featureLayer = L.geoJSON(gj, {
            pointToLayer: (f, latLng) => {
                if (maxPopNum >= 0 && f.properties.dbscan === "noise") {
                    const accuracy = f.properties.accuracy;
                    const color = accuracy === undefined ? "orange" : "red";
                    const radius =
                        6 +
                        (accuracy === undefined
                            ? 0
                            : Math.min(accuracy, 1000) / 50);
                    return L.circleMarker(latLng, {
                        radius: radius,
                        opacity: 0.75,
                        color: "none",
                        fillColor: color,
                    });
                }
                return L.marker(latLng);
            },
        }).bindPopup(popup);
        this.#featureLayer.addTo(this.#map);
    }

    clearFeatures() {
        if (this.#featureLayer) {
            this.#featureLayer.clearLayers();
        }
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
