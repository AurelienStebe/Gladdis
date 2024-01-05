import { stringify } from 'yaml'
import { deepmerge } from 'deepmerge-ts'

import { describe, it, expect, afterEach, vi } from 'vitest'

import { diskInterface } from '../src/commands.js'
import { loadContext, loadContent } from '../src/utils/loaders.js'

import type { Context } from '../src/types/context.js'

const envVars = {
    GLADDIS_DATA_PATH: 'EnvVars',
    GLADDIS_NAME_LABEL: 'EnvVars',
    GLADDIS_DEFAULT_USER: 'Myself',
    GLADDIS_DEFAULT_MODEL: 'gpt-4',
    GLADDIS_TEMPERATURE: '10',
    GLADDIS_TOP_P_PARAM: '90',
    GLADDIS_FREQ_PENALTY: '10',
    GLADDIS_PRES_PENALTY: '-10',
    GLADDIS_WHISPER_INPUT: 'EnvVars',
    GLADDIS_WHISPER_MODEL: 'whisper-2',
    GLADDIS_WHISPER_LIVE_SUFFIX: 'EnvVars',
    GLADDIS_WHISPER_READ_SUFFIX: 'EnvVars',
    GLADDIS_WHISPER_TEMPERATURE: '10',
    GLADDIS_WHISPER_ECHO_OUTPUT: 'false',
    GLADDIS_WHISPER_DELETE_FILE: 'true',
    GLADDIS_WHISPER_LANGUAGE_ID: 'en',
}

const gladdis = {
    gladdis: {
        label: 'Gladdis',
        model: 'gpt-5',
        temperature: 20,
        top_p_param: 80,
        freq_penalty: 20,
        pres_penalty: -20,
    },
    whisper: {
        liveSuffix: 'Gladdis',
        readSuffix: 'Gladdis',
        temperature: 20,
        echoOutput: true,
        deleteFile: false,
    },
}

const whisper = {
    gladdis: {
        label: 'Whisper',
        model: 'gpt-6',
        temperature: 30,
        top_p_param: 70,
    },
    whisper: {
        model: 'whisper-3',
        liveSuffix: 'Whisper',
        temperature: 30,
        echoOutput: false,
        language: 'fr',
    },
}

const inputFM = {
    gladdis: {
        config: 'gladdis',
        model: 'gpt-7',
        temperature: 40,
    },
    whisper: {
        config: 'whisper',
        model: 'whisper-4',
        temperature: 40,
    },
}

const callEnv = {
    user: {
        data: 'CallEnv',
        label: 'CallEnv',
    },
    gladdis: {
        model: 'gpt-8',
        temperature: 50,
    },
    whisper: {
        temperature: 50,
        language: 'es',
    },
}

