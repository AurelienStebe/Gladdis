import path from 'path'
import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { Tiktoken } from '@dqbd/tiktoken/lite'

import { writeHistory } from './history.js'

import type { Context, ChatMessage } from '../types/context.js'

import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' }

export async function logGladdisCall(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await createDataPath(context.file.data, 'history', 'calls', dateDir)
    const logFile = path.resolve(logPath, `${context.file.date.getTime()}.md`)

    const logContext = merge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${yaml.stringify(logContext)}---\n\n`
    await fs.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await createDataPath(context.file.data, 'history', 'chats', dateDir)
    const logFile = path.resolve(logPath, path.basename(context.file.path))

    const history = merge({}, context.user.history.slice(-2))
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`

    const logContext = merge({}, context)
    logContext.user.history = history

    await fs.appendFile(logFile, '\n' + writeHistory(logContext))
}

async function createDataPath(...subPaths: string[]): Promise<string> {
    for (const [i] of subPaths.entries()) {
        const dataPath = path.resolve(...subPaths.slice(0, i + 1))

        try {
            await fs.access(dataPath)
        } catch (e) {
            await fs.mkdir(dataPath)
        }
    }

    return path.resolve(...subPaths)
}

export function getTokenModal(context: Context): string {
    const tokenLength = getTokenLength(context.user.history)

    let tokenLimit = context.gladdis.model.startsWith('gpt-4') ? 8192 : 4096
    if (context.gladdis.model.startsWith('gpt-4-32k')) tokenLimit = 32768

    const tokenRatio = Math.ceil((tokenLength / tokenLimit) * 33)
    const tokenGraph = `[**${'#'.repeat(tokenRatio)}**${'-'.repeat(33 - tokenRatio)}]`
    const tokenCount = `**${tokenLength.toLocaleString()}** tokens out of ${tokenLimit.toLocaleString()}`

    return `\n\n> [!INFO]\n> Using ${tokenCount} max tokens.\n>\n> ${tokenGraph}`
}

export function getTokenLength(messages: ChatMessage[]): number {
    const tiktoken = new Tiktoken(cl100k_base.bpe_ranks, cl100k_base.special_tokens, cl100k_base.pat_str)

    const fullHistory = messages.map((message) => `${message.name ?? message.role}\n${message.content}`)
    const tokenLength = tiktoken.encode(fullHistory.join('\n')).length + messages.length * 3

    tiktoken.free()
    return tokenLength
}
