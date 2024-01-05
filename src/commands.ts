import path from 'path'
import fs from 'fs-extra'

import { doGladdis } from './gladdis.js'
import { parseLinks } from './utils/scanner.js'
import { transcribe } from './utils/whisper.js'
import { getTokenModal } from './utils/loggers.js'
import { loadContext, loadContent } from './utils/loaders.js'

import type { Context, DiskInterface } from './types/context.js'

export const diskInterface: DiskInterface = {
    readFile: async (p: string) => await fs.readFile(p, 'utf-8'),
    readBinary: (p: string) => fs.createReadStream(p),
    appendFile: async (p: string, d: string) => {
        await fs.appendFile(p, d)
    },
    deleteFile: async (p: string) => {
        await fs.remove(p)
    },
    pathExists: async (p: string) => await fs.pathExists(p),
    pathEnsure: async (p: string) => {
        await fs.ensureDir(p)
    },
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

    context.whisper.echoOutput = false
    context.whisper.deleteFile = false

    for (const message of context.user.history) {
        message.content = await transcribe(message.content, context)
        message.content = await parseLinks(message.content, context)
    }

    context.whisper.echoOutput = true

    context.user.prompt = await transcribe(context.user.prompt, context)
    context.user.prompt = await parseLinks(context.user.prompt, context)

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

    context.user.history = [
        {
            role: 'user',
            content: context.user.prompt,
            name: context.user.label,
        },
    ]

    await context.file.disk.appendFile(context.file.path, getTokenModal(context))
}

function prepareContext(context: Context): Context {
    context.user = context.user ?? {}

    context.user.env = context.user.env ?? process.env
    context.file.disk = context.file.disk ?? diskInterface

    return context
}
