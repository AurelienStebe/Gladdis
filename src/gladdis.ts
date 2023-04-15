import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { OpenAIClient } from '@fern-api/openai'

import { transcribe } from './whisper.js'
import { getTokenModal } from './utils/history.js'
import { logGladdisCall, logGladdisChat } from './utils/logging.js'

import type { Context, ChatMessage } from './types/context.js'

const openai = new OpenAIClient({ token: process.env.OPENAI_API_KEY ?? '' })

export async function askGladdis(context: Context): Promise<void> {
    context = await transcribe(context)

    const chatContext = merge({}, context) as any

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    const promptMessage: ChatMessage = {
        role: 'user',
        content: context.user.prompt,
        name: context.user.label,
    }

    const prefixMessages: ChatMessage[] = [
        { role: 'system', content: context.gladdis.corePrompt },
        { role: 'system', content: context.gladdis.metaPrompt + JSON.stringify(chatContext) },
    ]

    context.user.history.push(promptMessage)
    context.user.history.unshift(...prefixMessages)

    context = await chatWithGladdis(context)

    void logGladdisCall(context)
    void logGladdisChat(context)
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
            temperature: context.gladdis.temperature,
            topP: context.gladdis.top_p_param,
            frequencyPenalty: context.gladdis.freq_penalty,
            presencePenalty: context.gladdis.pres_penalty,
        },
        (data) => {
            if (data.choices[0].delta.role === 'assistant') {
                void fs.appendFile(context.file.path, `\n\n**${context.gladdis.label}:** `)
            }
            if (data.choices[0].delta.content !== undefined) {
                gladdisResponse.content += data.choices[0].delta.content
                void fs.appendFile(context.file.path, data.choices[0].delta.content)
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
