import path from 'path'
import fs from 'fs-extra'
import esbuild from 'esbuild'
import process from 'process'
import builtins from 'builtin-modules'

const wasmPlugin = {
    name: 'wasm',

    setup(build) {
        build.onResolve({ filter: /\.wasm$/ }, ({ path: file, namespace, resolveDir }) => {
            if (namespace === 'wasm-stub') return { path: file, namespace: 'wasm-file' }
            if (resolveDir === '') return

            const wasmPath = path.isAbsolute(file) ? file : path.join(resolveDir, file)
            return { path: wasmPath, namespace: 'wasm-stub' }
        })

        build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, ({ path: file }) => ({
            contents:
                `import wasm from ${JSON.stringify(file)};\n` +
                'export default (imports) => ' +
                'WebAssembly.instantiate(wasm, imports)' +
                '.then(result => result.instance.exports);',
        }))

        build.onLoad({ filter: /.*/, namespace: 'wasm-file' }, async ({ path: file }) => ({
            contents: await fs.readFile(file, 'utf-8'),
            loader: 'binary',
        }))
    },
}

const context = await esbuild.context({
    entryPoints: ['src/obsidian.ts'],
    outfile: 'lib/main.js',

    bundle: true,
    format: 'cjs',
    target: 'es2018',
    treeShaking: true,

    plugins: [wasmPlugin],

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
})

if (process.argv[2] === 'watch') {
    await context.watch()
} else {
    await context.rebuild()
    process.exit(0)
}
