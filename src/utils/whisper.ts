import path from 'path'
import fs from 'fs-extra'
import { OpenAIApi, Configuration } from 'openai'

import type { Context } from '../types/context.js'

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }))

export async function transcribe(content: string, context: Context): Promise<string> {
    const audioRegex = /!\[\[(.+?\.(mp3|mp4|mpeg|mpga|m4a|wav|webm))\]\]/gi

    for (const [fullMatch, audioFile] of content.matchAll(audioRegex)) {
        const audioPath = path.resolve(path.dirname(context.file.path), audioFile)

        if (await fs.pathExists(audioPath)) {
            let transcript

            if (context.whisper.language === undefined) {
                transcript = await translation(audioPath, context)
            } else {
                transcript = await transcription(audioPath, context)
            }

            if (context.whisper.deleteFile) void fs.remove(audioPath)

            if (context.whisper.echoScript) {
                const transcriptLabel = `\n\n> [!QUOTE]+ Transcript from "${audioFile}"`
                const transcriptQuote = '\n> ' + transcript.split('\n').join('\n>\n> ')

                await fs.appendFile(context.file.path, transcriptLabel + transcriptQuote)
            }

            content = content.replace(fullMatch, `"${transcript}" (${context.whisper.liveSuffix})`)
        } else {
            const missing = `\n\n> [!MISSING]+ **Audio File Not Found**\n> `
            await fs.appendFile(context.file.path, missing + audioFile)
        }
    }

    return content
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
