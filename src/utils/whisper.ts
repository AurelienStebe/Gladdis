import fs from 'fs-extra'
import OpenAI from 'openai'

import { processText } from './history.js'
import { resolveFile } from './scanner.js'

import type { Context } from '../types/context.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const linkRegex = /(?<!<%.*)!\[\[(.+?\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm))\]\](?!.*%>)/gis

export async function transcribe(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, filePath] of content.matchAll(linkRegex)) {
            const fullPath = await resolveFile(filePath, context)
            if (fullPath === undefined) continue

            let transcript
            if (context.whisper.language === undefined) {
                transcript = await translation(fullPath, context)
            } else {
                transcript = await transcription(fullPath, context)
            }

            if (context.whisper.deleteFile) void fs.remove(fullPath)

            if (context.whisper.echoOutput) {
                const transcriptLabel = `\n\n> [!QUOTE]+ Transcript from "${filePath}"`
                const transcriptQuote = '\n> ' + transcript.split('\n').join('\n>\n> ')

                await fs.appendFile(context.file.path, transcriptLabel + transcriptQuote)
            }

            content = content.replace(fullMatch, `"${transcript}" (${context.whisper.liveSuffix})`)
        }

        return content
    })
}

export async function translation(filePath: string, context: Context): Promise<string> {
    const translation = await openai.audio.translations.create({
        response_format: 'json',
        model: context.whisper.model,
        prompt: context.whisper.input,
        file: fs.createReadStream(filePath),
        temperature: context.whisper.temperature / 100,
    })

    return translation.text
}

export async function transcription(filePath: string, context: Context): Promise<string> {
    const transcription = await openai.audio.transcriptions.create({
        response_format: 'json',
        model: context.whisper.model,
        prompt: context.whisper.input,
        file: fs.createReadStream(filePath),
        temperature: context.whisper.temperature / 100,
        language: context.whisper.language,
    })

    return transcription.text
}
