import OpenAI from 'openai'
import { deepmerge } from 'deepmerge-ts'

import { parseLinks } from './utils/scanner.js'
import { transcribe } from './utils/whisper.js'
import { logGladdisCall, logGladdisChat, getTokenModal } from './utils/loggers.js'

import type { Context } from './types/context.js'

const defaultCorePrompt =
    '**Heuristics**\n' +
    'Your 3 key Heuristic Imperatives are to:\n' +
    '  - reduce suffering in the universe.\n' +
    '  - increase prosperity in the universe.\n' +
    '  - increase understanding in the universe.'

const defaultMetaPrompt = '**Metadata** (as JSON):'

export async function doGladdis(context: Context): Promise<void> {
    const chatContext: any = deepmerge({ whisper: {} }, context)

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    for (const message of context.user.history) {
        message.content = await parseLinks(message.content, context)
    }

    const corePrompt = context.user.env.GLADDIS_CORE_PROMPT ?? defaultCorePrompt
    const metaPrompt = context.user.env.GLADDIS_META_PROMPT ?? defaultMetaPrompt

    if (Object.entries(chatContext as Context).length > 0) {
        const metadata = `${metaPrompt} \`${JSON.stringify(chatContext)}\``
        context.user.history.unshift({ role: 'system', content: metadata })
    }

    context.user.history.unshift({ role: 'system', content: corePrompt })

    context.user.prompt = await transcribe(context.user.prompt, context)
    context.user.prompt = await parseLinks(context.user.prompt, context)

    context.user.history.push({
        role: 'user',
        content: context.user.prompt,
        name: context.user.label,
    })

    context = await callGladdis(context)

    void logGladdisCall(context)
    void logGladdisChat(context)
}

export async function callGladdis(context: Context): Promise<Context> {
    const disk = context.file.disk
    const response: string[] = []

    const openai = new OpenAI({
        apiKey: context.user.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
    })

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
                await disk.appendFile(context.file.path, `\n\n__${context.gladdis.label}:__ `)
            }

            if ((data.choices[0].delta?.content ?? '') !== '') {
                response.push(data.choices[0].delta?.content ?? '')
                await disk.appendFile(context.file.path, data.choices[0].delta?.content ?? '')
            }
        }
    } catch (error: any) {
        const errorName: string = error?.message ?? 'OpenAI API Streaming Error'
        const errorJSON: string = '```json\n> ' + JSON.stringify(error) + '\n> ```'

        const errorFull = `\n\n> [!BUG]+ **${errorName}**\n> ${errorJSON}`
        await disk.appendFile(context.file.path, errorFull)
    }

    context.user.history.push({ role: 'assistant', content: response.join('') })

    await disk.appendFile(context.file.path, getTokenModal(context))
    await disk.appendFile(context.file.path, `\n\n---\n\n__${context.user.label}:__ `)

    return context
}
