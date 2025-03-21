#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { cwd } from "node:process";
import * as turf from "@turf/turf";
import { Clusterer } from "../app/js/tools/clusterer.js";

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
    const clusterer = new Clusterer();
    const clustered = clusterer.cluster(json, options.maxdistance);
    const bordered = clusterer.addBorders(clustered, options.maxdistance, {
        fill: "red",
        "fill-opacity": 0.8,
    });

    // Go through remaining points and color code them.
    turf.featureEach(bordered, (point) => {
        if (point.geometry.type === "Point") {
            const properties = point.properties ?? {};
            if (properties.dbscan === "noise") {
                properties["marker-color"] = "yellow";
            }
        }
    });

    writeFileSync(
        path.join(__dirname, options.output),
        JSON.stringify(bordered),
    );
}

const program = new Command();
program.option("-i, --input <path>", "The path to the input file.");
program.option("-o, --output <path>", "The path to the output file.");
program.option(
    "-d, --maxdistance <km>",
    "The maximum distance to use in the clustering algorithm, in kilometers.",
    "1",
);
program.action((options) => run(program, options));

await program.parseAsync();
