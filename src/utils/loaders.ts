import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'

import { parseHistory } from './history.js'

import type { Context } from '../types/context.js'

export async function loadContext(context: Context): Promise<Context> {
    const content = (await fs.readFile(context.file.path, 'utf-8')).trim()
    const bodyContext = merge(context, { file: { text: content } })

    let fileContext = {
        file: {
            data: process.env.GLADDIS_DATA_PATH ?? './DATA',
            date: new Date(),
        },
        user: {
            label: process.env.GLADDIS_DEFAULT_USER ?? 'User',
            prompt: '',
            history: [],
        },
    }

    if (content.startsWith('---\n')) {
        const [frontMatter, ...bodyContent] = content.slice(4).split('\n---')
        bodyContext.file.text = bodyContent.join('\n---').trim()
        fileContext = merge(fileContext, yaml.parse(frontMatter))
    }

    const coreContext = {
        gladdis: {
            label: process.env.GLADDIS_NAME_LABEL ?? 'Gladdis',
            corePrompt: process.env.GLADDIS_CORE_PROMPT ?? 'You are Gladdis, trained by OpenAI.',
            metaPrompt: process.env.GLADDIS_META_PROMPT ?? 'Metadata Context (in JSON format): ',
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

    return merge.all([coreContext, fileContext, bodyContext]) as Context
}

export function loadContent(context: Context): Context {
    context.user.history = parseHistory(context)

    if (context.user.history.at(-1)?.role === 'user') {
        if (context.user.history.at(-1)?.name !== undefined) {
            context.user.label = context.user.history.at(-1)?.name ?? 'User'
        }

        const content = context.user.history.pop()?.content ?? ''
        context.user.prompt = content.replace(/(?<!!)(\[\[.+?\]\])/g, '!$1')
    }

    return context
}
