import fs from 'fs'
import path from 'path'
import { OpenAIApi, Configuration } from 'openai'

import type { Context } from '../types/context.js'

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }))

export async function transcribe(context: Context): Promise<Context> {
    const audioFileRegex = /!\[\[(.+?\.(mp3|mp4|mpeg|mpga|m4a|wav|webm))\]\]/gi

    for (const [fullMatch, audioFileName] of context.user.prompt.matchAll(audioFileRegex)) {
        const audioFilePath = path.resolve(path.dirname(context.file.path), audioFileName)

        let transcript
        if (context.whisper.language === undefined) {
            transcript = await translation(audioFilePath, context)
        } else {
            transcript = await transcription(audioFilePath, context)
        }

        if (context.whisper.deleteFile) void fs.promises.rm(audioFilePath)

        if (context.whisper.echoScript) {
            const transcriptLabel = `\n\n> [!${context.whisper.label} of "${audioFileName}"]\n> `
            const transcriptQuote = transcriptLabel + transcript.split('\n').join('\n> ') + '\n'
            await fs.promises.appendFile(context.file.path, transcriptQuote)
        }

        context.user.prompt = context.user.prompt.replace(fullMatch, transcript)
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
        context.whisper.temperature
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
        context.whisper.temperature,
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

        const transcript = quotes.slice(start, stop === 0 ? undefined : stop)
        prompt = prompt.replace(`![[${transcriptMatch[1]}]]`, transcript.trim())
    }

    return prompt
}
