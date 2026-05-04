// @ts-ignore - eleventy does not support TypeScript
import { HtmlBasePlugin } from "@11ty/eleventy";

// @ts-ignore - eleventy does not support TypeScript
export default function (eleventyConfig) {
    eleventyConfig.setInputDirectory("app");
    eleventyConfig.setOutputDirectory("public");
    eleventyConfig.addPassthroughCopy("app/css");
    eleventyConfig.addPassthroughCopy("app/img");
    eleventyConfig.setLayoutsDirectory("layouts");
    eleventyConfig.addPlugin(HtmlBasePlugin, {
        baseHref: "/inat-tools",
    });
}
