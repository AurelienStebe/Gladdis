import { App, Modal, Notice, Plugin, Setting, TFile } from 'obsidian'

interface GladdisConfig {
    name_label: string
    default_user: string
    openai_api_key?: string
    default_gladdis: string
    default_model: { [name: string]: string }
    default_server: { [name: string]: string }
    default_whisper: string
    whisper_model: { [name: string]: string }
}

const initConfig: GladdisConfig = {
    name_label: 'Gladdis',
    default_user: 'Hooman',
    default_gladdis: 'OpenAI',
    default_model: { OpenAI: 'gpt-4o-mini', Ollama: 'llama3.2:3b', LocalAI: 'llama-3.2-3b-instruct:q8_0' },
    default_server: { Ollama: 'http://localhost:11434/v1', LocalAI: 'http://localhost:8080/v1' },
    default_whisper: 'OpenAI',
    whisper_model: { OpenAI: 'whisper-1', LocalAI: 'whisper-medium-q5_0' },
}

const pluginList = {
    gladdis: 'AurelienStebe/Gladdis',
    cmdr: 'phibr0/obsidian-commander',
    'obsidian-hider': 'kepano/obsidian-hider',
    'vertical-tabs': 'oxdc/obsidian-vertical-tabs',
    'obsidian-outliner': 'vslinko/obsidian-outliner',
    'better-word-count': 'lukeleppan/better-word-count',
    'editing-toolbar': 'PKM-er/obsidian-editing-toolbar',
    'obsidian-style-settings': 'mgmeyers/obsidian-style-settings',
    'obsidian-custom-file-extensions-plugin': 'MeepTech/obsidian-custom-file-extensions-plugin',
}

export default class GladdisStartupPlugin extends Plugin {
    onload(): void {
        // eslint-disable-next-line
        if (!(this.app as any).plugins.enabledPlugins.has('gladdis')) void this.startupPlugin()
    }

    onunload(): void {
        ;(this.app as any).plugins.disablePluginAndSave('gladdis') // eslint-disable-line
    }

    async startupPlugin(): Promise<void> {
        const { plugins, customCss } = this.app as any

        new GladdisWelcomeModal(this.app, (config) => void this.writeConfig(config)).open()

        for (const [name, repo] of Object.entries(pluginList)) {
            const manifest = plugins.manifests[name]

            await plugins.installPlugin(repo, manifest.version, manifest) // eslint-disable-line
            await plugins.enablePluginAndSave(name) // eslint-disable-line
        }

        await plugins.checkForUpdates() // eslint-disable-line

        // eslint-disable-next-line
        for (const plugin of Object.values(plugins.updates) as any) {
            await plugins.installPlugin(plugin.repo, plugin.version, plugin.manifest) // eslint-disable-line
        }

        await customCss.checkForUpdates() // eslint-disable-line

        // eslint-disable-next-line
        for (const theme of Object.values(customCss.updates) as any) {
            await customCss.installTheme(theme.themeInfo, theme.version) // eslint-disable-line
        }

        new Notice('Gladdis is deployed and updated.').noticeEl.addClass('mod-success')
    }

    async writeConfig(config: GladdisConfig): Promise<void> {
        const gladdis = await (this.app as any).plugins.getPlugin('gladdis') // eslint-disable-line

        gladdis.settings.GLADDIS_NAME_LABEL = config.name_label
        gladdis.settings.GLADDIS_DEFAULT_USER = config.default_user

        if (config.openai_api_key !== undefined) gladdis.secrets.OPENAI_API_KEY = config.openai_api_key

        gladdis.settings.GLADDIS_DEFAULT_MODEL = config.default_model[config.default_gladdis]
        if (config.default_server[config.default_gladdis] !== undefined) {
            gladdis.settings.GLADDIS_DEFAULT_SERVER = config.default_server[config.default_gladdis]
        }

        gladdis.settings.GLADDIS_WHISPER_MODEL = config.whisper_model[config.default_whisper]
        if (config.default_server[config.default_whisper] !== undefined) {
            gladdis.settings.GLADDIS_WHISPER_SERVER = config.default_server[config.default_whisper]
        }

        gladdis.settings.GLADDIS_CONFIG_FILE = 'Gladdis.md'
        gladdis.settings.GLADDIS_WHISPER_CONFIG = 'Whisper.md'

        await gladdis.saveSecrets() // eslint-disable-line
        await gladdis.saveSettings() // eslint-disable-line

        const file = this.app.vault.getAbstractFileByPath('Welcome.md')

        if (file instanceof TFile) {
            await this.app.vault.process(file, (data) => {
                return data
                    .replace('__Gladdis:__', `__${config.name_label}:__`)
                    .replace('__Hooman:__', `__${config.default_user}:__`)
            })
        }

        new Notice('Gladdis is configured and ready.').noticeEl.addClass('mod-success')
    }
}

