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
        rules: {
            indent: [
                "error",
                4,
                {
                    SwitchCase: 1,
                },
            ],
            "linebreak-style": ["error", "unix"],
            "no-unused-vars": "error",
            quotes: ["error", "double", { avoidEscape: true }],
            semi: ["error", "always"],
            strict: "error",
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
