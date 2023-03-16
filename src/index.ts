import 'dotenv/config'
import express from 'express'
import { askGladdis } from './gladdis.js'
import { transcribe } from './whisper.js'
import { loadContext, parsePrompt, parseHistory } from './utils.js'

const app = express()
app.use(express.json())

app.post('/askGladdis', (req, res) => {
    void (async () => {
        let context = await loadContext(req.body)

        context = parsePrompt(context)
        context = parseHistory(context)

        void askGladdis(context)
    })()

    res.status(200).end()
})

app.post('/transcribe', (req, res) => {
    void (async () => {
        const context = await loadContext(req.body)

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
