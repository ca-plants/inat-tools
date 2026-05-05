import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import { readdirSync } from "fs";
import { join } from "path/posix";

// commonjs() required for which-polygon
export const commonPlugins = [
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
];

const JS_DIR = "app/js/pages";

/** @type {import("rollup").RollupOptions} */
export const config = {
    input: readdirSync(JS_DIR)
        .filter((file) => file.endsWith(".js"))
        .map((file) => join(JS_DIR, file)),
    output: {
        dir: "public/js/pages",
    },
    // @ts-ignore - see https://github.com/rollup/plugins/pull/1782
    plugins: [...commonPlugins, terser()],
};

export default config;
