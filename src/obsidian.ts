import { deepmerge } from 'deepmerge-ts'

import { doGladdis } from './gladdis.js'
import { parseLinks } from './utils/scanner.js'
import { transcribe } from './utils/whisper.js'
import { webBrowser } from './utils/browser.js'
import { loadContext, loadContent } from './utils/loaders.js'
import { getTokenModal, writeErrorModal } from './utils/loggers.js'

import { Plugin, Setting, PluginSettingTab, TFile, normalizePath } from 'obsidian'
import type { App, Editor, MarkdownView, MarkdownFileInfo, Vault } from 'obsidian'

import type { Context, DiskInterface } from './types/context.js'

export { stringifyYaml, parseYaml, request, htmlToMarkdown as turndown } from 'obsidian'

export const parseDOM = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

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

        this.addCommand({
            id: 'chat-with-gladdis',
            name: 'Chat with Gladdis',

            editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                await this.processWithContext(editor, view, async (context: Context) => {
                    await doGladdis(loadContent(await loadContext(context)))
                })
            },
        })

        this.addCommand({
            id: 'process-the-content',
            name: 'Process the full content',

            editorCallback: async (editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                await this.processWithContext(editor, view, async (context: Context) => {
                    context = loadContent(await loadContext(context))

                    context.whisper.echoOutput = true
                    context.whisper.deleteFile = false

                    for (const message of context.user.history) {
                        message.content = await parseLinks(message.content, context)
                    }

                    context.user.prompt = await parseLinks(context.user.prompt, context)
                    context.user.prompt = await transcribe(context.user.prompt, context)
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

                    context.user.prompt = await parseLinks(context.user.prompt, context)
                    context.user.prompt = await transcribe(context.user.prompt, context)
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
        } catch (error: any) {
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
