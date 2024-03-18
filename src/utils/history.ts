import type { Context, ChatMessage, ChatRoleEnum } from '../types/context.js'

export type Processor = (content: string, context: Context) => Promise<string>

const transcriptRegex = /^\[!QUOTE\][+-]? Transcript from "([^"]+?)"$/i
const pdfContentRegex = /^\[!ABSTRACT\][+-]? Content from "([^"]+?\.pdf)"$/i
const webContentRegex = /^\[!EXAMPLE\][+-]? Content from "(https:\/\/[^"]+?)"$/i

export function parseHistory(context: Context): ChatMessage[] {
    const lines = (context.file.text + '\n---\n').split('\n')
    const history: ChatMessage[] = []

    let label = context.user.label

    let prompt: string[] = []
    let quotes: string[][] = [[]]

    let codeBlock = false
    let textBlock = false

    for (const line of lines) {
        if (codeBlock || textBlock) {
            if (line.trimEnd().endsWith('```')) codeBlock = false
            if (line.trimEnd().endsWith('"""')) textBlock = false

            prompt.push(line)
        } else if (line.trimStart().startsWith('```')) {
            if (quotes[0].length !== 0) quotes.unshift([])

            if (!line.trimEnd().endsWith('```')) codeBlock = true
            if (line.trim() === '```') codeBlock = true

            prompt.push(line)
        } else if (line.trimStart().startsWith('"""')) {
            if (quotes[0].length !== 0) quotes.unshift([])

            if (!line.trimEnd().endsWith('"""')) textBlock = true
            if (line.trim() === '"""') textBlock = true

            prompt.push(line)
        } else if (line.trim() === '---') {
            history.push(parsePrompt(label, prompt, quotes, context))
            label = context.user.label

            prompt = []
            quotes = [[]]
        } else if (line.startsWith('>')) {
            quotes[0].push(line.startsWith('> ') ? line.slice(2) : line.slice(1))
        } else {
            if (quotes[0].length !== 0) quotes.unshift([])

            const labelMatch = line.match(/^__(.+?):__ ?/)
            if (labelMatch !== null) {
                history.push(parsePrompt(label, prompt, quotes, context))

                prompt = [line.slice(labelMatch[0].length)]
                label = labelMatch[1]
            } else {
                prompt.push(line)
            }
        }
    }

    return history.filter((message) => message.content.trim() !== '')
}

export function parsePrompt(label: string, prompt: string[], quotes: string[][], context: Context): ChatMessage {
    let content = prompt.join('\n').trim()

    for (const lines of quotes) {
        if (lines[0] === undefined) continue

        const transcriptMatch = transcriptRegex.exec(lines[0])
        if (transcriptMatch !== null) {
            const transcript = lines.slice(1).join('\n').trim()
            if (context.whisper.deleteFile) void context.file.disk.deleteFile(transcriptMatch[1])
            content = content.replace(`![[${transcriptMatch[1]}]]`, `"${transcript}" (${context.whisper.readSuffix})`)
        }

        const pdfContentMatch = pdfContentRegex.exec(lines[0])
        if (pdfContentMatch !== null) {
            const pdfContent = lines.slice(1).join('\n').trim().replaceAll('<\uFEFF', '<')
            content = content
                .replace(`![[${pdfContentMatch[1]}]]`, `"${pdfContentMatch[1]}":\n"""\n${pdfContent}\n"""\n\n`)
                .replace(`[[${pdfContentMatch[1]}]]`, `"${pdfContentMatch[1]}":\n"""\n${pdfContent}\n"""\n\n`)
        }

        const webContentMatch = webContentRegex.exec(lines[0])
        if (webContentMatch !== null) {
            const webContent = lines.slice(1).join('\n').trim().replaceAll('<\uFEFF', '<')
            content = content.replace(
                `<${webContentMatch[1]}>`,
                `@"${webContentMatch[1]}"\n"""\n${webContent}\n"""\n\n`,
            )
        }
    }

    let role: ChatRoleEnum = 'user'

    if (['system', 'assistant'].includes(label.toLowerCase())) role = label.toLowerCase() as ChatRoleEnum
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

        return `__${label}:__ ${message.content}`
    })

    return history.join('\n\n') + '\n'
}

export async function processText(content: string, context: Context, process: Processor): Promise<string> {
    const result: string[] = []
    let liveText: string[] = []

    let codeBlock = false
    let textBlock = false

    for (const line of content.split('\n')) {
        if (codeBlock || textBlock) {
            if (line.trimEnd().endsWith('```')) codeBlock = false
            if (line.trimEnd().endsWith('"""')) textBlock = false

            result.push(line)
        } else if (line.trimStart().startsWith('```')) {
            if (liveText.length > 0) {
                result.push(await process(liveText.join('\n'), context))
                liveText = []
            }

            if (!line.trimEnd().endsWith('```')) codeBlock = true
            if (line.trim() === '```') codeBlock = true

            result.push(line)
        } else if (line.trimStart().startsWith('"""')) {
            if (liveText.length > 0) {
                result.push(await process(liveText.join('\n'), context))
                liveText = []
            }

            if (!line.trimEnd().endsWith('"""')) textBlock = true
            if (line.trim() === '"""') textBlock = true

            result.push(line)
        } else {
            liveText.push(line)
        }
    }

    result.push(await process(liveText.join('\n'), context))

    return result.join('\n').trim()
}
