import path from 'path'
import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { OpenAIChat } from 'langchain/llms'
import { CallbackManager } from 'langchain/callbacks'
import { transcribe } from './whisper.js'

import type { ChatCompletionRequestMessage } from 'openai'
import type { Context } from './types.js'

export async function askGladdis(context: Context): Promise<void> {
    context = await transcribe(context)

    await fs.appendFile(context.file.path, `\n\n**${context.gladdis.label}:** `)
    await chatWithGladdis(context)
    await fs.appendFile(context.file.path, `\n\n---\n\n**${context.user.label}:** `)
}

export async function chatWithGladdis(context: Context): Promise<void> {
    const chatContext = merge({}, context) as any

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    const prefixMessages: ChatCompletionRequestMessage[] = [
        { role: 'system', content: context.gladdis.corePrompt },
        { role: 'system', content: context.gladdis.metaPrompt + JSON.stringify(chatContext) },
    ]

    context.user.history.unshift(...prefixMessages)

    const gladdis = new OpenAIChat({
        prefixMessages: context.user.history,
        modelName: context.gladdis.model,
        temperature: context.gladdis.temperature,
        topP: context.gladdis.top_p_param,
        frequencyPenalty: context.gladdis.freq_penalty,
        presencePenalty: context.gladdis.pres_penalty,
        cache: false,
        streaming: true,
        callbackManager: CallbackManager.fromHandlers({
            async handleLLMNewToken(token) {
                await fs.appendFile(context.file.path, token)
            },
        }),
    })

    context.user.history.push({ role: 'user', content: context.user.prompt, name: context.user.label })
    context.user.history.push({ role: 'assistant', content: await gladdis.call(context.user.prompt) })

    await logGladdisCall(context)
    await logGladdisChat(context)
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
