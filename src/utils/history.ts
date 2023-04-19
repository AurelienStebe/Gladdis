import { parseTranscript } from './whisper.js'

import type { Context, ChatMessage, ChatRoleEnum } from '../types/context.js'

import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json' assert { type: 'json' }

export function loadHistory(context: Context): ChatMessage[] {
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

    return context.user.history
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
