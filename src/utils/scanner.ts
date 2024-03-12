import { processText } from './history.js'
import { writeMissedModal } from './loggers.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)!\[\[([^|\]]+?)(\|[^\]]*?)?\]\](?!.*%>)/gs

const audioFiles = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm']
const imageFiles = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'webp']
const videoFiles = ['avi', 'mpg', 'mov', 'mkv', 'm4v', 'wmv', '3gp']
const otherFiles = ['bin', 'exe', 'iso', 'doc', 'xls', 'ppt']

export async function parseLinks(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, filePath, fileName] of content.matchAll(linkRegex)) {
            const disk = context.file.disk

            const fileExt = disk.extName(filePath).toLowerCase().slice(1)
            const fullPath = await resolveFile(filePath, context)
            if (fullPath === undefined) continue

            let message: string | undefined
            if (audioFiles.includes(fileExt)) continue
            if (fileExt === 'pdf') message = 'PDFs Not Supported (soon)'

            if (imageFiles.includes(fileExt)) message = 'Images Not Supported (yet)'
            if (videoFiles.includes(fileExt)) message = 'Video Files Not Supported'
            if (otherFiles.includes(fileExt)) message = 'Binary Files Not Supported'

            if (message !== undefined) {
                await writeMissedModal(filePath, message, context)
                continue
            }

            const header = fileName?.slice(1) ?? disk.baseName(filePath)
            let fileText = (await disk.readFile(fullPath)).trim()

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
    const disk = context.file.disk

    if (await disk.pathExists(filePath)) return filePath

    let fullPath = disk.joinPath(disk.dirName(context.file.path), filePath)
    if (await disk.pathExists(fullPath)) return fullPath

    if (context.user.env.OBSIDIAN_VAULT !== undefined) {
        fullPath = disk.joinPath(context.user.env.OBSIDIAN_VAULT, filePath)
        if (await disk.pathExists(fullPath)) return fullPath
    }

    if (context.gladdis.config !== undefined && context.gladdis.config !== '') {
        const configPath = disk.joinPath(context.user.data, 'configs', context.gladdis.config)

        fullPath = disk.joinPath(disk.dirName(configPath), filePath)
        if (await disk.pathExists(fullPath)) return fullPath
    }

    if (disk.extName(filePath).toLowerCase() === '.txt') filePath = filePath.slice(0, -4)
    if (disk.extName(filePath) === '') return await resolveFile(filePath + '.md', context)

    await writeMissedModal(filePath, 'Linked File Not Found', context)

    return undefined
}
