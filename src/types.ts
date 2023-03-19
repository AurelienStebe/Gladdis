import type { ChatCompletionRequestMessage } from 'openai'

export interface Context {
    file: {
        path: string
        text: string
        data: string
        date: Date
    }
    user: {
        label: string
        prompt: string
        history: ChatCompletionRequestMessage[]
    }
    gladdis: {
        label: string
        corePrompt: string
        metaPrompt: string
        model: string
        temperature: number
        top_p_param: number
        freq_penalty: number
        pres_penalty: number
    }
    whisper: {
        label: string
        prompt: string
        model: string
        echoScript: boolean
        deleteFile: boolean
        temperature: number
        language?: string
    }
}
