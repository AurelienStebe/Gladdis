import path from 'path'
import yaml from 'yaml'
import fs from 'fs-extra'
import merge from 'deepmerge'
import { Tiktoken } from '@dqbd/tiktoken/lite'

import { writeHistory } from './history.js'

import type { Context, ChatMessage } from '../types/context.js'

import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' }

export async function logGladdisCall(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = path.resolve(context.user.data, 'history', 'calls', ...dateDir)
    const logFile = path.resolve(logPath, `${context.file.date.getTime()}.md`)

    await fs.ensureDir(logPath)

    const logContext = merge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${yaml.stringify(logContext)}---\n\n`
    await fs.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0].split('-')
    const logPath = path.resolve(context.user.data, 'history', 'chats', ...dateDir)
    const logFile = path.resolve(logPath, context.file.name + '.md')

    await fs.ensureDir(logPath)

    const history = merge({}, context.user.history.slice(-2))
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`

    const logContext = merge({}, context)
    logContext.user.history = history

    await fs.appendFile(logFile, '\n' + writeHistory(logContext))
}

export function getTokenModal(context: Context): string {
    const tokenLength = getTokenCount(context.user.history)

    let tokenLimit = context.gladdis.model.startsWith('gpt-4') ? 8192 : 4096
    if (context.gladdis.model.startsWith('gpt-4-32k')) tokenLimit = 32768

    const tokenRatio = Math.ceil((tokenLength / tokenLimit) * 36)
    const tokenGraph = `[**${'#'.repeat(tokenRatio)}**${'-'.repeat(36 - tokenRatio)}]`
    const tokenCount = `**${tokenLength.toLocaleString()}** tokens out of **${tokenLimit.toLocaleString()}**`

    const label = tokenRatio > 33 ? 'DANGER' : tokenRatio > 22 ? 'WARNING' : 'NOTE'
    return `\n\n> [!${label}]- ${tokenGraph}\n> Using ${tokenCount} max tokens.`
}

export function getTokenCount(messages: ChatMessage[]): number {
    const tiktoken = new Tiktoken(cl100k_base.bpe_ranks, cl100k_base.special_tokens, cl100k_base.pat_str)

    const fullHistory = messages.map((message) => `${message.name ?? message.role}\n${message.content}`)
    const tokenLength = tiktoken.encode(fullHistory.join('\n')).length + messages.length * 3

    tiktoken.free()

    return tokenLength
}
