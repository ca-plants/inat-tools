import { fileURLToPath } from "node:url";
import { dirname } from "path";
import Metalsmith from "metalsmith";
import layouts from "@metalsmith/layouts";
import inPlace from "@metalsmith/in-place";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {import("commander").OptionValues} options
 */
async function build(options) {
    const nunjuckOptions = {
        transform: "nunjucks",
        engineOptions: {
            root: __dirname + "/layouts",
            globals: {
                homePath: options.path,
            },
        },
    };

    const ms = Metalsmith(__dirname);

    ms.directory(__dirname).source("./app").destination("./public").clean(true);

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
    "--path <path>",
    "The path to the directory containing Metalsmith files.",
    "/"
);
program.option(
    "--no-watch",
    "Generate the output files, but do not continue to watch."
);
program.action((options) => build(options));

await program.parseAsync();
