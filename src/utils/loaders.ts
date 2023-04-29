import path from 'path'
import yaml from 'yaml'
import fs from 'fs-extra'
import merge from 'deepmerge'

import { parseHistory } from './history.js'

import type { Context } from '../types/context.js'

export async function loadContext(context: Context): Promise<Context> {
    const callContext = merge(context, { file: { date: new Date() } })
    const fileContext = merge(await loadMarkdown(context), callContext)

    const coreContext = {
        file: {
            name: path.basename(fileContext.file.path),
        },
        user: {
            data: process.env.GLADDIS_DATA_PATH ?? './DATA',
            label: process.env.GLADDIS_DEFAULT_USER ?? 'User',
        },
        gladdis: {
            label: process.env.GLADDIS_NAME_LABEL ?? 'Gladdis',
            config: process.env.GLADDIS_CONFIG_FILE ?? 'Gladdis.md',
            model: process.env.GLADDIS_DEFAULT_MODEL ?? 'gpt-3.5-turbo',
            temperature: Number(process.env.GLADDIS_TEMPERATURE ?? 0),
            top_p_param: Number(process.env.GLADDIS_TOP_P_PARAM ?? 1),
            freq_penalty: Number(process.env.GLADDIS_FREQ_PENALTY ?? 0),
            pres_penalty: Number(process.env.GLADDIS_PRES_PENALTY ?? 0),
        },
        whisper: {
            label: process.env.GLADDIS_WHISPER_LABEL ?? 'Transcript',
            prompt: process.env.GLADDIS_WHISPER_PROMPT ?? 'Transcribe',
            model: process.env.GLADDIS_WHISPER_MODEL ?? 'whisper-1',
            echoScript: Boolean(process.env.GLADDIS_WHISPER_ECHO_SCRIPT ?? false),
            deleteFile: Boolean(process.env.GLADDIS_WHISPER_DELETE_FILE ?? false),
            temperature: Number(process.env.GLADDIS_WHISPER_TEMPERATURE ?? 0),
            language: process.env.GLADDIS_WHISPER_LANGUAGE_ID,
        },
    }

    const fullContext = merge(coreContext, fileContext)

    return merge(await loadAIConfig(fullContext), fileContext)
}

export async function loadAIConfig(context: Context): Promise<Context> {
    const confPath = path.resolve(context.user.data, 'configs', context.gladdis.config)

    if (await fs.pathExists(confPath)) {
        let confContext: any = {
            file: { path: confPath },
            user: { label: 'System' },
        }

        confContext = merge(context, await loadMarkdown(confContext))
        context.user.history = parseHistory(confContext)

        delete confContext.file
        delete confContext.user

        context = merge(context, confContext)
    } else {
        const warning = `\n\n> [!WARNING]\n> **Config File Not Found:** ${confPath}`
        await fs.appendFile(context.file.path, warning)
        context.user.history = []
    }

    return context
}

export async function loadMarkdown(context: Context): Promise<Context> {
    const content = (await fs.readFile(context.file.path, 'utf-8')).trim()

    if (content.startsWith('---\n')) {
        const [frontMatter, ...bodyContent] = content.slice(4).split('\n---')

        context = merge(yaml.parse(frontMatter), context)
        context.file.text = bodyContent.join('\n---').trim()
    } else context.file.text = content

    return context
}

export function loadContent(context: Context): Context {
    context.user.history.push(...parseHistory(context))

    if (context.user.history.at(-1)?.role === 'user') {
        if (context.user.history.at(-1)?.name !== undefined) {
            context.user.label = context.user.history.at(-1)?.name ?? 'User'
        }

        const content = context.user.history.pop()?.content ?? ''
        context.user.prompt = content.replace(/(?<!!)(\[\[.+?\]\])/g, '!$1')
    } else context.user.prompt = ''

    return context
}
