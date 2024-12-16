#!/usr/bin/env node

import clustersDbscan from "@turf/clusters-dbscan";
import convex from "@turf/convex";
import * as clone from "@turf/clone";
import * as turfMeta from "@turf/meta";
import * as turfHelpers from "@turf/helpers";
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { cwd } from "node:process";
import { Clusterer } from "../app/js/tools/clusterer.js";

class NodeClusterer extends Clusterer {
    constructor() {
        super(clustersDbscan, turfMeta, turfHelpers, clone, convex);
    }
}

const __dirname = cwd();

/**
 * @param {Command} program
 * @param {import("commander").OptionValues} options
 */
async function run(program, options) {
    if (!options.input) {
        program.help();
    }
    const str = readFileSync(path.join(__dirname, options.input), "utf8");
    /** @type {GeoJSON.FeatureCollection<GeoJSON.Point>} */
    const json = JSON.parse(str);
    const clusterer = new NodeClusterer();
    const clustered = clusterer.cluster(json);
    const bordered = clusterer.addBorders(
        clustered,
        {},
        { fill: "red", "fill-opacity": 0.8 }
    );
    writeFileSync(
        path.join(__dirname, "tmp/clustered.geojson"),
        JSON.stringify(bordered)
    );
}

const program = new Command();
program.option("-i, --input <path>", "The path to the input file.");
program.action((options) => run(program, options));

await program.parseAsync();
