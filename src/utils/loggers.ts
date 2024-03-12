import { deepmerge } from 'deepmerge-ts'
import { getEncoding } from 'js-tiktoken'

import { writeHistory } from './history.js'
import { stringifyYaml } from '../commands.js'

import type { Context, ChatMessage } from '../types/context.js'

const tiktoken = getEncoding('cl100k_base')

const modelLimit: Record<string, number> = {
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-0125': 16385,
    'gpt-3.5-turbo-1106': 16385,
    'gpt-3.5-turbo-16k': 16385,
    'gpt-3.5-turbo-16k-0613': 16385,
    'gpt-4-turbo-preview': 128000,
    'gpt-4-0125-preview': 128000,
    'gpt-4-1106-preview': 128000,
    'gpt-4-32k': 32768,
    'gpt-4-32k-0613': 32768,
}

export async function logGladdisCall(context: Context): Promise<void> {
    const disk = context.file.disk

    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = disk.joinPath(context.user.data, 'history', 'calls', ...dateDir)
    const logFile = disk.joinPath(logPath, context.file.date.getTime() + '.md')

    await disk.pathEnsure(logPath)

    const logContext: any = deepmerge({}, context)
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${stringifyYaml(logContext)}---\n\n`
    await disk.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const disk = context.file.disk

    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = disk.joinPath(context.user.data, 'history', 'chats', ...dateDir)
    const logFile = disk.joinPath(logPath, context.file.name + '.md')

    await disk.pathEnsure(logPath)

    const userIdx = context.user.history.findLastIndex((message) => message.role === 'user')
    const history = deepmerge({}, context.user.history.slice(userIdx))

    history.forEach((message, index) => {
        const date = index === 0 ? context.file.date : new Date()
        message.content = `[${date.toISOString().split('T')[1]}] ${message.content}`
    })

    const logContext = deepmerge({}, context)
    logContext.user.history = history

    await disk.appendFile(logFile, '\n' + writeHistory(logContext))
}

export function getTokenModal(context: Context): string {
    const lowerLimit = context.gladdis.model.startsWith('gpt-4') ? 8192 : 4096
    const tokenLimit = modelLimit[context.gladdis.model] ?? lowerLimit

    const getTokenRatio = (count: number): number => Math.min(Math.ceil((count / tokenLimit) * 36), 36)

    const systemIndex = context.user.history.findIndex((message) => message.role !== 'system')
    const promptIndex = context.user.history.findLastIndex((message) => message.role === 'user')

    const systemCount = getTokenCount(context.user.history.slice(0, systemIndex))
    const systemGraph = '@'.repeat(Math.max(getTokenRatio(systemCount), 1))

    const middleCount = getTokenCount(context.user.history.slice(systemIndex, promptIndex))
    const middleGraph = '@'.repeat(Math.max(getTokenRatio(middleCount), 1))

    const promptCount = getTokenCount(context.user.history.slice(promptIndex))
    const promptGraph = '@'.repeat(Math.max(getTokenRatio(promptCount), 1))

    const tokenCount = systemCount + middleCount + promptCount
    const tokenRatio = Math.max(getTokenRatio(tokenCount), 3)

    const tokenGraph = `[__${systemGraph}__${middleGraph}__${promptGraph}__${'-'.repeat(36 - tokenRatio)}]`
    const tokenUsage = `**${tokenCount.toLocaleString()}** tokens out of **${tokenLimit.toLocaleString()}**`

    const label = tokenRatio > 33 ? 'DANGER' : tokenRatio > 22 ? 'WARNING' : 'NOTE'
    return `\n\n> [!${label}]- ${tokenGraph}\n> Using ${tokenUsage} max tokens.`
}

export function getTokenCount(messages: ChatMessage[]): number {
    let tokenLength = messages.length * 4

    for (const message of messages) {
        const prefix = message.name !== undefined ? message.name + '\n' : ''
        tokenLength += tiktoken.encode(prefix + message.content).length
    }

    return tokenLength
}

export async function writeErrorModal(error: any, message: string, context: Context): Promise<void> {
    const errorName = `\n\n> [!BUG]+ **${error?.message ?? message}**\n> `
    const errorJSON = '```json\n> ' + JSON.stringify(error, null, '>   ') + '\n> ```'

    await context.file.disk.appendFile(context.file.path, errorName + errorJSON)
}

export async function writeMissedModal(filePath: string, message: string, context: Context): Promise<void> {
    const errorFull = `\n\n> [!MISSING]+ **${message}**\n> ${filePath}`
    await context.file.disk.appendFile(context.file.path, errorFull)
}

export async function writeInvalidModal(errors: string[], message: string, context: Context): Promise<void> {
    let errorFull = `\n\n> [!ERROR]+ **${message}**\n> - ${errors.join('\n> - ')}`
    if (errors.length === 0) errorFull = `\n\n> [!ERROR] ${message}`

    await context.file.disk.appendFile(context.file.path, errorFull)
}
