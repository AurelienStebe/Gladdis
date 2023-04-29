import path from 'path'
import fs from 'fs-extra'
import { OpenAIApi, Configuration } from 'openai'

import type { Context } from '../types/context.js'

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }))

export async function transcribe(context: Context): Promise<Context> {
    const audioFileRegex = /!\[\[(.+?\.(mp3|mp4|mpeg|mpga|m4a|wav|webm))\]\]/gi

    for (const [fullMatch, audioFileName] of context.user.prompt.matchAll(audioFileRegex)) {
        const audioFilePath = path.resolve(path.dirname(context.file.path), audioFileName)

        if (await fs.pathExists(audioFilePath)) {
            let transcript
            if (context.whisper.language === undefined) {
                transcript = await translation(audioFilePath, context)
            } else {
                transcript = await transcription(audioFilePath, context)
            }

            if (context.whisper.deleteFile) void fs.remove(audioFilePath)

            if (context.whisper.echoScript) {
                const transcriptLabel = `\n\n> [!${context.whisper.label} of "${audioFileName}"]\n> `
                const transcriptQuote = transcriptLabel + transcript.split('\n').join('\n> ') + '\n'

                await fs.appendFile(context.file.path, transcriptQuote)
            }

            context.user.prompt = context.user.prompt.replace(fullMatch, `"${transcript}" (dictated, but not read)`)
        } else {
            const warning = `\n\n> [!WARNING]\n> **Audio File Not Found:**\n>\n> ${audioFilePath}`
            await fs.appendFile(context.file.path, warning)
        }
    }

    return context
}

export async function translation(filePath: string, context: Context): Promise<string> {
    const fileReadStream = fs.createReadStream(filePath)

    const translation = await openai.createTranslation(
        fileReadStream as unknown as File,
        context.whisper.model,
        context.whisper.prompt,
        'json',
        context.whisper.temperature / 100
    )

    fileReadStream.destroy()
    return translation.data.text
}

export async function transcription(filePath: string, context: Context): Promise<string> {
    const fileReadStream = fs.createReadStream(filePath)

    const transcription = await openai.createTranscription(
        fileReadStream as unknown as File,
        context.whisper.model,
        context.whisper.prompt,
        'json',
        context.whisper.temperature / 100,
        context.whisper.language
    )

    fileReadStream.destroy()
    return transcription.data.text
}

export function parseTranscript(prompt: string, quotes: string, context: Context): string {
    const transcriptRegex = new RegExp(`\\[!${context.whisper.label} of "(.+?)"\\]`, 'gi')

    for (const transcriptMatch of quotes.matchAll(transcriptRegex)) {
        const start = (transcriptMatch.index ?? 0) + transcriptMatch[0].length
        const stop = quotes.indexOf('\n\n', start) + 1

        const transcript = quotes.slice(start, stop === 0 ? undefined : stop).trim()
        prompt = prompt.replace(`![[${transcriptMatch[1]}]]`, `"${transcript}" (transcribed and read)`)
    }

    return prompt
}
