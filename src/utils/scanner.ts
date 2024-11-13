import { arrayBuffer } from 'stream/consumers'

import { getPdfDoc } from '../commands.js'
import { processText } from './history.js'
import { writeErrorModal, writeMissedModal, writeInvalidModal } from './loggers.js'

import type { Context, ChatMessage } from '../types/context.js'

const linkRegex = /(?<!<%.*)!\[\[([^|\]]+?)(\|[^\]]*?)?\]\](?!.*%>)/gs
const imageRegex = /!\[([^\]]*?)\]\(((https:\/|data:image)?\/[^)]+?)\)/gs

const audioFiles = ['flac', 'mp3', 'mp4', 'm4a', 'wav', 'mpeg', 'mpga', 'ogg', 'webm']
const imageFiles = ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'ico', 'avif', 'webp']
const videoFiles = ['avi', 'mpg', 'mov', 'mkv', 'm4v', 'wmv', 'ogv']
const otherFiles = ['bin', 'exe', 'iso', 'doc', 'ppt', 'xls']

export async function parseLinks(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, filePath, fileName] of content.matchAll(linkRegex)) {
            const disk = context.file.disk
            let message: string | undefined

            let fileExt = disk.extName(filePath).toLowerCase().slice(1)
            const fullPath = await resolveFile(filePath, context)

            if (fullPath === undefined) continue
            if (audioFiles.includes(fileExt)) continue

            if (videoFiles.includes(fileExt)) message = 'Video Files Not Supported'
            if (otherFiles.includes(fileExt)) message = 'Binary Files Not Supported'

            if (message !== undefined) {
                await writeMissedModal(filePath, message, context)
                continue
            }

            if (fileExt === 'pdf') {
                try {
                    message = await parsePdfDoc(filePath, fullPath, context)
                } catch (error: unknown) {
                    await writeErrorModal(error, 'PDF Transcription Error', context)
                }

                if (message === undefined || message === '') continue
            }

            let header = fileName?.slice(1) ?? `"${disk.baseName(fullPath)}"`
            let fileText = message ?? (await disk.readFile(fullPath)).trim()

            if (fileExt === 'pdf') header = `"${filePath}"`

            if (disk.baseName(filePath) === disk.baseName(fullPath, '.md')) {
                if (disk.extName(fullPath).toLowerCase() === '.md') fileExt = 'md'
            }

            if (fileExt === 'txt') {
                fileText = await parseLinks(fileText, context)
            } else if (fileExt === 'pdf' || fileExt === 'md') {
                fileText = `${header}:\n"""\n${fileText}\n"""\n`
            } else if (imageFiles.includes(fileExt)) {
                fileText = `![data:image/${fileExt};base64,](/${fullPath})`
            } else {
                fileText = `${header}:\n\`\`\`${fileExt}\n${fileText}\n\`\`\`\n`
            }

            content = content.replace(fullMatch, fileText)
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
    if (!filePath.toLowerCase().endsWith('.md')) return await resolveFile(filePath + '.md', context)

    await writeMissedModal(filePath, 'Linked File Not Found', context)

    return undefined
}

export async function parsePdfDoc(filePath: string, fullPath: string, context: Context): Promise<string> {
    const pdf = await getPdfDoc(context.file.disk.readBinary(fullPath))

    const pdfPages = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, i) => {
            return await (await pdf.getPage(i + 1)).getTextContent()
        }),
    )

    const pdfItems = pdfPages.map((page) =>
        page.items.map((item: any): string => {
            return item.str + (item.hasEOL === true ? '\n' : '')
        }),
    )

    pdfItems.map((page) => page.push('\n\n'))
    const content = pdfItems.flat().join('').trim()

    if (content !== '') {
        const pdfTextEsc = content.replace(/<(\/?[!a-z])/gi, '<\uFEFF$1')
        const pdfTextLabel = `\n\n> [!ABSTRACT]- Content from "${filePath}"`
        const pdfTextQuote = '\n> ' + pdfTextEsc.split('\n').join('\n>\n> ')

        await context.file.disk.appendFile(context.file.path, pdfTextLabel + pdfTextQuote)
    } else {
        await writeInvalidModal([], `No Content from "${filePath}"`, context)
    }

    return content
}

export async function loadImages(context: Context): Promise<ChatMessage[]> {
    return await Promise.all(
        context.user.history.map(async (message) => {
            const content = []

            let currentMatch
            let lastIndex = 0

            while ((currentMatch = imageRegex.exec(message.content)) !== null) {
                const [fullMatch, imageTag, imageUrl] = currentMatch

                if (lastIndex < currentMatch.index) {
                    content.push({
                        type: 'text',
                        text: message.content.slice(lastIndex, currentMatch.index).trim(),
                    })
                }

                content.push({
                    type: 'image_url',
                    image_url: { url: imageUrl },
                })

                if (imageTag.startsWith('data:image/')) {
                    const stream = context.file.disk.readBinary(imageUrl)
                    const buffer = stream instanceof Promise ? (await stream).arrayBuffer() : arrayBuffer(stream)

                    content.at(-1)!.image_url!.url = imageTag + Buffer.from(await buffer).toString('base64')
                }

                lastIndex = currentMatch.index + fullMatch.length
            }

            if (lastIndex < message.content.length) {
                content.push({
                    type: 'text',
                    text: message.content.slice(lastIndex).trim(),
                })
            }

            return { ...message, content }
        }) as unknown as ChatMessage[],
    )
}
