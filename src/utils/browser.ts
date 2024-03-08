import { Readability } from '@mozilla/readability'

import { processText } from './history.js'
import { parseDOM, request, turndown } from '../commands.js'

import type { Context } from '../types/context.js'

const linkRegex = /(?<!<%.*)<(https:\/\/[^>]+?)>(?!.*%>)/gis

export async function webBrowser(content: string, context: Context): Promise<string> {
    return await processText(content, context, async (content, context) => {
        for (const [fullMatch, pageURL] of content.matchAll(linkRegex)) {
            const disk = context.file.disk
            let webPage: string | undefined

            try {
                const pageDoc = parseDOM(await request(pageURL))

                const baseTag = pageDoc.head.getElementsByTagName('base')[0]
                if (baseTag === undefined) pageDoc.head.appendChild(pageDoc.createElement('base'))

                pageDoc.head.getElementsByTagName('base')[0].href = pageURL
                const article = new Readability(pageDoc).parse()

                webPage = turndown(article?.content ?? 'No Content Found.')
                if (article?.title !== undefined) webPage = `# ${article.title}\n\n${webPage}`
            } catch (error: any) {
                const errorName: string = error?.message ?? 'Web Page Browsing Error'
                const errorJSON: string = '```json\n> ' + JSON.stringify(error) + '\n> ```'

                const errorFull = `\n\n> [!BUG]+ **${errorName}**\n> ${errorJSON}`
                await disk.appendFile(context.file.path, errorFull)
            }

            if (webPage === undefined) continue

            if (webPage === 'No Content Found.') {
                const webPageError = `\n\n> [!ERROR]- No Content from "${pageURL}"\n> `
                await disk.appendFile(context.file.path, webPageError + webPage)

                continue
            }

            const webPageEsc = webPage.replace(/<(\/?[!a-z])/gi, '<\uFEFF$1')
            const webPageLabel = `\n\n> [!EXAMPLE]- Content from "${pageURL}"`
            const webPageQuote = '\n> ' + webPageEsc.split('\n').join('\n> ')

            await disk.appendFile(context.file.path, webPageLabel + webPageQuote)
            content = content.replace(fullMatch, `@${pageURL}\n"""\n${webPage}\n"""\n\n`)
        }

        return content
    })
}
