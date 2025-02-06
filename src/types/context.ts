import type { Vault } from 'obsidian'

export type ChatRoleEnum = 'user' | 'system' | 'assistant'

export interface ChatMessage {
    role: ChatRoleEnum
    content: string
    name?: string
}

export interface ModelDetails {
    label: string
    limit?: number
    vision?: boolean
    hearing?: boolean
    speaking?: boolean
    reasoning?: boolean | 'low' | 'medium' | 'high'
}

export interface DiskInterface {
    vault?: Vault
    readFile: (path: string) => Promise<string>
    readBinary: (path: string) => Promise<ArrayBuffer>
    appendFile: (path: string, data: string) => Promise<void>
    deleteFile: (path: string) => Promise<void>
    pathExists: (path: string) => Promise<boolean>
    pathEnsure: (path: string) => Promise<void>
    baseName: (path: string, ext?: string) => string
    extName: (path: string) => string
    joinPath: (...paths: string[]) => string
    dirName: (path: string) => string
}

export interface Context {
    file: {
        date: Date
        name: string
        path: string
        text: string
        disk: DiskInterface
    }
    user: {
        env: NodeJS.ProcessEnv
        data: string
        label: string
        prompt: string
        history: ChatMessage[]
    }
    gladdis: {
        label: string
        config?: string
        model: ModelDetails
        server?: string
        temperature: number
        top_p_param: number
        freq_penalty: number
        pres_penalty: number
    }
    whisper: {
        input: string
        config?: string
        model: string
        server?: string
        liveSuffix: string
        readSuffix: string
        temperature: number
        echoOutput: boolean
        deleteFile: boolean
        language?: string
    }
}
