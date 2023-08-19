import fs from 'fs-extra'
import merge from 'deepmerge'
import { OpenAIClient } from '@fern-api/openai'

import { transcribe } from './utils/whisper.js'
import { processText } from './utils/history.js'
import { logGladdisCall, logGladdisChat, getTokenModal } from './utils/loggers.js'

import type { Context, ChatMessage } from './types/context.js'

const openai = new OpenAIClient({ token: process.env.OPENAI_API_KEY ?? '' })

const defaultCorePrompt =
    '**Core Prompt**\n' +
    'You are Gladdis, trained by OpenAI.\n\n' +
    'Your 3 key Heuristic Imperatives are:\n' +
    '  - Reduce suffering in the universe.\n' +
    '  - Increase prosperity in the universe.\n' +
    '  - Increase understanding in the universe.'

const defaultMetaPrompt = '**Metadata Context** (in JSON format)\n'

export async function askGladdis(context: Context): Promise<void> {
    context.user.prompt = await processText(context.user.prompt, context, transcribe)

    const corePrompt = process.env.GLADDIS_CORE_PROMPT ?? defaultCorePrompt
    const metaPrompt = process.env.GLADDIS_META_PROMPT ?? defaultMetaPrompt

    const chatContext = merge({}, context) as any

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    if (Object.entries(chatContext).length > 0) {
        context.user.history.unshift({ role: 'system', content: metaPrompt + JSON.stringify(chatContext) })
    }

    context.user.history.unshift({ role: 'system', content: corePrompt })

    const promptMessage: ChatMessage = {
        role: 'user',
        content: context.user.prompt,
        name: context.user.label,
    }

    context.user.history.push(promptMessage)
    context = await chatWithGladdis(context)

    await logGladdisCall(context)
    await logGladdisChat(context)
}

export async function chatWithGladdis(context: Context): Promise<Context> {
    const response: string[] = []

    try {
        const stream = await openai.chat.completions.create({
            stream: true,
            model: context.gladdis.model,
            messages: context.user.history,
            temperature: context.gladdis.temperature / 100,
            top_p: context.gladdis.top_p_param / 100,
            frequency_penalty: context.gladdis.freq_penalty / 100,
            presence_penalty: context.gladdis.pres_penalty / 100,
        })

        for await (const data of stream) {
            if (data.choices[0].delta?.role === 'assistant') {
                await fs.appendFile(context.file.path, `\n\n__${context.gladdis.label}:__ `)
            }

            if ((data.choices[0].delta?.content ?? '') !== '') {
                response.push(data.choices[0].delta?.content ?? '')
                await fs.appendFile(context.file.path, data.choices[0].delta?.content ?? '')
            }
        }
    } catch (error: any) {
        const errorName: string = error?.message ?? 'OpenAI API Streaming Error'
        const errorJSON: string = '```json\n> ' + JSON.stringify(error) + '\n> ```'

        await fs.appendFile(context.file.path, `\n\n> [!BUG]+ **${errorName}**\n> ${errorJSON}`)
    }

    context.user.history.push({ role: 'assistant', content: response.join('') })

    await fs.appendFile(context.file.path, getTokenModal(context))
    await fs.appendFile(context.file.path, `\n\n---\n\n__${context.user.label}:__ `)

    return context
}
