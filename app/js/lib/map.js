import * as turf from "@turf/turf";
import L from "leaflet";

export class Map {
    #map;

    constructor() {
        this.#map = L.map("map").setView([51.505, -0.09], 13);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.#map);
    }

    /**
     * @param {GeoJSON.FeatureCollection} gj
     */
    fitBounds(gj) {
        const bbox = turf.bbox(gj);
        this.#map.fitBounds(
            L.latLngBounds(
                L.latLng(bbox[1], bbox[0]),
                L.latLng(bbox[3], bbox[2]),
            ),
        );
    }
}
