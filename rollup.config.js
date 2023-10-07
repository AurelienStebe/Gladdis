import builtins from 'builtin-modules'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import { wasm } from '@rollup/plugin-wasm'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default {
    input: 'lib/obsidian.js',

    output: {
        file: 'main.js',
        format: 'cjs',
    },

    plugins: [
        commonjs({ include: /node_modules/ }),
        resolve({ preferBuiltins: true }),

        wasm({ targetEnv: 'auto-inline' }),
        json({ compact: true }),

        process.env.NODE_ENV === 'production' &&
            terser({
                ecma: 2018,
                mangle: true,
                nameCache: {},

                compress: {
                    passes: 3, // number of times to compress, 3 is probably plenty
                    inline: 3, // level of function calls to inline => [0, 1, 2, 3]
                    unused: true, // turn it off if you are missing some javascript
                    unsafe: false, // turn it on at your own risk (seems OK though)
                },
            }),
    ],

    external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        ...builtins,
    ],
}
