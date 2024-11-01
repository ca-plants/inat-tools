// Second, list out all your dependencies. For every URL, you must map it to its local module.
declare module "https://cdn.skypack.dev/d3-dsv" {
    export * from "d3-dsv";
}
declare module "https://cdn.skypack.dev/d3-geo" {
    export * from "d3-geo";
}
declare module "https://cdn.jsdelivr.net/npm/@observablehq/plot/+esm" {
    export * from "@observablehq/plot";
}
declare module "https://cdn.jsdelivr.net/npm/which-polygon@2.2.1/+esm" {
    import whichPolygon from "which-polygon";
    export default whichPolygon;
}
declare module "https://cdn.jsdelivr.net/npm/pkce-challenge/dist/index.js" {
    export default function pkceChallenge(length?: number): Promise<{
        code_verifier: string;
        code_challenge: string;
    }>;
}
