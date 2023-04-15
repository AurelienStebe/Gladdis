import path from 'path'
import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'
import { writeHistory } from '../tools/history.js'

import type { Context } from '../types/context.js'

export async function logGladdisCall(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await getDataPath(context, 'calls', dateDir)

    const logFile = path.resolve(logPath, `${context.file.date.getTime()}.md`)

    const logContext = merge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${yaml.stringify(logContext)}---\n\n`
    await fs.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await getDataPath(context, 'chats', dateDir)

    const logFile = path.resolve(logPath, path.basename(context.file.path))

    const history = context.user.history.slice(-2)
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`
    context.user.history = history

    await fs.appendFile(logFile, writeHistory(context) + '\n')
}

async function getDataPath(context: Context, ...subPaths: string[]): Promise<string> {
    try {
        await fs.access(context.file.data)
    } catch (e) {
        await fs.mkdir(context.file.data)
    }

    for (const [i] of subPaths.entries()) {
        const dataPath = path.resolve(context.file.data, ...subPaths.slice(0, i + 1))

        try {
            await fs.access(dataPath)
        } catch (e) {
            await fs.mkdir(dataPath)
        }
    }

    return path.resolve(context.file.data, ...subPaths)
}
