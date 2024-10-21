import process from 'process'
import builtins from 'builtin-modules'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import terser from '@rollup/plugin-terser'
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

        resolve({ browser: true }),
        json({ compact: true }),

        alias({
            entries: [{ find: '../commands.js', replacement: '../obsidian.js' }],
        }),

        process.env.NODE_ENV === 'production' &&
            terser({
                ecma: 2018,
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

    external: ['obsidian', 'electron', ...builtins],
}
