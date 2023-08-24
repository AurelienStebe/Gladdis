import 'dotenv/config'

import express from 'express'

import { askGladdis } from './gladdis.js'
import { transcribe } from './utils/whisper.js'
import { loadContext, loadContent } from './utils/loaders.js'

const app = express()

app.use(express.json())

app.post('/askGladdis', (req, res) => {
    void (async () => {
        const context = await loadContext(req.body)
        void askGladdis(loadContent(context))
    })()

    res.status(200).end()
})

app.post('/transcribe', (req, res) => {
    void (async () => {
        let context = await loadContext(req.body)

        context.whisper.echoOutput = true
        context.whisper.deleteFile = false

        context = loadContent(context)
        void transcribe(context.user.prompt, context)
    })()

    res.status(200).end()
})

const name = process.env.GLADDIS_NAME_LABEL ?? 'Gladdis'
const port = Number(process.env.GLADDIS_SERVER_PORT) ?? 3000

app.listen(port, () => {
    console.log(`${name} is listening on port ${port} ...`)
})
