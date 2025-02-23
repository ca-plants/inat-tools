import whichPolygon from "which-polygon";
import * as turf from "@turf/turf";

export class Clusterer {
    /**
     * @param {import("geojson").FeatureCollection} geojson
     * @param {import("geojson").GeoJsonProperties} [properties={}]
     * @returns {import("geojson").FeatureCollection}
     */
    addBorders(geojson, properties = {}) {
        /** @type {import("geojson").Feature[]} */
        const unClusteredPoints = [];
        /** @type {import("geojson").Feature[]} */
        const newPolygons = [];

        /** @type {Map<number,import("geojson").Feature<GeoJSON.Point>[]>} */
        const clusters = new Map();
        turf.featureEach(geojson, (point) => {
            if (!point.properties || point.geometry.type !== "Point") {
                return;
            }
            if (typeof point.properties.cluster === "number") {
                let clusterPoints = clusters.get(point.properties.cluster);
                if (!clusterPoints) {
                    clusterPoints = [];
                    clusters.set(point.properties.cluster, clusterPoints);
                }
                // @ts-ignore
                clusterPoints.push(point);
            } else {
                unClusteredPoints.push(point);
            }
        });

        for (const [cluster_num, clusterPoints] of clusters.entries()) {
            const fc = turf.featureCollection(clusterPoints);
            const border = turf.concave(fc, { maxEdge: 1 });
            if (!border) {
                continue;
            }

            /** @type {import("geojson").Feature[]} */
            let polygons = [];
            switch (border.geometry.type) {
                case "Polygon":
                    polygons = [border];
                    break;
                case "MultiPolygon":
                    polygons = turf.polygons(
                        border.geometry.coordinates,
                    ).features;
                    break;
            }

            polygons.forEach((p) => {
                p.properties = {
                    cluster: cluster_num,
                };
            });
            newPolygons.push(...polygons);
        }

        newPolygons.forEach((p, index) => {
            p.properties = {
                ...p.properties,
                hectares: turf
                    .convertArea(turf.area(p), "meters", "hectares")
                    .toFixed(2),
                pop_num: index,
                ...properties,
            };
        });

        const outsidePoints = this.#findClusteredPointsOutsideOfPolygons(
            newPolygons,
            clusters,
        );

        /** @type {import("geojson").Feature[]} */
        const features = [
            ...newPolygons,
            ...unClusteredPoints,
            ...outsidePoints,
        ];

        return turf.featureCollection(features);
    }

    /**
     * @param {GeoJSON.FeatureCollection<import("geojson").Point>} geojson
     * @param {number} [maxDistance]
     * @returns {import("geojson").FeatureCollection}
     */
    cluster(geojson, maxDistance = 1) {
        return turf.clustersDbscan(geojson, maxDistance);
    }

    /**
     * @param {import("geojson").FeatureCollection} geojson
     * @returns {number|undefined}
     */
    getMaxCluster(geojson) {
        let maxCluster = -1;
        turf.featureEach(geojson, (f) => {
            if (f.properties && f.properties.cluster > maxCluster) {
                maxCluster = f.properties.cluster;
            }
        });
        return maxCluster === -1 ? undefined : maxCluster;
    }

    /**
     * @param {import("geojson").Feature[]} polygons
     * @param {Map<number,import("geojson").Feature<import("geojson").Point,import("geojson").GeoJsonProperties>[]>} clusters
     * @returns {import("geojson").Feature<import("geojson").Point>[]}
     */
    #findClusteredPointsOutsideOfPolygons(polygons, clusters) {
        const query = whichPolygon(turf.featureCollection(polygons));

        const initialOutsidePoints = [];

        for (const clusterPoints of clusters.values()) {
            for (const point of clusterPoints) {
                const coords = point.geometry.coordinates;
                const polyProps = query([coords[0], coords[1]]);
                if (!polyProps) {
                    initialOutsidePoints.push(point);
                }
            }
        }

        const finalOutsidePoints = [];

        // If any points remain outside, find the distance to the nearest polygon.
        if (initialOutsidePoints.length) {
            // Convert all polygons to lines.
            const polysAsLines = new Map();
            for (const polygon of polygons) {
                const cluster = polygon.properties?.cluster;
                let lines = polysAsLines.get(cluster);
                if (!lines) {
                    lines = [];
                    polysAsLines.set(cluster, lines);
                }
                // @ts-ignore
                lines.push(turf.polygonToLine(polygon));
            }

            for (const point of initialOutsidePoints) {
                const cluster = point.properties?.cluster;
                const lines = polysAsLines.get(cluster);
                if (!lines) {
                    console.warn(`cluster ${cluster} has no polygons`);
                    finalOutsidePoints.push(point);
                    continue;
                }
                let minDistance = Number.MAX_SAFE_INTEGER;
                for (const line of lines) {
                    const dist = turf.pointToLineDistance(point, line, {
                        units: "meters",
                    });
                    minDistance = Math.min(minDistance, dist);
                }

                if (minDistance > 1) {
                    finalOutsidePoints.push(point);
                }
            }
        }

        return finalOutsidePoints;
    }
}
