import path from "node:path";
// @ts-ignore - eleventy does not support TypeScript
import { HtmlBasePlugin } from "@11ty/eleventy";

// @ts-ignore - eleventy does not support TypeScript
export default function (eleventyConfig) {
  const srcDir = "./app";
  eleventyConfig.setInputDirectory(srcDir);
  eleventyConfig.setOutputDirectory("public");

  eleventyConfig.addGlobalData("permalink", () => {
    // @ts-ignore
    return (data) => {
      // Find path relative to source directory.
      const inputPath = path.relative(srcDir, data.page.inputPath);
      // Force file extension to "html".
      const parsed = path.parse(inputPath);
      return path.join(parsed.dir, `${parsed.name}.html`);
    };
  });

  eleventyConfig.addPassthroughCopy("app/css");
  eleventyConfig.addPassthroughCopy("app/img");
  eleventyConfig.setLayoutsDirectory("layouts");
  eleventyConfig.addPlugin(HtmlBasePlugin, {
    baseHref: "/inat-tools",
  });
}
