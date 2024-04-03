import { deepmerge } from 'deepmerge-ts'
import { BrowserWindow } from '@electron/remote'

import { doGladdis } from './gladdis.js'
import { transcribe } from './utils/whisper.js'
import { parseLinks } from './utils/scanner.js'
import { webBrowser } from './utils/browser.js'
import { loadContext, loadContent } from './utils/loaders.js'
import { getTokenModal, writeErrorModal } from './utils/loggers.js'

import {
    TFile,
    Plugin,
    Setting,
    Platform,
    PluginSettingTab,
    addIcon,
    request,
    loadPdfJs,
    normalizePath,
} from 'obsidian'

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Context, DiskInterface } from './types/context.js'
import type { App, Editor, MarkdownView, MarkdownFileInfo, Vault } from 'obsidian'

export { stringifyYaml, parseYaml, htmlToMarkdown as turndown } from 'obsidian'

export const parseDom = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

export async function getPdfDoc(file: Promise<File>): Promise<PDFDocumentProxy> {
    return (await loadPdfJs()).getDocument(await (await file).arrayBuffer()).promise
}

export async function getHtml(url: string): Promise<string> {
    let html = ''

    if (Platform.isMobile) return await request(url)
    const page = new BrowserWindow({ show: false })

    try {
        await page.loadURL(url)

        let equalLoop = 1
        let prevSize = -1
        let iteration = 0

        while (equalLoop < 3 && iteration < 33) {
            await new Promise((resolve) => setTimeout(resolve, 33)) // Max 33 ms * 34 loops = 1.1 s
            const size = await page.webContents.executeJavaScript('document.body.innerText.length;')

            if (size === prevSize) equalLoop++
            else equalLoop = 1

            prevSize = size
            iteration++
        }

        html = await page.webContents.executeJavaScript('document.documentElement.outerHTML;')
    } finally {
        page.destroy()
    }

    return html
}

interface GladdisSettings {
    GLADDIS_DATA_PATH: string
    GLADDIS_CONFIG_FILE?: string
    GLADDIS_NAME_LABEL: string
    GLADDIS_DEFAULT_USER: string
    GLADDIS_DEFAULT_MODEL: string
    GLADDIS_TEMPERATURE: string
    GLADDIS_TOP_P_PARAM: string
    GLADDIS_WHISPER_CONFIG?: string
    GLADDIS_WHISPER_INPUT: string
    GLADDIS_WHISPER_MODEL: string
    GLADDIS_WHISPER_TEMPERATURE: string
    GLADDIS_WHISPER_ECHO_OUTPUT: string
    GLADDIS_WHISPER_DELETE_FILE: string
}

const DEFAULT_SETTINGS: GladdisSettings = {
    GLADDIS_DATA_PATH: 'Gladdis',
    GLADDIS_NAME_LABEL: 'Gladdis',
    GLADDIS_DEFAULT_USER: 'User',
    GLADDIS_DEFAULT_MODEL: 'gpt-3.5-turbo',
    GLADDIS_TEMPERATURE: '42',
    GLADDIS_TOP_P_PARAM: '100',
    GLADDIS_WHISPER_INPUT: 'Hi Gladdis, please transcribe this file.',
    GLADDIS_WHISPER_MODEL: 'whisper-1',
    GLADDIS_WHISPER_TEMPERATURE: '24',
    GLADDIS_WHISPER_ECHO_OUTPUT: 'true',
    GLADDIS_WHISPER_DELETE_FILE: 'false',
}

export default class GladdisPlugin extends Plugin {
    settings: GladdisSettings = DEFAULT_SETTINGS
    secrets: Record<string, string> = {}

    async onload(): Promise<void> {
        await this.loadSettings()
        await this.loadSecrets()

        addIcon('gladdisLogo', `<path ${logoPathAttr} d="${logoMainPath}"/>`)
        addIcon('gladdisHalf', `<path ${logoPathAttr} d="${logoMainPath}${logoLeftPath}"/>`)
        addIcon('gladdisFull', `<path ${logoPathAttr} d="${logoMainPath}${logoLeftPath}${logoFullPath}"/>`)

        this.addCommand({
            icon: 'gladdisLogo',
            id: 'chat-with-gladdis',
            name: 'Chat with Gladdis',

            editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                await this.processWithContext(editor, view, async (context: Context) => {
                    await doGladdis(loadContent(await loadContext(context)))
                })
            },
        })

