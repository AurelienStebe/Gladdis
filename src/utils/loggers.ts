import { stringify } from 'yaml'
import { deepmerge } from 'deepmerge-ts'

import { Tiktoken } from 'js-tiktoken/lite'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'

import { writeHistory } from './history.js'

import type { Context, ChatMessage } from '../types/context.js'

export async function logGladdisCall(context: Context): Promise<void> {
    const disk = context.file.disk

    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = disk.joinPath(context.user.data, 'history', 'calls', ...dateDir)
    const logFile = disk.joinPath(logPath, context.file.date.getTime() + '.md')

    await disk.pathEnsure(logPath)

    const logContext = deepmerge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${stringify(logContext)}---\n\n`
    await disk.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const disk = context.file.disk

    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = disk.joinPath(context.user.data, 'history', 'chats', ...dateDir)
    const logFile = disk.joinPath(logPath, context.file.name + '.md')

    await disk.pathEnsure(logPath)

    const history = deepmerge({}, context.user.history.slice(-2))
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`

    const logContext = deepmerge({}, context) as any
    logContext.user.history = history

    await disk.appendFile(logFile, '\n' + writeHistory(logContext))
}

export function getTokenModal(context: Context): string {
    const tokenLength = getTokenCount(context.user.history)

    let tokenLimit = context.gladdis.model.startsWith('gpt-4') ? 8192 : 4096
    if (context.gladdis.model.startsWith('gpt-4-32k')) tokenLimit = 32768
    if (context.gladdis.model.startsWith('gpt-3.5-turbo-16k')) tokenLimit = 16384

    const tokenRatio = Math.min(Math.ceil((tokenLength / tokenLimit) * 36), 36)
    const tokenGraph = `[**${'#'.repeat(tokenRatio)}**${'-'.repeat(36 - tokenRatio)}]`
    const tokenCount = `**${tokenLength.toLocaleString()}** tokens out of **${tokenLimit.toLocaleString()}**`

    const label = tokenRatio > 33 ? 'DANGER' : tokenRatio > 22 ? 'WARNING' : 'NOTE'
    return `\n\n> [!${label}]- ${tokenGraph}\n> Using ${tokenCount} max tokens.`
}

export function getTokenCount(messages: ChatMessage[]): number {
    const tiktoken = new Tiktoken(cl100k_base)

    const fullHistory = messages.map((message) => `${message.name ?? message.role}\n${message.content}`)
    const tokenLength = tiktoken.encode(fullHistory.join('\n')).length + messages.length * 3

    return tokenLength
}
