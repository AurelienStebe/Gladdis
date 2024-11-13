import OpenAI, { toFile } from 'openai'

import { processText } from './history.js'
import { resolveFile } from './scanner.js'
import { writeErrorModal, writeInvalidModal } from './loggers.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)!\[\[([^\]]+?\.(flac|mp3|mp4|m4a|wav|mpeg|mpga|ogg|webm))\]\](?!.*%>)/gis

export async function transcribe(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, filePath] of content.matchAll(linkRegex)) {
            const disk = context.file.disk
            let transcript: string | undefined

            const fullPath = await resolveFile(filePath, context)
            if (fullPath === undefined) continue

            try {
                if (context.whisper.language === undefined && context.whisper.server === undefined) {
                    transcript = await translation(fullPath, context)
                } else {
                    transcript = await transcription(fullPath, context)
                }
            } catch (error: unknown) {
                await writeErrorModal(error, 'OpenAI Whisper API Error', context)
            }

            if (transcript === undefined) continue

            if (transcript.trim() === '') {
                await writeInvalidModal([], `No Transcript from "${filePath}"`, context)
                continue
            }

            if (context.whisper.deleteFile) void disk.deleteFile(fullPath)

            transcript = transcript.replaceAll('>> ', '\n>> ').trim()

            if (context.whisper.echoOutput) {
                const transcriptEsc = transcript.replaceAll('>> ', '\uFEFF- ')
                const transcriptLabel = `\n\n> [!QUOTE]- Transcript from "${filePath}"`
                const transcriptQuote = '\n> ' + transcriptEsc.split('\n').join('\n>\n> ')

                await disk.appendFile(context.file.path, transcriptLabel + transcriptQuote)
            }

            content = content.replace(fullMatch, `"${transcript}" (${context.whisper.liveSuffix})`)
        }

        return content
    })
}

export async function translation(filePath: string, context: Context): Promise<string> {
    const openai = new OpenAI({
        apiKey: context.user.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
    })

    const translation = await openai.audio.translations.create({
        response_format: 'json',
        model: context.whisper.model,
        prompt: context.whisper.input,
        file: await toFile(context.file.disk.readBinary(filePath)),
        temperature: context.whisper.temperature / 100,
    })

    return translation.text
}

export async function transcription(filePath: string, context: Context): Promise<string> {
    const openai = new OpenAI({
        apiKey: context.user.env.OPENAI_API_KEY,
        baseURL: context.whisper.server,
        dangerouslyAllowBrowser: true,
    })

    const transcription = await openai.audio.transcriptions.create({
        response_format: 'json',
        model: context.whisper.model,
        prompt: context.whisper.input,
        file: await toFile(context.file.disk.readBinary(filePath)),
        temperature: context.whisper.temperature / 100,
        language: context.whisper.language,
    })

    // The LocalAI API does not join segments correctly.
    if ((transcription as any).segments !== undefined) {
        return (transcription as any).segments.map((s: any) => s.text).join(' ') // eslint-disable-line
    }

    return transcription.text
}