        this.addCommand({
            icon: 'gladdisFull',
            id: 'process-the-content',
            name: 'Process the full content',

            editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                await this.processWithContext(editor, view, async (context: Context) => {
                    context = loadContent(await loadContext(context))

                    context.whisper.echoOutput = true
                    context.whisper.deleteFile = false

                    await Promise.all(
                        context.user.history.map(async (message) => {
                            message.content = await parseLinks(message.content, context)
                        }),
                    )

                    context.user.prompt = await transcribe(context.user.prompt, context)
                    context.user.prompt = await parseLinks(context.user.prompt, context)
                    context.user.prompt = await webBrowser(context.user.prompt, context)

                    context.user.history.push({
                        role: 'user',
                        content: context.user.prompt,
                        name: context.user.label,
                    })

                    await context.file.disk.appendFile(context.file.path, getTokenModal(context))
                })
            },
        })

        this.addCommand({
            icon: 'gladdisHalf',
            id: 'process-the-prompt',
            name: 'Process just the prompt (or selection)',

            editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                await this.processWithContext(editor, view, async (context: Context) => {
                    context = await loadContext(context)
                    if (editor.somethingSelected()) context.file.text = editor.getSelection()
                    else context.file.text = context.file.text.split('\n---').at(-1) ?? ''
                    context = loadContent(context)

                    context.whisper.echoOutput = true
                    context.whisper.deleteFile = false

                    context.user.prompt = await transcribe(context.user.prompt, context)
                    context.user.prompt = await parseLinks(context.user.prompt, context)
                    context.user.prompt = await webBrowser(context.user.prompt, context)

                    context.user.history = [
                        {
                            role: 'user',
                            content: context.user.prompt,
                            name: context.user.label,
                        },
                    ]

                    await context.file.disk.appendFile(context.file.path, getTokenModal(context))
                })
            },
        })

        this.registerExtensions(['txt'], 'markdown')

        this.addSettingTab(new GladdisSettingTab(this.app, this))
    }

    async processWithContext(
        editor: Editor,
        view: MarkdownView | MarkdownFileInfo,
        processing: (context: Context) => Promise<void>,
    ): Promise<void> {
        const context: any = { user: {}, file: {} }
        context.file.path = view.file?.path ?? ''

        context.user.env = deepmerge(this.secrets, this.settings)
        context.file.disk = new VaultInterface(editor, view)

        try {
            await processing(context as Context)
        } catch (error: unknown) {
            await writeErrorModal(error, 'Gladdis Command Run Error', context as Context)
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = deepmerge(DEFAULT_SETTINGS, (await this.loadData()) ?? {})
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings)
    }

    async loadSecrets(): Promise<void> {
        const path = normalizePath(this.manifest.dir + '/.env')
        if (!(await this.app.vault.adapter.exists(path))) return

        this.secrets = this.parseDotEnv(await this.app.vault.adapter.read(path))
    }

    async saveSecrets(): Promise<void> {
        const path = normalizePath(this.manifest.dir + '/.env')
        const text = Object.keys(this.secrets).map((key) => `${key}="${this.secrets[key]}"`)

        await this.app.vault.adapter.write(path, text.join('\n') + '\n')
    }

    parseDotEnv(text: string): Record<string, string> {
        const result: Record<string, string> = {}

        for (const rawLine of text.trim().split('\n')) {
            const line = rawLine.trim()

            const index = line.indexOf('=')
            if (index === -1 || line[0] === '#') continue

            const key = line.slice(0, index).trim()
            let value = line.slice(index + 1).trim()

            if (value[0] === '"') value = value.slice(1, -1)
            if (key !== '' && value !== '') result[key] = value
        }

        return result
    }
}

class VaultInterface implements DiskInterface {
    file: TFile
    vault: Vault
    editor: Editor

    constructor(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        this.editor = editor

        this.vault = view.file?.vault ?? view.app.vault
        this.file = this.loadFile(view.file?.path ?? '')

        this.editor.scrollTo(0, Number.MAX_SAFE_INTEGER)
    }

    loadFile(path: string): TFile {
        const file = this.vault.getAbstractFileByPath(normalizePath(path))

        if (file instanceof TFile) return file
        else throw new Error(`File Not Found: ${path}`)
    }

    async readFile(path: string): Promise<string> {
        if (this.file.path === path) return this.editor.getValue()
        return await this.vault.cachedRead(this.loadFile(path))
    }

