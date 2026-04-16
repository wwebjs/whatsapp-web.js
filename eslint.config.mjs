import globals from 'globals';
import pluginEslintJs from '@eslint/js';
import pluginMocha from 'eslint-plugin-mocha';
import configEslintConfigPrettier from 'eslint-plugin-prettier/recommended';

export default [
    pluginEslintJs.configs.recommended,
    {
        name: 'whatsapp-web.js/default/rules',
        plugins: {
            mocha: pluginMocha,
        },
        languageOptions: {
            ecmaVersion: 2025,

            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.es6,
                ...globals.node,

                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    // TODO: args can be uncommented, but there is code, that causes lint-errors
                    // args: 'all',
                    vars: 'all',
                    caughtErrorsIgnorePattern: '^ignoredError',
                },
            ],
        },
    },
    {
        name: 'whatsapp-web.js/default/ignores',
        ignores: [
            'node_modules',
            'dist',
            'coverage',
            'docs',
            '*.min.js',
            '.wa-version',
            '.wwebjs_auth',
            '.wwebjs_cache',
        ],
    },
    pluginMocha.configs.recommended,
    configEslintConfigPrettier,
];
