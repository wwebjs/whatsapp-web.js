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
        // be careful, "recommended" settings object has 4 fields:
        // - name (string)
        // - plugins (object)
        // - languageOptions (object)
        // - rules (object)
        //
        // by simple "adding" any of mentioned fields to this object
        // you REPLACE the "recommended" value.
        // If you want to PATCH it - consider nested "..." spread operator
        ...pluginMocha.configs.recommended,
        name: 'whatsapp-web.js/default/mocha',

        files: ['tests/**/*'],
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
    configEslintConfigPrettier,
];