    async readBinary(path: string): Promise<File> {
        const binary = this.loadFile(path)
        const buffer = await this.vault.readBinary(binary)

        return new File([buffer], `${binary.basename}.${binary.extension}`)
    }

    async appendFile(path: string, data: string): Promise<void> {
        if (this.file.path === path) {
            await this.vault.append(this.file, data)
        } else if (await this.pathExists(path)) {
            await this.vault.append(this.loadFile(path), data)
        } else {
            await this.vault.create(normalizePath(path), data)
        }
    }

    async deleteFile(path: string): Promise<void> {
        if (await this.pathExists(path)) {
            await this.vault.trash(this.loadFile(path), true)
        }
    }

    async pathExists(path: string): Promise<boolean> {
        return this.vault.getAbstractFileByPath(normalizePath(path)) !== null
    }

    async pathEnsure(path: string): Promise<void> {
        if (await this.pathExists(path)) return

        await this.pathEnsure(this.dirName(path))
        await this.vault.createFolder(normalizePath(path))
    }

    baseName(path: string, ext?: string | undefined): string {
        const fileName = normalizePath(path).split('/').at(-1) ?? ''

        const fileExt = this.extName(path).toLowerCase()
        return fileExt === ext ? fileName.slice(0, -ext.length) : fileName
    }

    extName(path: string): string {
        const fileName = normalizePath(path).split('/').at(-1) ?? ''

        if (!fileName.contains('.')) return ''
        return '.' + fileName.split('.').at(-1)
    }

    joinPath(...paths: string[]): string {
        const path = normalizePath(paths.at(1) ?? '')

        if (path.startsWith('../')) {
            paths[0] = this.dirName(paths[0])
            paths[1] = path.slice(3)

            return this.joinPath(...paths)
        }

        if (paths.length < 3) return normalizePath(paths.join('/'))
        return this.joinPath(paths.slice(0, 2).join('/'), ...paths.slice(2))
    }

    dirName(path: string): string {
        return normalizePath(path).split('/').slice(0, -1).join('/')
    }
}

class GladdisSettingTab extends PluginSettingTab {
    plugin: GladdisPlugin

