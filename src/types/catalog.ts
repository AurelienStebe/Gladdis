import type { ModelDetails } from './context.js'

export const modelCatalog: ModelDetails[] = [
    {
        label: 'o1',
        limit: 128_000,
    },
    {
        label: 'gpt-4o-audio',
        limit: 128_000,
        hearing: true,
        speaking: true,
    },
    {
        label: '(chat)?gpt-4o',
        limit: 128_000,
        vision: true,
    },
    {
        label: 'gpt-4-turbo',
        limit: 128_000,
        vision: true,
    },
    {
        label: 'gpt-4',
        limit: 8_192,
        vision: true,
    },
    {
        label: 'gpt-3.5-turbo',
        limit: 16_385,
    },
    {
        label: '(meta-)?llama-?3',
        limit: 128_000,
    },
    {
        label: '(meta-)?llama',
        limit: 4_096,
    },
    {
        label: 'phi-?3',
        limit: 128_000,
    },
    {
        label: 'phi',
        limit: 2_048,
    },
    {
        label: 'qwen2',
        limit: 128_000,
    },
    {
        label: 'qwen',
        limit: 8_192,
    },
    {
        label: 'gemma-?2',
        limit: 128_000,
    },
    {
        label: 'gemma',
        limit: 8_192,
    },
    {
        label: 'llava',
        limit: 4_096,
        vision: true,
    },
]
