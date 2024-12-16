#!/usr/bin/env node

import clustersDbscan from "@turf/clusters-dbscan";
import * as turfMeta from "@turf/meta";
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { cwd } from "node:process";
import { Clusterer } from "../app/js/tools/clusterer.js";

class NodeClusterer extends Clusterer {
    constructor() {
        super(clustersDbscan, turfMeta);
    }
}

const __dirname = cwd();

/**
 * @param {import("commander").OptionValues} options
 */
async function run(options) {
    const str = readFileSync(
        path.join(__dirname, "tmp/calochortus_umbellatus.geojson"),
        "utf8"
    );
    /** @type {GeoJSON.FeatureCollection<GeoJSON.Point>} */
    const json = JSON.parse(str);
    const clusterer = new NodeClusterer();
    const clustered = clusterer.cluster(json);
    console.log(clusterer.getMaxCluster(clustered));
    writeFileSync(
        path.join(__dirname, "tmp/clustered.geojson"),
        JSON.stringify(clustered)
    );
}

const program = new Command();
program.action((options) => run(options));

await program.parseAsync();