    constructor(app: App, plugin: GladdisPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        this.containerEl.empty()

        new Setting(this.containerEl)
            .setName('Gladdis data root path')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Gladdis will search for config files in the "')
                    fragment.createEl('code', { text: 'configs' })
                    fragment.appendText('" subfolder,')
                    fragment.createEl('br')
                    fragment.appendText('and will write the chat and call logs in the "')
                    fragment.createEl('code', { text: 'history' })
                    fragment.appendText('" subfolder.')
                }),
            )
            .addText((text) =>
                text.setValue(this.plugin.settings.GLADDIS_DATA_PATH).onChange(async (value) => {
                    this.plugin.settings.GLADDIS_DATA_PATH = value
                    await this.plugin.saveSettings()
                }),
            )

        new Setting(this.containerEl)
            .setName('OpenAI secret API key')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('The secrets are stored in "')
                    fragment.createEl('code', { text: `<vault>/${this.plugin.manifest.dir}/.env` })
                    fragment.appendText('",')
                    fragment.createEl('br')
                    fragment.appendText('add the above path to your "')
                    fragment.createEl('code', { text: '.gitignore' })
                    fragment.appendText('" file if you sync your vault online.')
                }),
            )
            .addText((text) => {
                text.inputEl.type = 'password'
                text.setPlaceholder('sk-***************')
                    .setValue(this.plugin.secrets.OPENAI_API_KEY ?? '')
                    .onChange(async (value) => {
                        this.plugin.secrets.OPENAI_API_KEY = value
                        await this.plugin.saveSecrets()
                    })
            })

        this.containerEl.createEl('h3', { text: 'Gladdis' })

        new Setting(this.containerEl)
            .setName('Default config file')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('The path to the default config file ("')
                    fragment.createEl('code', { text: '.md' })
                    fragment.appendText('" extension optional).')
                }),
            )
            .addText((text) =>
                text
                    .setPlaceholder('Gladdis.md')
                    .setValue(this.plugin.settings.GLADDIS_CONFIG_FILE ?? '')
                    .onChange(async (value) => {
                        if (value === '') delete this.plugin.settings.GLADDIS_CONFIG_FILE
                        else this.plugin.settings.GLADDIS_CONFIG_FILE = value
                        await this.plugin.saveSettings()
                    }),
            )

        new Setting(this.containerEl)
            .setName('Default LLM model')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Only OpenAI models at the moment ("')
                    fragment.createEl('code', { text: 'GPT-3.5' })
                    fragment.appendText('" or "')
                    fragment.createEl('code', { text: 'GPT-4' })
                    fragment.appendText('").')
                }),
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOptions({
                        'gpt-4-turbo-preview': 'GPT-4 Preview (128k)',
                        'gpt-4-32k': 'GPT-4 (32k)',
                        'gpt-4': 'GPT-4 (8k)',
                        'gpt-3.5-turbo': 'GPT-3.5 Updated (16k)',
                        'gpt-3.5-turbo-16k': 'GPT-3.5 (16k)',
                        'gpt-3.5-turbo-0613': 'GPT-3.5 (4k)',
                    })
                    .setValue(this.plugin.settings.GLADDIS_DEFAULT_MODEL)
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_DEFAULT_MODEL = value
                        await this.plugin.saveSettings()
                    }),
            )

        new Setting(this.containerEl)
            .setName('Default AI label')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('The default AI name (displayed as "')
                    fragment.createEl('code', { text: `__${this.plugin.settings.GLADDIS_NAME_LABEL}:__` })
                    fragment.appendText('").')
                }),
            )
            .addText((text) =>
                text.setValue(this.plugin.settings.GLADDIS_NAME_LABEL).onChange(async (value) => {
                    this.plugin.settings.GLADDIS_NAME_LABEL = value
                    await this.plugin.saveSettings()
                }),
            )

        new Setting(this.containerEl)
            .setName('Default user label')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('The default user name (displayed as "')
                    fragment.createEl('code', { text: `__${this.plugin.settings.GLADDIS_DEFAULT_USER}:__` })
                    fragment.appendText('").')
                }),
            )
            .addText((text) =>
                text.setValue(this.plugin.settings.GLADDIS_DEFAULT_USER).onChange(async (value) => {
                    this.plugin.settings.GLADDIS_DEFAULT_USER = value
                    await this.plugin.saveSettings()
                }),
            )

        new Setting(this.containerEl)
            .setName('Default temperature')
            .setDesc('Value in Celsius, from 0 (freezing), 100 (boiling), to 200 (steaming).')
            .addSlider((slider) => {
                slider.sliderEl.style.width = '100%'
                slider
                    .setDynamicTooltip()
                    .setLimits(0, 200, 1)
                    .setValue(Number(this.plugin.settings.GLADDIS_TEMPERATURE))
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_TEMPERATURE = value.toString()
                        await this.plugin.saveSettings()
                    })
            })

        new Setting(this.containerEl)
            .setName('Default top P param')
            .setDesc('Value in literal percentage of probability mass, from 0 % to 100 %.')
            .addSlider((slider) => {
                slider.sliderEl.style.width = '100%'
                slider
                    .setDynamicTooltip()
                    .setLimits(0, 100, 1)
                    .setValue(Number(this.plugin.settings.GLADDIS_TOP_P_PARAM))
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_TOP_P_PARAM = value.toString()
                        await this.plugin.saveSettings()
                    })
            })

        this.containerEl.createEl('h3', { text: 'Whisper' })

        new Setting(this.containerEl)
            .setName('Default config file')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('The path to the default config file ("')
                    fragment.createEl('code', { text: '.md' })
                    fragment.appendText('" extension optional).')
                }),
            )
            .addText((text) =>
                text
                    .setPlaceholder('Whisper.md')
                    .setValue(this.plugin.settings.GLADDIS_WHISPER_CONFIG ?? '')
                    .onChange(async (value) => {
                        if (value === '') delete this.plugin.settings.GLADDIS_WHISPER_CONFIG
                        else this.plugin.settings.GLADDIS_WHISPER_CONFIG = value
                        await this.plugin.saveSettings()
                    }),
            )

        new Setting(this.containerEl)
            .setName('Default audio prompt')
            .setDesc('The default audio prompt, use it to spell out specific nouns or words.')
            .addTextArea((textArea) => {
                textArea.inputEl.style.width = '100%'
                textArea.setValue(this.plugin.settings.GLADDIS_WHISPER_INPUT).onChange(async (value) => {
                    this.plugin.settings.GLADDIS_WHISPER_INPUT = value
                    await this.plugin.saveSettings()
                })
            })

        new Setting(this.containerEl)
            .setName('Default audio model')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Only one OpenAI model is supported at the moment ("')
                    fragment.createEl('code', { text: 'whisper-1' })
                    fragment.appendText('").')
                }),
            )
            .addText((text) =>
                text
                    .setDisabled(true)
                    .setValue(this.plugin.settings.GLADDIS_WHISPER_MODEL)
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_WHISPER_MODEL = value
                        await this.plugin.saveSettings()
                    }),
            )

        new Setting(this.containerEl)
            .setName('Default temperature')
            .setDesc('Value in percentage (or Celsius), from 0 (freezing) to 100 (boiling).')
            .addSlider((slider) => {
                slider.sliderEl.style.width = '100%'
                slider
                    .setDynamicTooltip()
                    .setLimits(0, 100, 1)
                    .setValue(Number(this.plugin.settings.GLADDIS_WHISPER_TEMPERATURE))
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_WHISPER_TEMPERATURE = value.toString()
                        await this.plugin.saveSettings()
                    })
            })

        new Setting(this.containerEl)
            .setName('Default echo output')
            .setDesc('Should the transcription output be echoed in the chat ?')
            .addToggle((toggle) =>
                toggle
                    .setValue((this.plugin.settings.GLADDIS_WHISPER_ECHO_OUTPUT ?? 'true') === 'true')
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_WHISPER_ECHO_OUTPUT = value ? 'true' : 'false'
                        await this.plugin.saveSettings()
                    }),
            )

        new Setting(this.containerEl)
            .setName('Default delete file')
            .setDesc('Should the audio file be deleted after the transcription ?')
            .addToggle((toggle) =>
                toggle
                    .setValue((this.plugin.settings.GLADDIS_WHISPER_DELETE_FILE ?? 'true') === 'true')
                    .onChange(async (value) => {
                        this.plugin.settings.GLADDIS_WHISPER_DELETE_FILE = value ? 'true' : 'false'
                        await this.plugin.saveSettings()
                    }),
            )
    }
}

