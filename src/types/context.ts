import type {
    ChatCompletionRequestMessage as ChatMessage,
    ChatCompletionRequestMessageRoleEnum as ChatRoleEnum,
} from 'openai'

export type { ChatMessage, ChatRoleEnum }

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
        history: ChatMessage[]
    }
    gladdis: {
        label: string
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
