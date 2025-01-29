import { stringify } from 'yaml'

import { describe, it, expect, afterEach, vi } from 'vitest'

import { diskInterface } from '../src/commands.js'
import { loadContext, loadContent } from '../src/utils/loaders.js'

import type { Context } from '../src/types/context.js'

const complexFile = `
> Quoted Message 1
My User Message 1
___
__User:__ User Message 2
___
__Myself:__ User Message 3
___
__MyFriend:__ User Message 4
___
>__User:__ Quoted Message 2

__System:__ System Message 1
___
__Gladdis:__ Gladdis Message 1
___
__Assistant:__ Gladdis Message 2
___
> """Quoted Message 3"""
"""Text block 1
___
> is escaped"""
___
"""
Text block 2 with
multiline content
and a code block:
\`\`\`bash
echo "Code block with Bash code"
\`\`\`
"""
___
>Quoted Message 4
> with multilines
\`\`\`
alert("Code block with JS code")
\`\`\`
___
\`\`\`python
def test():
    """Test function."""
    print("Hello World!")
\`\`\`
___
__Myself:__![[recording.webm]]

> [!QUOTE]- Transcript from "recording.webm"
> Here is the transcription of the recording.
___
__System:__ [[document.pdf]]

> [!ABSTRACT]- Content from "document.pdf"
> Here is the text content of the PDF file.
___
__Myself:__ <http://mysite.com>

> [!EXAMPLE]- Web Page from <http://mysite.com>
> Here is the main content of the Web Page.
___
__User:__Prompt Text`

describe('the history Content', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('parses simple messages', async () => {
        const simpleFile = 'Message 1\n___\nMessage 2\n___\nMessage 3'
        diskInterface.readFile = vi.fn().mockResolvedValue(simpleFile)

        const callContext: any = {
            file: { path: 'path', disk: diskInterface },
            user: { env: { NODE_ENV: 'test' } },
        }

        const context = loadContent(await loadContext(callContext as Context))

        expect(context.user.prompt).toBe('Message 3')
        expect(context.user.history).toStrictEqual([
            {
                role: 'user',
                content: 'Message 1',
            },
            {
                role: 'user',
                content: 'Message 2',
            },
        ])
    })

    it('parses complex messages', async () => {
        diskInterface.readFile = vi.fn().mockResolvedValue(complexFile)

        const callContext: any = {
            file: { path: 'path', disk: diskInterface },
            user: { env: { GLADDIS_DEFAULT_USER: 'Myself' } },
        }

        const context = loadContent(await loadContext(callContext as Context))

        expect(context.user.prompt).toBe('Prompt Text')
        expect(context.user.history).toMatchSnapshot()
    })

    it('defaults to System in config', async () => {
        const inputFile = `---\n${stringify({
            gladdis: { config: 'gladdis' },
            whisper: { config: 'whisper' },
        })}---\n`

        const gladdisConf = 'System Prompt 1\n___\nSystem Prompt 2'
        const whisperConf = 'Whisper input is not parsed\n___\n> !'

        diskInterface.pathExists = vi.fn().mockResolvedValue(true)

        diskInterface.readFile = vi
            .fn()
            .mockResolvedValueOnce(inputFile)
            .mockResolvedValueOnce(gladdisConf)
            .mockResolvedValueOnce(whisperConf)

        const callContext: any = {
            file: { path: 'path', disk: diskInterface },
            user: { env: { GLADDIS_DEFAULT_USER: 'Myself' } },
        }

        const context = loadContent(await loadContext(callContext as Context))

        expect(context.whisper.input).toBe(whisperConf)
        expect(context.user.history).toStrictEqual([
            {
                role: 'system',
                content: 'System Prompt 1',
            },
            {
                role: 'system',
                content: 'System Prompt 2',
            },
        ])
    })
})
