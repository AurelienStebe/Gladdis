import fs from 'fs-extra'
import merge from 'deepmerge'
import { OpenAIClient } from '@fern-api/openai'

import { transcribe } from './utils/whisper.js'
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
    context = await transcribe(context)

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
    const gladdisResponse: ChatMessage = {
        role: 'assistant',
        content: '',
    }

    let deferredPromise: (value: string) => void
    const finishMessage = new Promise<string>((resolve) => {
        deferredPromise = resolve
    })

    await openai.chat.createCompletion(
        {
            stream: true,
            model: context.gladdis.model,
            messages: context.user.history,
            temperature: context.gladdis.temperature / 100,
            topP: context.gladdis.top_p_param / 100,
            frequencyPenalty: context.gladdis.freq_penalty / 100,
            presencePenalty: context.gladdis.pres_penalty / 100,
        },
        (data) => {
            if (data.choices[0].delta.role === 'assistant') {
                fs.appendFileSync(context.file.path, `\n\n**${context.gladdis.label}:** `)
            }
            if (data.choices[0].delta.content !== undefined) {
                gladdisResponse.content += data.choices[0].delta.content
                fs.appendFileSync(context.file.path, data.choices[0].delta.content)
            }
        },
        {
            onFinish: () => {
                context.user.history.push(gladdisResponse)
                deferredPromise(`${getTokenModal(context)}\n\n---\n\n**${context.user.label}:** `)
            },
            onError: (error) => {
                context.user.history.push(gladdisResponse)
                deferredPromise(`${error?.toString() ?? '**Error**'}\n\n---\n\n**${context.user.label}:** `)
            },
        }
    )

    await fs.appendFile(context.file.path, await finishMessage)

    return context
}
