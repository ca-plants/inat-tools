/** @type {import('jest').Config} */
const config = {
    moduleNameMapper: {
        "https://cdn.jsdelivr.net/npm/which-polygon@2.2.1": "which-polygon",
        "https://cdn.jsdelivr.net/npm/@turf/bbox@7": "@turf/bbox",
    },
};

export default config;
