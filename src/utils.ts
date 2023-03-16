import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'

import type { Context } from './types.js'

export async function loadContext({ filePath }: { filePath: string }): Promise<Context> {
    const content = (await fs.readFile(filePath, 'utf-8')).trim()
    const fileContext = { file: { path: filePath, text: content } }

    let userContext = {
        user: {
            label: process.env.GLADDIS_DEFAULT_USER ?? 'User',
        },
    }

    if (content.startsWith('---\n')) {
        const [frontMatter, ...fileContent] = content.slice(4).split('---')
        fileContext.file.text = fileContent.join('---').trim()
        userContext = merge(userContext, yaml.parse(frontMatter))
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
            language: process.env.GLADDIS_WHISPER_LANGUAGE,
        },
    }

    return merge.all([coreContext, userContext, fileContext]) as Context
}

export function parsePrompt(context: Context): Context {
    let prompt = context.file.text

    const border = (prompt + '\n').lastIndexOf('\n---\n')
    if (border > 0) prompt = prompt.slice(border + 4).trim()

    const userNameMatch = prompt.match(/^\*\*(.+):\*\*/)

    if (userNameMatch !== null) {
        context.user.label = userNameMatch[1]
        prompt = prompt.slice(userNameMatch[0].length)
    }

    context.user.prompt = prompt.trim()

    return context
}

export function parseHistory(context: Context): Context {
    // TODO

    return context
}
