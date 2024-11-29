import builtins from 'builtin-modules'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import terser from '@rollup/plugin-terser'
import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import { visualizer } from 'rollup-plugin-visualizer'

export default {
    input: 'lib/obsidian.js',

    output: {
        file: 'main.js',
        format: 'cjs',
    },

    plugins: [
        commonjs({ include: /node_modules/ }),
        visualizer({ template: 'treemap' }),

        resolve({ browser: true }),
        json({ compact: true }),

        alias({
            entries: [{ find: '../commands.js', replacement: '../obsidian.js' }],
        }),

        replace({
            delimiters: ['', ''],
            "const { resolvePDFJS } = await import('unpdf/pdfjs');":
                "const resolvePDFJS = require('obsidian').loadPdfJs;",
        }),

        terser({
            ecma: 2020,
            mangle: true,
            nameCache: {},

            compress: {
                passes: 3, // number of times to compress, 3 is probably plenty
                inline: 3, // level of function calls to inline => [0, 1, 2, 3]
                unused: true, // turn it off if you are missing some javascript
                unsafe: true, // turn it on at your own risk! (seems OK though)
            },
        }),
    ],

    external: ['obsidian', 'unpdf/pdfjs', '@electron/remote', ...builtins],
}
