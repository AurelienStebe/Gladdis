import fs from 'fs-extra'

import { describe, it, expect, afterEach } from 'vitest'
import { getLocalEnv, cleanupTest, getTestPath } from './tests-utils.js'

import { diskInterface } from '../src/commands.js'
import { loadContext } from '../src/utils/loaders.js'

describe('loadContext() function', () => {
    afterEach(async () => await cleanupTest('__DATA__', 'input.md'))

    it('loads the default values', async () => {
        const filePath = getTestPath('input.md')
        await fs.ensureFile(filePath)

        const callContext = { file: { path: filePath } } as any
        callContext.user = { env: getLocalEnv('__DATA__') }
        callContext.file.disk = diskInterface
        const context = await loadContext(callContext)

        expect(context.file.path).toBe(filePath)
        expect(context.user.data).toBe(getTestPath('__DATA__'))

        expect(context).toMatchSnapshot({
            file: {
                date: expect.any(Date),
                name: 'input',
                path: expect.any(String),
                text: '',
                disk: expect.any(Object),
            },
            user: {
                env: expect.any(Object),
                data: expect.any(String),
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
})
