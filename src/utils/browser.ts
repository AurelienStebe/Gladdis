import { Readability } from '@mozilla/readability'

import { processText } from './history.js'
import { parseDom, getHtml, turndown } from '../commands.js'
import { writeErrorModal, writeInvalidModal } from './loggers.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)<(https?:\/\/[^>]+?)>(?!.*%>)/gis

export async function webBrowser(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, pageURL] of content.matchAll(linkRegex)) {
            const disk = context.file.disk
            let webPage: string | undefined

            try {
                const pageDoc = parseDom(await getHtml(pageURL))

                const baseTag = pageDoc.head.getElementsByTagName('base')[0]
                if (baseTag === undefined) pageDoc.head.appendChild(pageDoc.createElement('base'))

                pageDoc.head.getElementsByTagName('base')[0].href = pageURL
                const article = new Readability(pageDoc).parse() ?? { title: '', content: '' }

                webPage = article.content.trim() !== '' ? turndown(article.content) : ''
                if (article.title.trim() !== '') webPage = `# ${article.title}\n\n${webPage}`
            } catch (error: unknown) {
                await writeErrorModal(error, 'Web Page Browsing Error', context)
            }

            if (webPage === undefined) continue

            if (webPage.trim() === '') {
                await writeInvalidModal([], `No Content from "${pageURL}"`, context)
                continue
            }

            const webPageEsc = webPage.replace(/<(\/?[!a-z])/gi, '<\uFEFF$1')
            const webPageLabel = `\n\n> [!EXAMPLE]- Web Page from <${pageURL}>`
            const webPageQuote = '\n> ' + webPageEsc.split('\n').join('\n> ')

            await disk.appendFile(context.file.path, webPageLabel + webPageQuote)
            content = content.replace(fullMatch, `@"${pageURL}"\n"""\n${webPage}\n"""\n`)
        }

        return content
    })
}
