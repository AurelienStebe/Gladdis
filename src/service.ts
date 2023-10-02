import 'dotenv/config'
import express from 'express'

import { chatWithGladdis, processContent, processPrompt } from './commands.js'

const app = express()
app.use(express.json())

app.post('/chatWithGladdis', (req, res) => {
    void (async () => {
        void chatWithGladdis(req.body)
    })()

    res.status(200).end()
})

app.post('/processContent', (req, res) => {
    void (async () => {
        void processContent(req.body)
    })()

    res.status(200).end()
})

app.post('/processPrompt', (req, res) => {
    void (async () => {
        void processPrompt(req.body)
    })()

    res.status(200).end()
})

const name = process.env.GLADDIS_NAME_LABEL ?? 'Gladdis'
const port = Number(process.env.GLADDIS_SERVER_PORT) ?? 3000

app.listen(port, () => {
    console.log(`${name} is listening on port ${port} ...`)
})
