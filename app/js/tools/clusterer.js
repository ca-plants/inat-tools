export class Clusterer {
    #clustersDbscan;
    #concave;
    #turfMeta;
    #turfHelpers;
    #area;

    /**
     * @param {import("@turf/clusters-dbscan").clustersDbscan} clustersDbscan
     * @param {import("@turf/meta")} turfMeta
     * @param {import("@turf/helpers")} turfHelpers
     * @param {import("@turf/clone")} clone
     * @param {import("@turf/concave").concave} concave
     * @param {import("@turf/area").area} area
     */
    constructor(clustersDbscan, turfMeta, turfHelpers, clone, concave, area) {
        this.#clustersDbscan = clustersDbscan;
        this.#turfMeta = turfMeta;
        this.#turfHelpers = turfHelpers;
        this.#concave = concave;
        this.#area = area;
    }

    /**
     * @param {import("geojson").FeatureCollection} geojson
     * @param {{includeClusteredPoints?:boolean,convex?:boolean}} [options]
     * @param {import("geojson").GeoJsonProperties} [properties={}]
     * @returns {import("geojson").FeatureCollection}
     */
    addBorders(geojson, options = {}, properties = {}) {
        /** @type {import("geojson").Feature[]} */
        const newFeatures = [];

        /** @type {Map<number,import("geojson").Feature<GeoJSON.Point>[]>} */
        const clusters = new Map();
        this.#turfMeta.featureEach(geojson, (f) => {
            if (!f.properties) {
                return;
            }
            if (typeof f.properties.cluster === "number") {
                let features = clusters.get(f.properties.cluster);
                if (!features) {
                    features = [];
                    clusters.set(f.properties.cluster, features);
                }
                // @ts-ignore
                features.push(f);
                if (options.includeClusteredPoints) {
                    newFeatures.push(f);
                }
            } else {
                newFeatures.push(f);
            }
        });

        for (const [cluster_num, features] of clusters.entries()) {
            const fc = this.#turfHelpers.featureCollection(features);
            const border = this.#concave(fc, { maxEdge: 1 });
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
                    polygons = this.#turfHelpers.polygons(
                        border.geometry.coordinates
                    ).features;
                    break;
            }

            polygons.forEach((p) => {
                p.properties = {
                    cluster_num: cluster_num,
                    hectares: this.#turfHelpers
                        .convertArea(this.#area(p), "meters", "hectares")
                        .toFixed(2),
                    ...properties,
                };
            });
            newFeatures.push(...polygons);
        }

        return this.#turfHelpers.featureCollection(newFeatures);
    }

    /**
     * @param {GeoJSON.FeatureCollection<import("geojson").Point>} geojson
     * @param {number} [maxDistance]
     * @returns {import("geojson").FeatureCollection}
     */
    cluster(geojson, maxDistance = 1) {
        return this.#clustersDbscan(geojson, maxDistance);
    }

    /**
     * @param {import("geojson").FeatureCollection} geojson
     * @returns {number|undefined}
     */
    getMaxCluster(geojson) {
        let maxCluster = -1;
        this.#turfMeta.featureEach(geojson, (f) => {
            if (f.properties && f.properties.cluster > maxCluster) {
                maxCluster = f.properties.cluster;
            }
        });
        return maxCluster === -1 ? undefined : maxCluster;
    }
}
