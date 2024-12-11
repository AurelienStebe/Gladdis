import OpenAI from 'openai'
import { deepmerge } from 'deepmerge-ts'

import { transcribe } from './utils/whisper.js'
import { parseLinks, loadImages } from './utils/scanner.js'
import { webBrowser } from './utils/browser.js'
import { logGladdisCall, logGladdisChat, getTokenModal, writeErrorModal } from './utils/loggers.js'

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

    await Promise.all(
        context.user.history.map(async (message) => {
            message.content = await parseLinks(message.content, context)
        }),
    )

    const corePrompt = context.user.env.GLADDIS_CORE_PROMPT ?? defaultCorePrompt
    const metaPrompt = context.user.env.GLADDIS_META_PROMPT ?? defaultMetaPrompt

    if (Object.entries(chatContext as Context).length > 0) {
        const metadata = `${metaPrompt} \`${JSON.stringify(chatContext)}\``
        context.user.history.unshift({ role: 'system', content: metadata })
    }

    if (corePrompt.trim() !== '') {
        context.user.history.unshift({ role: 'system', content: corePrompt.trim() })
    }

    if (context.user.prompt !== '') {
        context.user.prompt = await transcribe(context.user.prompt, context)
        context.user.prompt = await parseLinks(context.user.prompt, context)
        context.user.prompt = await webBrowser(context.user.prompt, context)

        context.user.history.push({
            role: 'user',
            content: context.user.prompt,
            name: context.user.label,
        })
    }

    context = await callGladdis(context)

    void logGladdisCall(context)
    void logGladdisChat(context)

    let tokenModal = getTokenModal(context)
    if (tokenModal.contains('__@__@__@__')) tokenModal = ''

    const message = `${tokenModal}\n\n---\n\n__${context.user.label}:__ `
    await context.file.disk.appendFile(context.file.path, message)
}

export async function callGladdis(context: Context): Promise<Context> {
    const disk = context.file.disk
    const response: string[] = []

    const openai = new OpenAI({
        apiKey: context.user.env.OPENAI_API_KEY,
        baseURL: context.gladdis.server,
        dangerouslyAllowBrowser: true,
    })

    try {
        const stream = await openai.chat.completions.create({
            stream: true,
            model: context.gladdis.model.label,
            messages: context.gladdis.model.vision ? await loadImages(context) : context.user.history,
            temperature: context.gladdis.temperature / 100,
            top_p: context.gladdis.top_p_param / 100,
            frequency_penalty: context.gladdis.freq_penalty / 100,
            presence_penalty: context.gladdis.pres_penalty / 100,
        })

        await disk.appendFile(context.file.path, `\n\n__${context.gladdis.label}:__ `)

        for await (const data of stream) {
            if ((data.choices[0].delta.content ?? '') !== '') {
                response.push(data.choices[0].delta.content ?? '')
                await disk.appendFile(context.file.path, data.choices[0].delta.content ?? '')
            }
        }
    } catch (error) {
        await writeErrorModal(error, 'OpenAI API Streaming Error', context)
    }

    context.user.history.push({ role: 'assistant', content: response.join('') })

    return context
}