export class GladdisWelcomeModal extends Modal {
    config: GladdisConfig = initConfig

    constructor(app: App, onSubmit: (config: GladdisConfig) => void) {
        super(app)

        this.setTitle('Welcome to your Personal Gladdis Vault !')
        this.titleEl.style.textAlign = 'center'

        const userSetting = new Setting(this.contentEl).setName('Hello ! 👋').addText((text) => {
            text.setValue(this.config.default_user).onChange((value) => {
                this.config.default_user = value
            })
        })

        userSetting.settingEl.style.float = 'left'
        userSetting.settingEl.style.border = 'none'
        userSetting.settingEl.style.marginBlock = '2em'
        userSetting.settingEl.style.backgroundColor = 'unset'

        const nameSetting = new Setting(this.contentEl).setName('My name is').addText((text) => {
            text.setValue(this.config.name_label).onChange((value) => {
                this.config.name_label = value
            })
        })

        nameSetting.settingEl.style.border = 'none'
        nameSetting.settingEl.style.textAlign = 'end'
        nameSetting.settingEl.style.marginBlock = '2em'
        nameSetting.settingEl.style.width = 'fit-content'
        nameSetting.settingEl.style.backgroundColor = 'unset'
        nameSetting.settingEl.style.marginInlineStart = 'auto'

        const modelChoice = this.contentEl.createDiv()
        modelChoice.style.paddingBlock = '1em'
        modelChoice.style.textAlign = 'center'
        modelChoice.createEl('strong', { text: 'Which AI brain should I use by default ?' })

        const openAIModel = this.contentEl.createDiv()

        new Setting(openAIModel)
            .setName(
                createFragment((fragment) => {
                    fragment.appendText('OpenAI models are smart, but ')
                    fragment.createEl('a', {
                        href: 'https://openai.com/api/pricing/',
                        text: 'not free',
                    })
                    fragment.appendText(' ...')
                }),
            )
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('You need an ')
                    fragment.createEl('a', {
                        href: 'https://platform.openai.com/',
                        text: 'OpenAI',
                    })
                    fragment.appendText(' account and to generate an ')
                    fragment.createEl('a', {
                        href: 'https://platform.openai.com/api-keys',
                        text: 'API key',
                    })
                    fragment.appendText('.')
                }),
            )
            .addText((text) => {
                text.inputEl.type = 'password'
                text.setPlaceholder('--OPENAI API KEY--').onChange((value) => (this.config.openai_api_key = value))
            })

        new Setting(openAIModel)
            .setName('Select the default AI model I should use.')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Pick one from the ')
                    fragment.createEl('a', {
                        href: 'https://github.com/AurelienStebe/Gladdis#available-models',
                        text: 'README',
                    })
                    fragment.appendText(' table or the ')
                    fragment.createEl('a', {
                        href: 'https://platform.openai.com/docs/models',
                        text: 'OpenAI',
                    })
                    fragment.appendText(' docs.')
                }),
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        'o3-mini': 'o3 mini (SOTA model)',
                        'o1-mini': 'o1 mini (reasoning)',
                        'gpt-4o': 'GPT-4o (smartest)',
                        'gpt-4o-mini': 'GPT-4o mini (fastest)',
                        'chatgpt-4o-latest': 'ChatGPT-4o (latest)',
                        'gpt-4-turbo': 'GPT-4 Turbo (oldest)',
                        'gpt-3.5-turbo': 'GPT-3.5 Turbo (legacy)',
                    })
                    .setValue(this.config.default_model['OpenAI'])
                    .onChange((value) => (this.config.default_model['OpenAI'] = value))
            })

        const ollamaModel = this.contentEl.createDiv()

        new Setting(ollamaModel)
            .setName('Ollama is the simplest local AI solution.')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Install ')
                    fragment.createEl('a', {
                        href: 'https://ollama.com/download',
                        text: 'Ollama',
                    })
                    fragment.appendText(' and download models with "')
                    fragment.createEl('code', {
                        text: 'ollama pull',
                    })
                    fragment.appendText('".')
                }),
            )
            .addText((text) => {
                text.setValue(this.config.default_server['Ollama']).onChange(
                    (value) => (this.config.default_server['Ollama'] = value),
                )
            })

        new Setting(ollamaModel)
            .setName('Select the default AI model I should use.')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Pick one from the ')
                    fragment.createEl('a', {
                        href: 'https://github.com/AurelienStebe/Gladdis#available-models',
                        text: 'README',
                    })
                    fragment.appendText(' table or the ')
                    fragment.createEl('a', {
                        href: 'https://ollama.com/search',
                        text: 'Ollama',
                    })
                    fragment.appendText(' pages.')
                }),
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        'llama3.3:70b': 'Llama 3.3 70B (43 Go)',
                        'llama3.2-vision:11b': 'Llama 3 V 11B (8 Go)',
                        'llama3.2-vision:90b': 'Llama 3 V 90B (55 Go)',
                        'llama3.2:1b': 'Llama 3.2 1B (1 Go)',
                        'llama3.2:3b': 'Llama 3.2 3B (2 Go)',
                        'llama3.1:8b': 'Llama 3.1 8B (5 Go)',
                        'llama3.1:70b': 'Llama 3.1 70B (43 Go)',
                        'phi4:14b': 'Phi 4 "Medium" (9 Go)',
                        'phi3.5:3.8b': 'Phi 3.5 "Mini" (2 Go)',
                        'phi3:14b': 'Phi 3 "Medium" (8 Go)',
                        'qwen2.5:0.5b': 'Qwen 2.5 0.5B (0.5 Go)',
                        'qwen2.5:1.5b': 'Qwen 2.5 1.5B (1 Go)',
                        'qwen2.5:3b': 'Qwen 2.5 3B (2 Go)',
                        'qwen2.5:7b': 'Qwen 2.5 7B (5 Go)',
                        'qwen2.5:14b': 'Qwen 2.5 14B (9 Go)',
                        'qwen2.5:32b': 'Qwen 2.5 32B (20 Go)',
                        'qwen2.5:72b': 'Qwen 2.5 72B (47 Go)',
                        'gemma2:2b': 'Gemma 2 2B (1.5 Go)',
                        'gemma2:9b': 'Gemma 2 9B (5.5 Go)',
                        'gemma2:27b': 'Gemma 2 27B (16 Go)',
                        'llava:7b': 'Llava 1.6 7B (5 Go)',
                        'llava:13b': 'Llava 1.6 13B (8 Go)',
                        'llava:34b': 'Llava 1.6 34B (20 Go)',
                        'llava-phi3:3.8b': 'Llava Phi 3.8B (3 Go)',
                        'llava-llama3:8b': 'Llava Llama 8B (5 Go)',
                    })
                    .setValue(this.config.default_model['Ollama'])
                    .onChange((value) => (this.config.default_model['Ollama'] = value))
            })

        const localAIModel = this.contentEl.createDiv()

        new Setting(localAIModel)
            .setName('LocalAI provides access to over 500 LLMs.')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Follow the ')
                    fragment.createEl('a', {
                        href: 'https://localai.io/basics/getting_started/',
                        text: 'installation instructions',
                    })
                    fragment.appendText(' and ')
                    fragment.createEl('a', {
                        href: 'https://localai.io/models/',
                        text: 'explore the gallery',
                    })
                    fragment.appendText('.')
                }),
            )
            .addText((text) => {
                text.setValue(this.config.default_server['LocalAI']).onChange(
                    (value) => (this.config.default_server['LocalAI'] = value),
                )
            })

        new Setting(localAIModel)
            .setName('Select the default AI model I should use.')
            .setDesc(
                createFragment((fragment) => {
                    fragment.appendText('Pick one from the ')
                    fragment.createEl('a', {
                        href: 'https://github.com/AurelienStebe/Gladdis#available-models',
                        text: 'README',
                    })
                    fragment.appendText(' table or the ')
                    fragment.createEl('a', {
                        href: 'https://localai.io/gallery.html',
                        text: 'LocalAI',
                    })
                    fragment.appendText(' gallery.')
                }),
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({
                        'llama-3.3-70b-instruct': 'Llama 3.3 70B (43 Go)',
                        'llama-3.2-1b-instruct:q8_0': 'Llama 3.2 1B (1 Go)',
                        'llama-3.2-3b-instruct:q8_0': 'Llama 3.2 3B (2 Go)',
                        'meta-llama-3.1-8b-instruct': 'Llama 3.1 8B (5 Go)',
                        'meta-llama-3.1-70b-instruct': 'Llama 3.1 70B (43 Go)',
                        'phi-4': 'Phi 4 "Medium" (9 Go)',
                        'phi-3.5-vision:vllm': 'Phi 3.5 "Vision" (2 Go)',
                        'phi-3.5-mini-instruct': 'Phi 3.5 "Mini" (2 Go)',
                        'phi-3.5-moe-instruct': 'Phi 3.5 "MoE" (24 Go)',
                        'phi-3-vision:vllm': 'Phi 3 "Vision" (2 Go)',
                        'phi-3-medium-4k-instruct': 'Phi 3 "Medium" (8 Go)',
                        'qwen2.5-0.5b-instruct': 'Qwen 2.5 0.5B (0.5 Go)',
                        'qwen2.5-1.5b-instruct': 'Qwen 2.5 1.5B (1 Go)',
                        'qwen2.5-14b-instruct': 'Qwen 2.5 14B (9 Go)',
                        'qwen2.5-32b-instruct': 'Qwen 2.5 32B (20 Go)',
                        'qwen2.5-72b-instruct': 'Qwen 2.5 72B (47 Go)',
                        'gemma-2b': 'Gemma 2 2B (1.5 Go)',
                        'gemma-2-9b-it': 'Gemma 2 9B (5.5 Go)',
                        'gemma-2-27b-it': 'Gemma 2 27B (16 Go)',
                        'llava-1.6-vicuna': 'Llava "Vicuna" (5 Go)',
                        'llava-1.6-mistral': 'Llava "Mistral" (5 Go)',
                        'llava-llama-3-8b-v1_1': 'Llava "Llama 3" (5 Go)',
                    })
                    .setValue(this.config.default_model['LocalAI'])
                    .onChange((value) => (this.config.default_model['LocalAI'] = value))
            })

        const modelButton = this.createTabs(this.contentEl, {
            OpenAI: openAIModel,
            Ollama: ollamaModel,
            LocalAI: localAIModel,
        })

        const audioChoice = this.contentEl.createDiv()
        audioChoice.style.paddingBlock = '1em'
        audioChoice.style.textAlign = 'center'
        audioChoice.createEl('strong', { text: 'Whom will you Whisper to by default ?' })

        const openAIAudio = this.contentEl.createDiv()

        new Setting(openAIAudio).setName('OpenAI only serves one speech-to-text model.').addDropdown((dropdown) => {
            dropdown
                .setDisabled(true)
                .addOptions({ 'whisper-1': 'Whisper-1' })
                .setValue(this.config.whisper_model['OpenAI'])
        })

        const localAIAudio = this.contentEl.createDiv()

        new Setting(localAIAudio).setName('Pick your Whisper size (Large is only 1 Go).').addDropdown((dropdown) => {
            dropdown
                .addOptions({
                    'whisper-large-q5_0': 'Large (1 000 Mo)',
                    'whisper-medium-q5_0': 'Medium (500 Mo)',
                    'whisper-small-q5_1': 'Small (180 Mo)',
                    'whisper-base-q5_1': 'Base (60 Mo)',
                    'whisper-tiny-q5_1': 'Tiny (30 Mo)',
                })
                .setValue(this.config.whisper_model['LocalAI'])
                .onChange((value) => (this.config.whisper_model['LocalAI'] = value))
        })

        const audioButton = this.createTabs(this.contentEl, { OpenAI: openAIAudio, LocalAI: localAIAudio })

        const closeButton = new Setting(this.contentEl).addButton((button) => {
            button
                .setCta()
                .setButtonText('Confirm')
                .onClick(() => {
                    this.config.default_gladdis = modelButton.find((b) => b.hasClass('mod-cta'))!.getText()
                    this.config.default_whisper = audioButton.find((b) => b.hasClass('mod-cta'))!.getText()

                    onSubmit(this.config)
                    this.close()
                })
        })

        closeButton.settingEl.style.border = 'none'
        closeButton.settingEl.style.backgroundColor = 'unset'
    }

    createTabs(root: HTMLElement, tabs: { [tabName: string]: HTMLElement }): HTMLElement[] {
        const tabContainer = root.createDiv({ cls: 'gladdis-tab-container' })
        const tabHeader = tabContainer.createDiv({ cls: 'gladdis-tab-header' })
        const tabContent = tabContainer.createDiv({ cls: 'gladdis-tab-content' })

        const tabButtons: HTMLElement[] = []

        tabHeader.style.display = 'flex'
        tabHeader.style.paddingBlock = '1em'
        tabHeader.style.justifyContent = 'space-evenly'

        tabContainer.style.marginBlockEnd = '2em'

        Object.entries(tabs).forEach(([name, html]) => {
            const tabButton = tabHeader.createEl('button', { text: name })

            tabButton.onclick = () => {
                tabButtons.forEach((button) => button.removeClass('mod-cta'))
                tabButton.addClass('mod-cta')

                Object.values(tabs).forEach((content) => content.hide())
                html.show()
            }

            if (name === this.config.default_gladdis) {
                tabButton.addClass('mod-cta')
                html.show()
            } else {
                html.hide()
            }

            tabContent.appendChild(html)
            tabButtons.push(tabButton)
        })

        return tabButtons
    }
}
