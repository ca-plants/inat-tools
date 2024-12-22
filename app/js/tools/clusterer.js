import whichPolygon from "which-polygon";

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
        this.#turfMeta.featureEach(geojson, (point) => {
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
            const fc = this.#turfHelpers.featureCollection(clusterPoints);
            const border = this.#concave(fc, { maxEdge: 1 });
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
            newPolygons.push(...polygons);
        }

        const outsidePoints = this.#findClusteredPointsOutsideOfPolygons(
            newPolygons,
            clusters
        );

        /** @type {import("geojson").Feature[]} */
        const features = [
            ...newPolygons,
            ...unClusteredPoints,
            ...outsidePoints,
        ];

        return this.#turfHelpers.featureCollection(features);
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

    /**
     * @param {import("geojson").Feature[]} polygons
     * @param {Map<number,import("geojson").Feature<import("geojson").Point,import("geojson").GeoJsonProperties>[]>} clusters
     * @returns {import("geojson").Feature<import("geojson").Point>[]}
     */
    #findClusteredPointsOutsideOfPolygons(polygons, clusters) {
        const query = whichPolygon(
            this.#turfHelpers.featureCollection(polygons)
        );

        const outsidePoints = [];

        for (const [cluster_num, clusterPoints] of clusters.entries()) {
            for (const point of clusterPoints) {
                const coords = point.geometry.coordinates;
                const polyProps = query([coords[0], coords[1]]);
                if (!polyProps) {
                    outsidePoints.push(point);
                }
            }
        }

        return outsidePoints;
    }
}