const logoPathAttr = `fill="white"
style="transform: scale(1.5625);"
stroke="currentColor"
stroke-width="2.5px"`

const logoMainPath = `
M61.5 31.5
c-1 -2.5 -5 -10.5 -10.6 -16
c-1.5 -1.5 -6 2 -8 4
c-2 2 -1 5.5 .2 4
c1.5 -1.5 5 -7 6.5 -6.5
c1.5 .5 5 6 9 14
c-1.5 0 -4 0 -7.25 -.25
c-4.5 0 -8 .5 -11.5 1.25
c-3.5 .5 -6 1 -8 1
c-2 0 -4.5 -.5 -8 -1
c-3.5 -.5 -7 -1 -11.5 -1.25
c-3 0 -5.5 0 -7.25 .25
c4 -8 7.5 -13.5 9 -14
c1.5 -.5 5 5 6.5 6.5
c1 1.5 2 -2 .2 -4
c-2 -2 -6.5 -5.5 -8 -4
C7.5 21 3.5 29 2.4 31.5
C2 32.5 2 33 2 33.5
c0 3.5 .5 4 .5 4
c0 0 1 .5 1 1
c0 0 .5 2 .5 2.5
C5 47 6.5 49 15.5 49
c8 0 12 -2 14 -8.4
c0 -.5 .5 -2.5 .5 -2.5
c0 0 0 -.5 .5 -.5
c.5 0 1 0 1.5 0
s1 0 1.5 0
c.5 0 .5 .5 .5 .5
c0 .5 .5 2.5 .5 2.5
C36 46.5 40 49 48.5 49
c9 0 10 -2 11.4 -8
c0 0 .25 -2 .5 -2.5
c0 0 1 -.5 1 -1
c0 0 .5 -.5 .5 -4
c0 -.5 0 -1 0 -1.3`

const logoLeftPath = `
m-34 6
a8 8 0 0 1 -.5 1.75
c-1 4 -4 7 -11.75 7
c-8 0 -9 -2 -9.5 -6.5
c-.5 -1.5 -1 -3.5 -.2 -5.3
c.5 -1 1 -2 3.3 -2.2
c2 0 10 0 15.3 1.2
c1.5 .5 4 1 3.33 4`

const logoFullPath = `
m30 2.5
c-.5 4.5 -1.5 6.5 -9.5 6.5
c-8 0 -11 -3 -11.75 -7
a8 8 0 0 1 -.5 -1.75
c-.5 -3 2 -3.5 3.33 -4
c5 -1 13 -1 15.3 -1.2
c2.5 0 3 1 3.3 2.2
c.5 1.5 0 3.5 -.2 5.3`
