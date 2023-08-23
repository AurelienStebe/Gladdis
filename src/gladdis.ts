import fs from 'fs-extra'
import OpenAI from 'openai'
import merge from 'deepmerge'

import { parseLinks } from './utils/scanner.js'
import { transcribe } from './utils/whisper.js'
import { logGladdisCall, logGladdisChat, getTokenModal } from './utils/loggers.js'

import type { Context, ChatMessage } from './types/context.js'

const defaultCorePrompt =
    '_Heuristics_\n' +
    'Your 3 key Heuristic Imperatives are to:\n' +
    '  - reduce suffering in the universe.\n' +
    '  - increase prosperity in the universe.\n' +
    '  - increase understanding in the universe.'

const defaultMetaPrompt = '_Metadata_ (as JSON):'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function askGladdis(context: Context): Promise<void> {
    const chatContext = merge({}, context) as any

    chatContext.whisper.echoOutput = false
    chatContext.whisper.deleteFile = false

    for (const message of context.user.history) {
        message.content = await transcribe(message.content, chatContext)
        message.content = await parseLinks(message.content, chatContext)
    }

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    const corePrompt = process.env.GLADDIS_CORE_PROMPT ?? defaultCorePrompt
    const metaPrompt = process.env.GLADDIS_META_PROMPT ?? defaultMetaPrompt

    if (Object.entries(chatContext).length > 0) {
        const metadata = `${metaPrompt} \`${JSON.stringify(chatContext)}\``
        context.user.history.unshift({ role: 'system', content: metadata })
    }

    context.user.history.unshift({ role: 'system', content: corePrompt })

    context.user.prompt = await transcribe(context.user.prompt, context)
    context.user.prompt = await parseLinks(context.user.prompt, context)

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
