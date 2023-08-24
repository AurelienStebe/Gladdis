import path from 'path'
import fs from 'fs-extra'

import { processText } from './history.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)!\[\[(.+?)(\|.*?)?\]\](?!.*%>)/gs

const audioFiles = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm']
const imageFiles = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'webp']
const videoFiles = ['avi', 'mpg', 'mov', 'mkv', 'm4v', 'wmv', '3gp']
const otherFiles = ['bin', 'exe', 'iso', 'doc', 'xls', 'ppt']

export async function parseLinks(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, filePath, fileName] of content.matchAll(linkRegex)) {
            const fileExt = path.extname(filePath).toLowerCase().slice(1)
            const fullPath = await resolveFile(filePath, context)
            if (fullPath === undefined) continue

            let message
            if (audioFiles.includes(fileExt)) continue
            if (fileExt === 'pdf') message = 'PDFs Not Supported (soon)'

            if (imageFiles.includes(fileExt)) message = 'Images Not Supported (yet)'
            if (videoFiles.includes(fileExt)) message = 'Video Files Not Supported'
            if (otherFiles.includes(fileExt)) message = 'Binary Files Not Supported'

            if (message !== undefined) {
                message = `\n\n> [!MISSING]+ **${message}**\n> ${filePath}`
                await fs.appendFile(context.file.path, message)

                continue
            }

            const header = fileName?.slice(1) ?? path.basename(filePath)
            let fileText = (await fs.readFile(fullPath, 'utf-8')).trim()

            if (fileExt === 'txt') {
                fileText = await parseLinks(fileText, context)
            } else if (fileExt === '') {
                fileText = `${header}:\n\n"""\n${fileText}\n"""`
            } else {
                fileText = `${header}:\n\n\`\`\`${fileExt}\n${fileText}\n\`\`\``
            }

            content = content.replace(fullMatch, `${fileText}\n\n`)
        }

        return content
    })
}

export async function resolveFile(filePath: string, context: Context): Promise<string | undefined> {
    if (await fs.pathExists(filePath)) return filePath

    let fullPath = path.join(path.dirname(context.file.path), filePath)
    if (await fs.pathExists(fullPath)) return fullPath

    if (process.env.OBSIDIAN_VAULT !== undefined) {
        fullPath = path.join(process.env.OBSIDIAN_VAULT, filePath)
        if (await fs.pathExists(fullPath)) return fullPath
    }

    if (context.gladdis.config !== undefined) {
        const configPath = path.join(context.user.data, 'configs', context.gladdis.config)

        fullPath = path.join(path.dirname(configPath), filePath)
        if (await fs.pathExists(fullPath)) return fullPath
    }

    if (path.extname(filePath).toLowerCase() === '.txt') filePath = filePath.slice(0, -4)
    if (path.extname(filePath) === '') return await resolveFile(filePath + '.md', context)

    const missing = '\n\n> [!MISSING]+ **Linked File Not Found**\n> '
    await fs.appendFile(context.file.path, missing + filePath)

    return undefined
}
