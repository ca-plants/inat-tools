export class Clusterer {
    #clustersDbscan;
    #turfMeta;

    /**
     * @param {import("@turf/clusters-dbscan").clustersDbscan} clustersDbscan
     * @param {import("@turf/meta")} turfMeta
     */
    constructor(clustersDbscan, turfMeta) {
        this.#clustersDbscan = clustersDbscan;
        this.#turfMeta = turfMeta;
    }

    /**
     * @param {GeoJSON.FeatureCollection<import("geojson").Point>} geojson
     * @returns {import("geojson").FeatureCollection}
     */
    cluster(geojson) {
        return this.#clustersDbscan(geojson, 1);
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