describe('the Context loaders', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('loads default values', async () => {
        diskInterface.readFile = vi.fn().mockResolvedValue('')
        const callContext: any = { file: { path: 'name.md' } }

        callContext.user = { env: { NODE_ENV: 'test' } }
        callContext.file.disk = diskInterface

        const context = await loadContext(callContext as Context)
        expect(loadContent(context)).toMatchSnapshot({
            file: {
                date: expect.any(Date),
                name: 'name',
                path: 'name.md',
                text: '',
                disk: expect.any(Object),
            },
            user: {
                env: { NODE_ENV: 'test' },
                data: '__DATA__',
                label: 'User',
                prompt: '',
                history: [],
            },
            gladdis: {
                label: 'Gladdis',
                config: undefined,
                model: 'gpt-3.5-turbo',
                temperature: 0,
                top_p_param: 100,
                freq_penalty: 0,
                pres_penalty: 0,
            },
            whisper: {
                input: 'Gladdis',
                config: undefined,
                model: 'whisper-1',
                liveSuffix: 'dictated, but not read',
                readSuffix: 'transcribed and read',
                temperature: 0,
                echoOutput: true,
                deleteFile: false,
                language: undefined,
            },
        })
    })

    it('loads EnvVars values', async () => {
        diskInterface.readFile = vi.fn().mockResolvedValue('text')
        const callContext: any = { file: { path: 'name.md' } }

        callContext.user = { env: envVars }
        callContext.file.disk = diskInterface

        const context = await loadContext(callContext as Context)
        expect(loadContent(context)).toMatchSnapshot({
            file: {
                date: expect.any(Date),
                name: 'name',
                path: 'name.md',
                text: 'text',
                disk: expect.any(Object),
            },
            user: {
                env: expect.any(Object),
                data: 'EnvVars',
                label: 'Myself',
                prompt: 'text',
                history: [],
            },
            gladdis: {
                label: 'EnvVars',
                config: undefined,
                model: 'gpt-4',
                temperature: 10,
                top_p_param: 90,
                freq_penalty: 10,
                pres_penalty: -10,
            },
            whisper: {
                input: 'EnvVars',
                config: undefined,
                model: 'whisper-2',
                liveSuffix: 'EnvVars',
                readSuffix: 'EnvVars',
                temperature: 10,
                echoOutput: false,
                deleteFile: true,
                language: 'en',
            },
        })
    })

    it('loads configs values', async () => {
        const inputFile = `---\n${stringify({
            gladdis: { config: 'gladdis' },
            whisper: { config: 'whisper' },
        })}---\n\nprompt\n`

        const gladdisConf = `---\n${stringify(gladdis)}---\n`
        const whisperConf = `---\n${stringify(whisper)}---\n\nWhisper\n`

        diskInterface.readFile = vi
            .fn()
            .mockResolvedValueOnce(inputFile)
            .mockResolvedValueOnce(gladdisConf)
            .mockResolvedValueOnce(whisperConf)

        diskInterface.pathExists = vi.fn().mockResolvedValue(true)
        const callContext: any = { file: { path: 'name.md' } }

        callContext.user = { env: envVars }
        callContext.file.disk = diskInterface

        const context = await loadContext(callContext as Context)
        expect(loadContent(context)).toMatchSnapshot({
            file: expect.any(Object),
            user: {
                env: expect.any(Object),
                data: 'EnvVars',
                label: 'Myself',
                prompt: 'prompt',
                history: [],
            },
            gladdis: {
                label: 'Gladdis',
                config: 'gladdis',
                model: 'gpt-5',
                temperature: 20,
                top_p_param: 80,
                freq_penalty: 20,
                pres_penalty: -20,
            },
            whisper: {
                input: 'Whisper',
                config: 'whisper',
                model: 'whisper-3',
                liveSuffix: 'Whisper',
                readSuffix: 'Gladdis',
                temperature: 30,
                echoOutput: false,
                deleteFile: false,
                language: 'fr',
            },
        })
    })

    it('fails on missing files', async () => {
        const inputFile = `---\n${stringify({
            gladdis: { config: 'gladdis' },
            whisper: { config: 'whisper' },
        })}---\n`

        diskInterface.readFile = vi.fn().mockResolvedValue(inputFile)
        diskInterface.pathExists = vi.fn().mockResolvedValue(false)
        diskInterface.appendFile = vi.fn() as typeof diskInterface.appendFile

        const callContext: any = { file: { path: 'name.md' } }
        callContext.user = { env: envVars }
        callContext.file.disk = diskInterface

        await loadContext(callContext as Context)

        expect(diskInterface.appendFile).toHaveBeenNthCalledWith(
            2,
            'name.md',
            expect.stringContaining('File Not Found'),
        )
    })

    it('loads input file values', async () => {
        const inputFile = `---\n${stringify(inputFM)}---\n`
        const gladdisConf = `---\n${stringify(gladdis)}---\n`
        const whisperConf = `---\n${stringify(whisper)}---\n\nWhisper\n`

        diskInterface.readFile = vi
            .fn()
            .mockResolvedValueOnce(inputFile)
            .mockResolvedValueOnce(gladdisConf)
            .mockResolvedValueOnce(whisperConf)

        diskInterface.pathExists = vi.fn().mockResolvedValue(true)
        const callContext: any = { file: { path: 'name.md' } }

        callContext.user = { env: envVars }
        callContext.file.disk = diskInterface

        const context = await loadContext(callContext as Context)
        expect(loadContent(context)).toMatchSnapshot({
            file: expect.any(Object),
            user: expect.any(Object),
            gladdis: {
                label: 'Gladdis',
                config: 'gladdis',
                model: 'gpt-7',
                temperature: 40,
                top_p_param: 80,
                freq_penalty: 20,
                pres_penalty: -20,
            },
            whisper: {
                input: 'Whisper',
                config: 'whisper',
                model: 'whisper-4',
                liveSuffix: 'Whisper',
                readSuffix: 'Gladdis',
                temperature: 40,
                echoOutput: false,
                deleteFile: false,
                language: 'fr',
            },
        })
    })

    it('loads method call values', async () => {
        const inputFile = `---\n${stringify(inputFM)}---\n`
        const gladdisConf = `---\n${stringify(gladdis)}---\n\nGladdis\n`
        const whisperConf = `---\n${stringify(whisper)}---\n\nWhisper\n`

        diskInterface.readFile = vi
            .fn()
            .mockResolvedValueOnce(inputFile)
            .mockResolvedValueOnce(gladdisConf)
            .mockResolvedValueOnce(whisperConf)

        diskInterface.pathExists = vi.fn().mockResolvedValue(true)
        let callContext: any = { file: { path: 'name.md' } }

        callContext.user = { env: envVars }
        callContext.file.disk = diskInterface

        callContext = deepmerge(callContext, callEnv)

        const context = await loadContext(callContext as Context)
        expect(loadContent(context)).toMatchSnapshot({
            file: expect.any(Object),
            user: {
                env: expect.any(Object),
                data: 'CallEnv',
                label: 'CallEnv',
                prompt: '',
                history: [{ role: 'system', content: 'Gladdis' }],
            },
            gladdis: {
                label: 'Gladdis',
                config: 'gladdis',
                model: 'gpt-8',
                temperature: 50,
                top_p_param: 80,
                freq_penalty: 20,
                pres_penalty: -20,
            },
            whisper: {
                input: 'Whisper',
                config: 'whisper',
                model: 'whisper-4',
                liveSuffix: 'Whisper',
                readSuffix: 'Gladdis',
                temperature: 50,
                echoOutput: false,
                deleteFile: false,
                language: 'es',
            },
        })
    })
})
