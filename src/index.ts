import 'dotenv/config'

import yaml from 'yaml'
import merge from 'deepmerge'
import express from 'express'
import { promises as fs } from 'fs'

import { askGladdis } from './gladdis.js'
import { transcribe } from './whisper.js'
import type { Context } from './types.js'

const app = express()
app.use(express.json())

app.post('/askGladdis', (req, res) => {
    void (async () => {
        let context = await loadContext(req.body.filePath)

        context = parseHistory(context)
        context = parsePrompt(context)

        void askGladdis(context)
    })()

    res.status(200).end()
})

app.post('/transcribe', (req, res) => {
    void (async () => {
        const context = await loadContext(req.body.filePath)

        context.whisper.echoScript = true
        context.whisper.deleteFile = false

        void transcribe(parsePrompt(context))
    })()

    res.status(200).end()
})

const port = process.env.GLADDIS_SERVER_PORT ?? 3000
const name = process.env.GLADDIS_NAME_LABEL ?? 'Gladdis'

app.listen(port, () => {
    console.log(`${name} is listening on port ${port} ...`)
})

async function loadContext(filePath: string): Promise<Context> {
    const content = (await fs.readFile(filePath, 'utf-8')).trim()
    const fileContext = { file: { path: filePath, text: content } }

    let userContext = {
        user: {
            label: process.env.GLADDIS_DEFAULT_USER ?? 'User',
        },
    }

    if (content.startsWith('---\n')) {
        const [frontMatter, ...fileContent] = content.slice(4).split('---')
        fileContext.file.text = fileContent.join('---').trim()
        userContext = merge(userContext, yaml.parse(frontMatter))
    }

    const coreContext = {
        gladdis: {
            label: process.env.GLADDIS_NAME_LABEL ?? 'Gladdis',
            corePrompt: process.env.GLADDIS_CORE_PROMPT ?? 'You are Gladdis, trained by OpenAI.',
            metaPrompt: process.env.GLADDIS_META_PROMPT ?? 'Metadata Context (in JSON format): ',
            model: process.env.GLADDIS_DEFAULT_MODEL ?? 'gpt-3.5-turbo',
            temperature: Number(process.env.GLADDIS_TEMPERATURE ?? 0),
            top_p_param: Number(process.env.GLADDIS_TOP_P_PARAM ?? 1),
            freq_penalty: Number(process.env.GLADDIS_FREQ_PENALTY ?? 0),
            pres_penalty: Number(process.env.GLADDIS_PRES_PENALTY ?? 0),
        },
        whisper: {
            label: process.env.GLADDIS_WHISPER_LABEL ?? 'Transcript',
            prompt: process.env.GLADDIS_WHISPER_PROMPT ?? 'Transcribe',
            model: process.env.GLADDIS_WHISPER_MODEL ?? 'whisper-1',
            echoScript: Boolean(process.env.GLADDIS_WHISPER_ECHO_SCRIPT ?? false),
            deleteFile: Boolean(process.env.GLADDIS_WHISPER_DELETE_FILE ?? false),
            temperature: Number(process.env.GLADDIS_WHISPER_TEMPERATURE ?? 0),
            language: process.env.GLADDIS_WHISPER_LANGUAGE,
        },
    }

    return merge.all([coreContext, userContext, fileContext]) as Context
}

function parseHistory(context: Context): Context {
    // TODO
    return context
}

function parsePrompt(context: Context): Context {
    let prompt = context.file.text

    const border = (prompt + '\n').lastIndexOf('\n---\n')
    if (border > 0) prompt = prompt.slice(border + 4).trim()

    const userNameMatch = prompt.match(/^\*\*(.+):\*\*/)

    if (userNameMatch !== null) {
        context.user.label = userNameMatch[1]
        prompt = prompt.slice(userNameMatch[0].length)
    }

    context.user.prompt = prompt.trim()

    return context
}
