import path from 'path'
import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { Tiktoken } from '@dqbd/tiktoken/lite'
import { OpenAIClient } from '@fern-api/openai'
import { transcribe } from './utils/whisper.js'

import type { Context, ChatMessage } from './types/context.js'

import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' }

const openai = new OpenAIClient({ token: process.env.OPENAI_API_KEY ?? '' })

export async function askGladdis(context: Context): Promise<void> {
    context = await transcribe(context)

    const chatContext = merge({}, context) as any

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    const promptMessage: ChatMessage = {
        role: 'user',
        content: context.user.prompt,
        name: context.user.label,
    }

    const prefixMessages: ChatMessage[] = [
        { role: 'system', content: context.gladdis.corePrompt },
        { role: 'system', content: context.gladdis.metaPrompt + JSON.stringify(chatContext) },
    ]

    context.user.history.push(promptMessage)
    context.user.history.unshift(...prefixMessages)

    context = await chatWithGladdis(context)

    void logGladdisCall(context)
    void logGladdisChat(context)
}

export async function chatWithGladdis(context: Context): Promise<Context> {
    const gladdisResponse: ChatMessage = {
        role: 'assistant',
        content: '',
    }

    let deferredPromise: (value: string) => void
    const finishMessage = new Promise<string>((resolve) => {
        deferredPromise = resolve
    })

    await openai.chat.createCompletion(
        {
            stream: true,
            model: context.gladdis.model,
            messages: context.user.history,
            temperature: context.gladdis.temperature,
            topP: context.gladdis.top_p_param,
            frequencyPenalty: context.gladdis.freq_penalty,
            presencePenalty: context.gladdis.pres_penalty,
        },
        (data) => {
            if (data.choices[0].delta.role === 'assistant') {
                void fs.appendFile(context.file.path, `\n\n**${context.gladdis.label}:** `)
            }
            if (data.choices[0].delta.content !== undefined) {
                gladdisResponse.content += data.choices[0].delta.content
                void fs.appendFile(context.file.path, data.choices[0].delta.content)
            }
        },
        {
            onFinish: () => {
                context.user.history.push(gladdisResponse)
                deferredPromise(`${getTokenModal(context)}\n\n---\n\n**${context.user.label}:** `)
            },
            onError: (error) => {
                context.user.history.push(gladdisResponse)
                deferredPromise(`${error?.toString() ?? '**Error**'}\n\n---\n\n**${context.user.label}:** `)
            },
        }
    )

    await fs.appendFile(context.file.path, await finishMessage)

    return context
}

async function logGladdisCall(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await getDataPath(context, 'calls', dateDir)

    const logFile = path.resolve(logPath, `${context.file.date.getTime()}.md`)

    const logContext = merge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${yaml.stringify(logContext)}---\n\n`
    await fs.appendFile(logFile, frontMatter + writeHistory(context))
}

async function logGladdisChat(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await getDataPath(context, 'chats', dateDir)

    const logFile = path.resolve(logPath, path.basename(context.file.path))

    const history = context.user.history.slice(-2)
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`
    context.user.history = history

    await fs.appendFile(logFile, writeHistory(context) + '\n')
}

async function getDataPath(context: Context, ...subPaths: string[]): Promise<string> {
    try {
        await fs.access(context.file.data)
    } catch (e) {
        await fs.mkdir(context.file.data)
    }

    for (const [i] of subPaths.entries()) {
        const dataPath = path.resolve(context.file.data, ...subPaths.slice(0, i + 1))

        try {
            await fs.access(dataPath)
        } catch (e) {
            await fs.mkdir(dataPath)
        }
    }

    return path.resolve(context.file.data, ...subPaths)
}

function writeHistory(context: Context): string {
    const history = context.user.history.map((message) => {
        let label = message.name ?? context.user.label

        if (message.role === 'system') label = 'System'
        if (message.role === 'assistant') label = context.gladdis.label

        return `**${label}:** ${message.content}`
    })

    return history.join('\n\n') + '\n'
}

function getTokenModal(context: Context): string {
    const tokenLength = getTokenLength(context.user.history)

    let tokenLimit = context.gladdis.model.startsWith('gpt-4') ? 8192 : 4096
    if (context.gladdis.model.startsWith('gpt-4-32k')) tokenLimit = 32768

    const tokenRatio = Math.ceil((tokenLength / tokenLimit) * 33)
    const tokenGraph = `[**${'#'.repeat(tokenRatio)}**${'-'.repeat(33 - tokenRatio)}]`
    const tokenCount = `**${tokenLength.toLocaleString()}** tokens out of ${tokenLimit.toLocaleString()}`

    return `\n\n> [!INFO]\n> Using ${tokenCount} max tokens.\n>\n> ${tokenGraph}`
}

function getTokenLength(messages: ChatMessage[]): number {
    const tiktoken = new Tiktoken(cl100k_base.bpe_ranks, cl100k_base.special_tokens, cl100k_base.pat_str)

    const fullHistory = messages.map((message) => `${message.name ?? message.role}\n${message.content}`)
    const tokenLength = tiktoken.encode(fullHistory.join('\n')).length + messages.length * 3

    tiktoken.free()

    return tokenLength
}
