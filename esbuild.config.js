import esbuild from 'esbuild'
import process from 'process'
import builtins from 'builtin-modules'

const context = await esbuild.context({
    entryPoints: ['src/tools/*.ts'],
    outdir: 'lib/tools',

    bundle: true,
    target: 'es2018',
    treeShaking: true,

    legalComments: 'none',
    minify: process.argv[2] !== 'watch',

    external: ['obsidian', 'electron', ...builtins],
})

if (process.argv[2] === 'watch') {
    await context.watch()
} else {
    await context.rebuild()
    process.exit(0)
}
