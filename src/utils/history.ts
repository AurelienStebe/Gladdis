import { parseTranscript } from './whisper.js'

import type { Context, ChatMessage, ChatRoleEnum } from '../types/context.js'

export function parseHistory(context: Context): ChatMessage[] {
    const lines = (context.file.text + '\n---\n').split('\n')
    const history: ChatMessage[] = []

    let label = context.user.label

    let prompt: string[] = []
    let quotes: string[] = []

    let codeBlock = false
    let textBlock = false

    lines.forEach((line) => {
        if (codeBlock || textBlock) {
            if (line.trimEnd().endsWith('```')) codeBlock = false
            if (line.trimEnd().endsWith('"""')) textBlock = false

            prompt.push(line)
        } else if (line.trimStart().startsWith('```')) {
            if (!line.trimEnd().endsWith('```')) codeBlock = true

            prompt.push(line)
        } else if (line.trimStart().startsWith('"""')) {
            if (!line.trimEnd().endsWith('"""')) textBlock = true

            prompt.push(line)
        } else if (line.trim() === '---') {
            history.push(parsePrompt(label, prompt, quotes, context))
            label = context.user.label
            prompt = []
            quotes = []
        } else if (line.startsWith('>')) quotes.push(line.slice(1))
        else {
            if (quotes.at(-1) !== '\n\n') quotes.push('\n\n')

            const labelMatch = line.match(/^\*\*(.+?):\*\*/)
            if (labelMatch !== null) {
                history.push(parsePrompt(label, prompt, quotes, context))

                prompt = [line.slice(labelMatch[0].length).trimStart()]
                label = labelMatch[1]
            } else {
                prompt.push(line)
            }
        }
    })

    return history.filter((message) => message.content !== '')
}

export function parsePrompt(label: string, prompt: string[], quotes: string[], context: Context): ChatMessage {
    const content = parseTranscript(prompt.join('\n').trim(), quotes.join('\n').trim(), context)

    let role: ChatRoleEnum = 'user'
    if (label.toLowerCase() in ['system', 'assistant']) role = label.toLowerCase() as ChatRoleEnum
    if (label.toLowerCase() === context.gladdis.label.toLowerCase()) role = 'assistant'

    const message: ChatMessage = { role, content }
    if (role === 'user' && label.toLowerCase() !== 'user') message.name = label

    return message
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
