// Second, list out all your dependencies. For every URL, you must map it to its local module.
declare module "https://cdn.skypack.dev/d3-dsv" {
    export * from "d3-dsv";
}
declare module "https://cdn.jsdelivr.net/npm/@observablehq/plot/+esm" {
    export * from "@observablehq/plot";
}
