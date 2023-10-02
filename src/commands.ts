import path from 'path'
import fs from 'fs-extra'

import { doGladdis } from './gladdis.js'
import { parseLinks } from './utils/scanner.js'
import { transcribe } from './utils/whisper.js'
import { getTokenModal } from './utils/loggers.js'
import { loadContext, loadContent } from './utils/loaders.js'

import type { Context } from './types/context.js'

export const diskInterface = {
    readFile: async (path: string) => await fs.readFile(path, 'utf-8'),
    readBinary: fs.createReadStream,
    appendFile: fs.appendFile,
    deleteFile: fs.remove,
    pathExists: fs.pathExists,
    pathEnsure: fs.ensureDir,
    baseName: path.basename,
    extName: path.extname,
    joinPath: path.join,
    dirName: path.dirname,
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
    context.user.env = context.user?.env ?? process.env
    context.file.disk = context.file?.disk ?? diskInterface

    return context
}
