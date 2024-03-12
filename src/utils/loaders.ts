import { deepmerge } from 'deepmerge-ts'

import { parseYaml } from '../commands.js'
import { parseHistory } from './history.js'
import { writeMissedModal } from './loggers.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)(?<!!)(\[\[[^\]]+?\]\])(?!.*%>)/gs

export async function loadContext(context: Context): Promise<Context> {
    const callContext = deepmerge(context, { file: { date: new Date() } })
    const fileContext = deepmerge(await loadMarkdown(context), callContext)

    const coreContext = {
        file: {
            name: context.file.disk.baseName(context.file.path, '.md'),
            text: '',
        },
        user: {
            data: context.user.env.GLADDIS_DATA_PATH ?? '__DATA__',
            label: context.user.env.GLADDIS_DEFAULT_USER ?? 'User',
            prompt: '',
            history: [],
        },
        gladdis: {
            label: context.user.env.GLADDIS_NAME_LABEL ?? 'Gladdis',
            config: context.user.env.GLADDIS_CONFIG_FILE,
            model: context.user.env.GLADDIS_DEFAULT_MODEL ?? 'gpt-3.5-turbo',
            temperature: Number(context.user.env.GLADDIS_TEMPERATURE ?? 0),
            top_p_param: Number(context.user.env.GLADDIS_TOP_P_PARAM ?? 100),
            freq_penalty: Number(context.user.env.GLADDIS_FREQ_PENALTY ?? 0),
            pres_penalty: Number(context.user.env.GLADDIS_PRES_PENALTY ?? 0),
        },
        whisper: {
            input: context.user.env.GLADDIS_WHISPER_INPUT ?? 'Gladdis',
            config: context.user.env.GLADDIS_WHISPER_CONFIG,
            model: context.user.env.GLADDIS_WHISPER_MODEL ?? 'whisper-1',
            liveSuffix: context.user.env.GLADDIS_WHISPER_LIVE_SUFFIX ?? 'dictated, but not read',
            readSuffix: context.user.env.GLADDIS_WHISPER_READ_SUFFIX ?? 'transcribed and read',
            temperature: Number(context.user.env.GLADDIS_WHISPER_TEMPERATURE ?? 0),
            echoOutput: (context.user.env.GLADDIS_WHISPER_ECHO_OUTPUT ?? 'true').toLowerCase() === 'true',
            deleteFile: (context.user.env.GLADDIS_WHISPER_DELETE_FILE ?? 'false').toLowerCase() === 'true',
            language: context.user.env.GLADDIS_WHISPER_LANGUAGE_ID,
        },
    }

    const fullContext = deepmerge(coreContext, fileContext) as unknown as Context
    return deepmerge(await loadAIConfig(fullContext), fileContext) as unknown as Context
}

export async function loadAIConfig(context: Context): Promise<Context> {
    const disk = context.file.disk
    let configContext: any = { whisper: {} }

    if (context.gladdis.config !== undefined && context.gladdis.config !== '') {
        if (!context.gladdis.config.toLowerCase().endsWith('.md')) context.gladdis.config += '.md'
        const configPath = disk.joinPath(context.user.data, 'configs', context.gladdis.config)

        if (await disk.pathExists(configPath)) {
            configContext = deepmerge(configContext, {
                file: { path: configPath, disk },
                user: { label: 'System' },
            })

            configContext = await loadMarkdown(configContext as Context)
            const configHistory = deepmerge(context, configContext) as Context

            delete configContext.file
            delete configContext.user

            context = deepmerge(context, configContext)
            context.user.history.unshift(...parseHistory(configHistory))
        } else {
            await writeMissedModal(configPath, 'Config File Not Found', context)
        }
    }

    if (context.whisper.config !== undefined && context.whisper.config !== '') {
        if (!context.whisper.config.toLowerCase().endsWith('.md')) context.whisper.config += '.md'
        const whisperPath = disk.joinPath(context.user.data, 'configs', context.whisper.config)

        if (await disk.pathExists(whisperPath)) {
            let whisperContext: any = {
                file: { path: whisperPath, disk },
            }

            whisperContext = await loadMarkdown(whisperContext as Context)
            configContext.whisper.input = whisperContext.file.text

            whisperContext = deepmerge(configContext, whisperContext)
            context.whisper = deepmerge(context.whisper, whisperContext.whisper)
        } else {
            await writeMissedModal(whisperPath, 'Whisper File Not Found', context)
        }
    }

    return context
}

export async function loadMarkdown(context: Context): Promise<Context> {
    const content = (await context.file.disk.readFile(context.file.path)).trim()

    if (content.startsWith('---\n')) {
        const [frontMatter, ...bodyContent] = content.slice(4).split('\n---')

        context = deepmerge(parseYaml(frontMatter), context)
        context.file.text = bodyContent.join('\n---').trim()
    } else context.file.text = content

    return context
}

export function loadContent(context: Context): Context {
    context.user.history.push(...parseHistory(context))

    for (const message of context.user.history) {
        if (message.role === 'system') {
            message.content = message.content.replace(linkRegex, '!$1')
        }
    }

    if (context.user.history.at(-1)?.role === 'user') {
        context.user.label = context.user.history.at(-1)?.name ?? 'User'
        const content = context.user.history.pop()?.content ?? ''

        context.user.prompt = content.replace(linkRegex, '!$1')
    } else context.user.prompt = ''

    return context
}
