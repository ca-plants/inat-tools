#!/usr/bin/env node

import Metalsmith from "metalsmith";
import layouts from "@metalsmith/layouts";
import inPlace from "@metalsmith/in-place";
import { Command } from "commander";
import { cwd } from "node:process";

const __dirname = cwd();

/**
 * @param {import("commander").OptionValues} options
 */
async function build(options) {
    const nunjuckOptions = {
        transform: "nunjucks",
        engineOptions: {
            root: __dirname + "/layouts",
        },
    };

    const ms = Metalsmith(__dirname);

    ms.directory(__dirname).source("./app").destination("./ms").clean(true);

    if (options.watch) {
        ms.watch(["./app", "./layouts"]);
    }

    ms.use(inPlace({ transform: "marked" }))
        .use(inPlace(nunjuckOptions))
        .use(layouts(nunjuckOptions))
        .build((err) => {
            if (err) {
                throw err;
            }
        });
}

const program = new Command();
program.option(
    "--no-watch",
    "Generate the output files, but do not continue to watch."
);
program.action((options) => build(options));

await program.parseAsync();
