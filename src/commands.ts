import path from 'path'
import fs from 'fs-extra'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'
import TurndownService from 'turndown'
import { getDocument } from 'pdfjs-dist'
import { gfm } from 'turndown-plugin-gfm'
import { arrayBuffer } from 'stream/consumers'

import { doGladdis } from './gladdis.js'
import { transcribe } from './utils/whisper.js'
import { parseLinks } from './utils/scanner.js'
import { webBrowser } from './utils/browser.js'
import { getTokenModal } from './utils/loggers.js'
import { loadContext, loadContent } from './utils/loaders.js'

import type { ReadStream } from 'fs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Context, DiskInterface } from './types/context.js'

export { stringify as stringifyYaml, parse as parseYaml } from 'yaml'

export function parseDom(html: string): Document {
    return new JSDOM(html).window.document
}

export async function getHtml(url: string): Promise<string> {
    return await (await fetch(url)).text()
}

export function turndown(html: string): string {
    const turndown = new TurndownService({
        hr: '---',
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
    })

    turndown.use(gfm)

    return turndown.turndown(html)
}

export async function getPdfDoc(stream: ReadStream | Promise<File>): Promise<PDFDocumentProxy> {
    const file = stream instanceof Promise ? (await stream).arrayBuffer() : arrayBuffer(stream)

    return await getDocument(await file).promise
}

export const diskInterface: DiskInterface = {
    readFile: async (p: string) => await fs.readFile(p, 'utf-8'),
    readBinary: async (p: string) => await arrayBuffer(fs.createReadStream(p)),
    appendFile: async (p: string, d: string) => await fs.appendFile(p, d),
    deleteFile: async (p: string) => await fs.remove(p),
    pathExists: async (p: string) => await fs.pathExists(p),
    pathEnsure: async (p: string) => await fs.ensureDir(p),
    baseName: (p: string, e?: string) => path.basename(p, e),
    extName: (p: string) => path.extname(p),
    joinPath: (...p: string[]) => path.join(...p),
    dirName: (p: string) => path.dirname(p),
}

export async function chatWithGladdis(context: Context): Promise<void> {
    await doGladdis(loadContent(await loadContext(prepareContext(context))))
}

export async function processContent(context: Context): Promise<void> {
    context = loadContent(await loadContext(prepareContext(context)))

    context.whisper.echoOutput = true
    context.whisper.deleteFile = false

    await Promise.all(
        context.user.history.map(async (message) => {
            message.content = await parseLinks(message.content, context)
        }),
    )

    context.user.prompt = await transcribe(context.user.prompt, context)
    context.user.prompt = await parseLinks(context.user.prompt, context)
    context.user.prompt = await webBrowser(context.user.prompt, context)

    context.user.history.push({
        role: 'user',
        content: context.user.prompt,
        name: context.user.label,
    })

    await context.file.disk.appendFile(context.file.path, getTokenModal(context))
}

export async function processPrompt(context: Context): Promise<void> {
    context = await loadContext(prepareContext(context))
    context.file.text = context.file.text.split('\n---').at(-1) ?? ''
    context = loadContent(context)

    context.whisper.echoOutput = true
    context.whisper.deleteFile = false

    context.user.prompt = await transcribe(context.user.prompt, context)
    context.user.prompt = await parseLinks(context.user.prompt, context)
    context.user.prompt = await webBrowser(context.user.prompt, context)

    context.user.history = [
        {
            role: 'user',
            content: context.user.prompt,
            name: context.user.label,
        },
    ]

    await context.file.disk.appendFile(context.file.path, getTokenModal(context))
}

export function prepareContext(context: Context): Context {
    context.user = context.user ?? {}

    context.user.env = context.user.env ?? process.env
    context.file.disk = context.file.disk ?? diskInterface

    return context
}
