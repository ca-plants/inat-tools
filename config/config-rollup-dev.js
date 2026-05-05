import { commonPlugins, config } from "./config-rollup.js";

config.plugins = [...commonPlugins];
config.watch = { clearScreen: false };

export default config;
