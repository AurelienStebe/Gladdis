import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'

import type { Context } from './types.js'
import type { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from 'openai'

export async function loadContext({ body }: { body: Context }): Promise<Context> {
    const content = (await fs.readFile(body.file.path, 'utf-8')).trim()
    const bodyContext = merge(body, { file: { text: content } })

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
    let prompt: string[] = []
    let quotes: string[] = []

    let codeBlock = false
    let textBlock = false

    context.file.text.split('\n').forEach((line) => {
        if (codeBlock || textBlock) {
            if (line.trimEnd().endsWith('```')) codeBlock = false
            if (line.trimEnd().endsWith('"""')) textBlock = false
            prompt.push(line)
            return
        }

        if (line.trimStart().startsWith('```')) {
            if (!line.trimEnd().endsWith('```')) codeBlock = true
            prompt.push(line)
            return
        }

        if (line.trimStart().startsWith('"""')) {
            if (!line.trimEnd().endsWith('"""')) textBlock = true
            prompt.push(line)
            return
        }

        if (line.trim() === '---') {
            context = parsePrompt(prompt.join('\n').trim(), quotes.join('\n').trim(), context)
            prompt = []
            quotes = []
            return
        }

        if (!line.startsWith('>')) {
            if (quotes.at(-1) !== '\n\n') quotes.push('\n\n')
            prompt.push(line)
        } else quotes.push(line.slice(1).trimStart())
    })

    context = parsePrompt(prompt.join('\n').trim(), quotes.join('\n').trim(), context)

    if (context.user.history.at(-1)?.role === 'user') {
        const content = context.user.history.pop()?.content ?? ''
        context.user.prompt = content.replace(/(?<!!)(\[\[.+?\]\])/g, '!$1')
    }

    return context
}

function parsePrompt(prompt: string, quotes: string, context: Context): Context {
    let role: ChatCompletionRequestMessageRoleEnum = 'user'
    let labelMatch = prompt.match(/^\*\*(.+?):\*\*/)

    let content = prompt

    if (labelMatch !== null) {
        if (labelMatch[1] === context.gladdis.label) role = 'assistant'
        else {
            if (labelMatch[1].toLowerCase() === 'system') role = 'system'
            else context.user.label = labelMatch[1]
        }
        content = content.slice(labelMatch[0].length).trimStart()
    }

    labelMatch = content.match(/^\*\*(.+?):\*\*/m)

    if (labelMatch !== null) {
        prompt = content.slice(labelMatch.index).trim()
        content = content.slice(0, labelMatch.index).trim()
    }

    content = parseTranscript(content, quotes, context)

    const message: ChatCompletionRequestMessage = { role, content }
    if (role === 'user') message.name = context.user.label
    context.user.history.push(message)

    return labelMatch !== null ? parsePrompt(prompt, quotes, context) : context
}

function parseTranscript(prompt: string, quotes: string, context: Context): string {
    const transcriptRegex = new RegExp(`\\[!${context.whisper.label} of "(.+?)"\\]`, 'gi')

    for (const transcriptMatch of quotes.matchAll(transcriptRegex)) {
        const start = (transcriptMatch.index ?? 0) + transcriptMatch[0].length
        const stop = quotes.indexOf('\n\n', start) + 1

        const transcript = quotes.slice(start, stop === 0 ? undefined : stop).trim()
        prompt = prompt.replace(`![[${transcriptMatch[1]}]]`, transcript)
    }

    return prompt
}
