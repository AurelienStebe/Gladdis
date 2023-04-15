import path from 'path'
import yaml from 'yaml'
import merge from 'deepmerge'
import { promises as fs } from 'fs'

import { writeHistory } from './history.js'

import type { Context } from '../types/context.js'

export async function logGladdisCall(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await createDataPath(context.file.data, 'history', 'calls', dateDir)
    const logFile = path.resolve(logPath, `${context.file.date.getTime()}.md`)

    const logContext = merge({}, context) as any
    delete logContext.file
    delete logContext.user

    const frontMatter = `---\n${yaml.stringify(logContext)}---\n\n`
    await fs.appendFile(logFile, frontMatter + writeHistory(context))
}

export async function logGladdisChat(context: Context): Promise<void> {
    const dateDir = context.file.date.toISOString().split('T')[0]
    const logPath = await createDataPath(context.file.data, 'history', 'chats', dateDir)
    const logFile = path.resolve(logPath, path.basename(context.file.path))

    const history = context.user.history.slice(-2)
    history[0].content = `[${context.file.date.toISOString().split('T')[1]}] ${history[0].content}`
    history[1].content = `[${new Date().toISOString().split('T')[1]}] ${history[1].content}`
    context.user.history = history

    await fs.appendFile(logFile, writeHistory(context) + '\n')
}

async function createDataPath(...subPaths: string[]): Promise<string> {
    for (const [i] of subPaths.entries()) {
        const dataPath = path.resolve(...subPaths.slice(0, i + 1))

        try {
            await fs.access(dataPath)
        } catch (e) {
            await fs.mkdir(dataPath)
        }
    }

    return path.resolve(...subPaths)
}
