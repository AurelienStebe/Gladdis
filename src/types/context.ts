export type ChatRoleEnum = 'user' | 'system' | 'assistant'

export interface ChatMessage {
    role: ChatRoleEnum
    content: string
    name?: string
}

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
        config?: string
        model: string
        temperature: number
        top_p_param: number
        freq_penalty: number
        pres_penalty: number
    }
    whisper: {
        input: string
        config?: string
        model: string
        liveSuffix: string
        readSuffix: string
        temperature: number
        echoOutput: boolean
        deleteFile: boolean
        language?: string
    }
}
