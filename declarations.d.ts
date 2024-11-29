declare module '@opendocsg/pdf2md' {
    export default function (pdfBuffer: ArrayBuffer): Promise<string>
}

declare module 'turndown-plugin-gfm' {
    import type { Plugin } from 'turndown'
    export const gfm: Plugin
}
