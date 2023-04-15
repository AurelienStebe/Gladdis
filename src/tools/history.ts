import { Tiktoken } from '@dqbd/tiktoken/lite'
import { parseTranscript } from '../whisper.js'

import type { Context, ChatMessage, ChatRoleEnum } from '../types/context.js'

import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' }

export function loadHistory(context: Context): Context {
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

    return context
}

function parsePrompt(prompt: string, quotes: string, context: Context): Context {
    let role: ChatRoleEnum = 'user'
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

    const message: ChatMessage = { role, content }
    if (role === 'user') message.name = context.user.label
    context.user.history.push(message)

    return labelMatch !== null ? parsePrompt(prompt, quotes, context) : context
}

export function writeHistory(context: Context): string {
    const history = context.user.history.map((message) => {
        let label = message.name ?? context.user.label

        if (message.role === 'system') label = 'System'
        if (message.role === 'assistant') label = context.gladdis.label

        return `**${label}:** ${message.content}`
    })

    return history.join('\n\n') + '\n'
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
