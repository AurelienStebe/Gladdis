import type {
    ChatCompletionRequestMessage as ChatMessage,
    ChatCompletionRequestMessageRoleEnum as ChatRoleEnum,
} from 'openai'

export type { ChatMessage, ChatRoleEnum }

export interface Context {
    file: {
        date: Date
        name: string
        path: string
        text: string
    }
    user: {
        data: string
        label: string
        prompt: string
        history: ChatMessage[]
    }
    gladdis: {
        label: string
        config: string
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
