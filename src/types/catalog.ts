import type { ModelDetails } from './context.js'

export const modelCatalog: Array<ModelDetails> = [
    {
        label: 'gpt-4o-audio',
        limit: 128000,
        hearing: true,
        speaking: true,
    },
    {
        label: 'gpt-4o',
        limit: 128000,
        vision: true,
    },
    {
        label: 'chatgpt-4o',
        limit: 128000,
        vision: true,
    },
    {
        label: 'o1',
        limit: 128000,
    },
    {
        label: 'gpt-4-turbo',
        limit: 128000,
        vision: true,
    },
    {
        label: 'gpt-4',
        limit: 8192,
        vision: true,
    },
    {
        label: 'gpt-3.5-turbo',
        limit: 16385,
    },
    {
        label: 'llama3',
        limit: 128000,
    },
    {
        label: 'llama',
        limit: 4096,
    },
    {
        label: 'phi3',
        limit: 128000,
    },
    {
        label: 'phi',
        limit: 2048,
    },
    {
        label: 'qwen2',
        limit: 128000,
    },
    {
        label: 'qwen',
        limit: 8192,
    },
    {
        label: 'gemma2',
        limit: 128000,
    },
    {
        label: 'gemma',
        limit: 8192,
    },
    {
        label: 'llava',
        limit: 4096,
        vision: true,
    },
]
