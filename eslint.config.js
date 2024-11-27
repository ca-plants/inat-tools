import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
    {
        files: ["**/*.test.js"],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    { ignores: ["public/"] },
];
