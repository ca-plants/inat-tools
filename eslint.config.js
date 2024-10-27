export default [
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
            quotes: ["error", "double", { avoidEscape: true }],
            semi: ["error", "always"],
        },
    },
];
