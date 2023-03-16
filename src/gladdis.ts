import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { OpenAIChat } from 'langchain/llms'
import { transcribe } from './whisper.js'

import type { ChatCompletionRequestMessage } from 'openai'
import type { Context } from './types.js'

const gladdisMemory: ChatCompletionRequestMessage[] = []

export async function askGladdis(context: Context): Promise<void> {
    context = await transcribe(context)

    await fs.appendFile(context.file.path, `**${context.gladdis.label}:** `)
    await chatWithGladdis(context)
    await fs.appendFile(context.file.path, `\n\n---\n\n**${context.user.label}:** \n\n`)
}

export async function chatWithGladdis(context: Context): Promise<void> {
    const chatContext = merge({}, context) as any

    delete chatContext.file
    delete chatContext.user
    delete chatContext.gladdis
    delete chatContext.whisper

    const prefixMessages: ChatCompletionRequestMessage[] = [
        { role: 'system', content: context.gladdis.corePrompt },
        { role: 'system', content: context.gladdis.metaPrompt + JSON.stringify(chatContext) },
        ...gladdisMemory.slice(),
    ]

    const gladdis = new OpenAIChat({
        prefixMessages,
        modelName: context.gladdis.model,
        temperature: context.gladdis.temperature,
        topP: context.gladdis.top_p_param,
        frequencyPenalty: context.gladdis.freq_penalty,
        presencePenalty: context.gladdis.pres_penalty,
        cache: false,
        streaming: true,
        callbackManager: {
            async handleNewToken(token) {
                await fs.appendFile(context.file.path, token)
            },
        },
    })

    gladdisMemory.push({ role: 'user', content: context.user.prompt, name: context.user.label })
    gladdisMemory.push({ role: 'assistant', content: await gladdis.call(context.user.prompt) })
}
