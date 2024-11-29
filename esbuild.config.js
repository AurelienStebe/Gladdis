import esbuild from 'esbuild'

await esbuild.build({
    entryPoints: ['src/startup.ts'],
    outfile: 'vault/.obsidian/plugins/gladdis-startup/main.js',

    bundle: true,
    minify: true,

    format: 'cjs',
    target: 'es2020',

    treeShaking: true,
    legalComments: 'none',

    external: ['obsidian'],
})
