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
            name: path.basename(fileContext.file.path, '.md'),
            text: '',
        },
        user: {
            data: process.env.GLADDIS_DATA_PATH ?? '__DATA__',
            label: process.env.GLADDIS_DEFAULT_USER ?? 'User',
            prompt: '',
            history: [],
        },
        gladdis: {
            label: process.env.GLADDIS_NAME_LABEL ?? 'Gladdis AI',
            config: process.env.GLADDIS_CONFIG_FILE,
            model: process.env.GLADDIS_DEFAULT_MODEL ?? 'gpt-3.5-turbo',
            temperature: Number(process.env.GLADDIS_TEMPERATURE ?? 0),
            top_p_param: Number(process.env.GLADDIS_TOP_P_PARAM ?? 100),
            freq_penalty: Number(process.env.GLADDIS_FREQ_PENALTY ?? 0),
            pres_penalty: Number(process.env.GLADDIS_PRES_PENALTY ?? 0),
        },
        whisper: {
            input: process.env.GLADDIS_WHISPER_INPUT ?? 'Gladdis',
            config: process.env.GLADDIS_WHISPER_CONFIG,
            model: process.env.GLADDIS_WHISPER_MODEL ?? 'whisper-1',
            liveSuffix: process.env.GLADDIS_WHISPER_LIVE_SUFFIX ?? 'dictated, but not read',
            readSuffix: process.env.GLADDIS_WHISPER_READ_SUFFIX ?? 'transcribed and read',
            temperature: Number(process.env.GLADDIS_WHISPER_TEMPERATURE ?? 0),
            language: process.env.GLADDIS_WHISPER_LANGUAGE_ID,
            echoScript: (process.env.GLADDIS_WHISPER_ECHO_SCRIPT ?? 'true').toLowerCase() === 'true',
            deleteFile: (process.env.GLADDIS_WHISPER_DELETE_FILE ?? 'false').toLowerCase() === 'true',
        },
    }

    const fullContext = merge(coreContext, fileContext)

    return merge(await loadAIConfig(fullContext), fileContext)
}

export async function loadAIConfig(context: Context): Promise<Context> {
    let configContext: any = { whisper: {} }

    if (context.gladdis.config !== undefined) {
        const configPath = path.resolve(context.user.data, 'configs', context.gladdis.config)

        if (await fs.pathExists(configPath)) {
            configContext = merge(configContext, {
                file: { path: configPath },
                user: { label: 'System' },
            })

            configContext = await loadMarkdown(configContext)
            const configHistory = parseHistory(merge(context, configContext))

            delete configContext.file
            delete configContext.user

            context = merge(context, configContext)
            context.user.history.unshift(...configHistory)
        } else {
            const missing = `\n\n> [!MISSING]+ **Config File Not Found**\n> `
            await fs.appendFile(context.file.path, missing + configPath)
        }
    }

    if (context.whisper.config !== undefined) {
        const whisperPath = path.resolve(context.user.data, 'configs', context.whisper.config)

        if (await fs.pathExists(whisperPath)) {
            let whisperContext: any = {
                file: { path: whisperPath },
            }

            whisperContext = await loadMarkdown(whisperContext)
            configContext.whisper.input = whisperContext.file.text

            whisperContext = merge(whisperContext, configContext)
            context.whisper = merge(context.whisper, whisperContext.whisper)
        } else {
            const missing = `\n\n> [!MISSING]+ **Whisper File Not Found**\n> `
            await fs.appendFile(context.file.path, missing + whisperPath)
        }
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
