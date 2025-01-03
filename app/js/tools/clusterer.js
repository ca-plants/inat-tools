export class Clusterer {
    #clustersDbscan;
    #convex;
    #turfMeta;
    #turfHelpers;

    /**
     * @param {import("@turf/clusters-dbscan").clustersDbscan} clustersDbscan
     * @param {import("@turf/meta")} turfMeta
     * @param {import("@turf/helpers")} turfHelpers
     * @param {import("@turf/clone")} clone
     * @param {import("@turf/convex").convex} convex
     */
    constructor(clustersDbscan, turfMeta, turfHelpers, clone, convex) {
        this.#clustersDbscan = clustersDbscan;
        this.#turfMeta = turfMeta;
        this.#turfHelpers = turfHelpers;
        this.#convex = convex;
    }

    /**
     * @param {import("geojson").FeatureCollection} geojson
     * @param {{includeClusteredPoints?:boolean}} [options]
     * @param {import("geojson").GeoJsonProperties} [properties={}]
     * @returns {import("geojson").FeatureCollection}
     */
    addBorders(geojson, options = {}, properties = {}) {
        /** @type {import("geojson").Feature[]} */
        const newFeatures = [];

        /** @type {Map<number,import("geojson").Feature[]>} */
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
                features.push(f);
                if (options.includeClusteredPoints) {
                    newFeatures.push(f);
                }
            } else {
                newFeatures.push(f);
            }
        });

        for (const features of clusters.values()) {
            const fc = this.#turfHelpers.featureCollection(features);
            const border = this.#convex(fc);
            if (border) {
                border.properties = { ...properties };
                newFeatures.push(border);
            }
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
