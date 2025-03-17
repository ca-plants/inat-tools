import whichPolygon from "which-polygon";
import * as turf from "@turf/turf";
import { GJTools } from "../lib/geojson.js";

/**
 * @typedef {import("geojson").Feature<import("geojson").LineString|import("geojson").MultiLineString>|import("geojson").FeatureCollection<import("geojson").LineString|import("geojson").MultiLineString>} MixedLineStrings
 */

export class Clusterer {
    /**
     * @param {import("geojson").FeatureCollection<import("geojson").Point>} geojson
     * @param {import("geojson").GeoJsonProperties} [properties={}]
     * @returns {import("geojson").FeatureCollection}
     */
    addBorders(geojson, properties = {}) {
        /** @type {import("geojson").Feature[]} */
        const unClusteredPoints = [];
        /** @type {import("geojson").Feature<import("geojson").Polygon>[]} */
        const newPolygons = [];

        /** @type {Map<number,import("geojson").Feature<GeoJSON.Point>[]>} */
        const clusters = new Map();
        turf.featureEach(geojson, (point) => {
            if (!point.properties) {
                return;
            }
            if (typeof point.properties.cluster === "number") {
                let clusterPoints = clusters.get(point.properties.cluster);
                if (!clusterPoints) {
                    clusterPoints = [];
                    clusters.set(point.properties.cluster, clusterPoints);
                }
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

            /** @type {import("geojson").Feature<import("geojson").Polygon>[]} */
            let polygons = [];
            switch (border.geometry.type) {
                case "Polygon":
                    // @ts-ignore
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
                pop_num: index + 1,
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
     * @returns {import("geojson").FeatureCollection<import("geojson").Point>}
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
     * @param {import("geojson").Feature<import("geojson").Polygon>[]} polygons
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
                } else {
                    // Add the point to the list for this polygon.
                    if (!polyProps.observations) {
                        polyProps.observations = [];
                    }
                    polyProps.observations.push(point);
                }
            }
        }

        const finalOutsidePoints = [];

        // If any points remain outside, find the distance to the nearest polygon.
        if (initialOutsidePoints.length) {
            // Convert all polygons to lines.
            /** @type {Map<number,MixedLineStrings[]>} */
            const polysAsLines = new Map();
            for (const polygon of polygons) {
                const cluster = GJTools.getProperty(polygon, "cluster");
                let lines = polysAsLines.get(cluster);
                if (!lines) {
                    lines = [];
                    polysAsLines.set(cluster, lines);
                }
                const polyLines = turf.polygonToLine(polygon);
                lines.push(polyLines);
            }

            for (const point of initialOutsidePoints) {
                let properties = point.properties;
                if (properties === null) {
                    properties = point.properties = {};
                }
                const cluster = properties.cluster;
                const lines = polysAsLines.get(cluster);
                if (!lines) {
                    console.warn(`cluster ${cluster} has no polygons`);
                    finalOutsidePoints.push(point);
                    continue;
                }
                let minDistance = {
                    pop_num: 0,
                    distance: Number.MAX_SAFE_INTEGER,
                };
                for (const rawLines of lines) {
                    const processedlines = convertToLineStrings(rawLines);
                    for (const line of processedlines) {
                        const popNum = GJTools.getProperty(line, "pop_num");
                        const dist = turf.pointToLineDistance(point, line, {
                            units: "meters",
                        });
                        if (dist < minDistance.distance) {
                            minDistance = { pop_num: popNum, distance: dist };
                        }
                    }
                }

                if (minDistance.distance > 1) {
                    minDistance.distance = Math.round(minDistance.distance);
                    GJTools.setProperty(point, "min_distance", minDistance);
                    finalOutsidePoints.push(point);
                } else {
                    // Add the observation to the correct polygon.
                    const poly = polygons[minDistance.pop_num - 1];
                    /** @type {import("geojson").Feature<import("geojson").Point>[]} */
                    const observations = GJTools.getRequiredProperty(
                        poly,
                        "observations",
                        [],
                    );
                    observations.push(point);
                }
            }
        }

        return finalOutsidePoints;
    }
}

/**
 * @param {MixedLineStrings} mixedData
 * @returns {import("geojson").Feature<import("geojson").LineString>[]}
 */
function convertToLineStrings(mixedData) {
    if (
        mixedData.type === "Feature" &&
        mixedData.geometry.type === "LineString"
    ) {
        // @ts-ignore
        return [mixedData];
    }
    // TODO: implement this if the situation arises.
    throw new Error();
}
