<p align="center">
    <a href="https://github.com/AurelienStebe/Gladdis">
        <img width="240" alt="Gladdis Logo" src="https://raw.githubusercontent.com/AurelienStebe/Gladdis/main/gladdis.svg">
    </a>
</p>

<p align="center">
    <a href="https://github.com/prettier/prettier">
        <img alt="Code Formatter" src="https://badgen.net/badge/code%20format/prettier/ff69b4">
    </a>
    &nbsp;
    <a href="https://github.com/standard/standard">
        <img alt="TypeScript Style" src="https://badgen.net/badge/code%20style/standard/green">
    </a>
    &nbsp;
    <a href="https://github.com/semantic-release/semantic-release">
        <img alt="Semantic Release" src="https://badgen.net/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80/semantic-release/e10079">
    </a>
    &nbsp;
    <a href="https://github.com/AurelienStebe/Gladdis/blob/main/LICENSE">
        <img alt="GitHub License" src="https://badgen.net/github/license/AurelienStebe/Gladdis">
    </a>
    &nbsp;
</p>

## Description

[Obsidian](https://obsidian.md) exists to help you build a second brain. Gladdis exists to give that brain a pen (let it do the writing for once), ears (talking is easier than typing) and multiple split personalities (give your system prompts names). Further plans for v1.0 include: a brush (let it paint like a true artist), a voice (listening is easier than reading), an internal monologue (together we are more than our sum) and the ability to execute code (what could possibly go wrong ?).

### Current Features

-   **Simple Markdown Syntax**: the conversation window is any open Markdown file, the streaming LLM response is appended.
-   **Whisper Transcription**: audio files WikiLinks are auto-transcribed, use the Obsidian "audio recorder" core plugin.
-   **Document Loading**: text files WikiLinks are auto-loaded, just drag and drop files into the conversation window.
-   **PDF & Web Support**: load PDF WikiLinks just like text files, load web pages external links as well using `<URL>`.
-   **System Prompts**: name your system prompts, create personalities and use FrontMatter to choose whom to talk to.

## Documentation

### Obsidian Commands

Gladdis provides 3 commands, map them to hotkeys in the settings or create buttons with the [Commander plugin](https://github.com/phibr0/obsidian-commander).

-   **Chat with Gladdis**: the main command to perform the full processing, including the call to the LLM model.
-   **Process the Content**: to check that all links and transcriptions are correct, and get a full token count.
-   **Process the Prompt (or Selection)**: to check just the prompt or selection and get a specific token count.

### Settings / Options

The settings panel let you specify the plugin data folder, your OpenAI API key and the FrontMatter defaults.

-   **Data Root Path**: Gladdis will search for config files in the `configs` subfolder, and will write the chat and call logs in the `history` subfolder.
-   **OpenAI Secret Key**: create an OpenAI API account, [generate an API key](https://platform.openai.com/account/api-keys) and paste it in the settings panel.
-   **FrontMatter Defaults**: adjust the various defaults for the Gladdis and Whisper options.

### FrontMatter Config

The defaults from the settings panel can be overridden using FrontMatter in any conversation or config file.

```yaml
---
gladdis:
    label: Gladdis    # name the AI in the config
    config: Gladdis   # switch the AI you talk to
    model: gpt-3.5-turbo # switch the model at any time
    temperature: 42   # test different temperatures
    top_p_param: 100  # or various probability mass
whisper:
    config: Whisper   # switch transcription language
    model: whisper-1  # only one model at the moment
    temperature: 24   # test different temperatures
    echoOutput: true  # output transcription callout
    deleteFile: false # cleanup after transcription
---
```

### Markdown Syntax

The same familiar Obsidian syntax from your notes is used for the conversation history (it's all just text).

```md
Just use standard Markdown text for `User` messages and prompts.
The content of the Gladdis config file will be prepended to this.
Use triple dashes to separate messages / sections of conversation.

---

__UserName:__ labels also start a new message with custom names.

__Gladdis:__ Gladdis' label and `Assistant` are for AI messages.

__System:__ is for System Prompts (the default in config files).

---

> Quoted lines are ignored, error and token counter callouts too.

[[path/file.md|WikiLinks to file]] and ![[audio_recording.mp3]] will be parsed.
Static Web pages can be loaded using angle brackets: <https://www.example.com>.

The very last message is the prompt, the LLM response streams below.
```

### Available Models

Only the OpenAI models are supported at the moment, however more APIs and local models are coming.

| Label | Token Limit | Notes |
| ----- | :-----------: | ----- |
| `gpt-4-turbo-preview` | 128 k | The most powerful and expensive. |
| `gpt-4-32k` | 32 k | The old GPT-4, with large context. |
| `gpt-4` | 8 k | The original GPT-4, from June 2023. |
| `gpt-3.5-turbo` | 16 k | The updated GPT-3.5, cheaper than 4. |
| `gpt-3.5-turbo-16k` | 16 k | The old GPT-3.5, with large context. |
| `gpt-3.5-turbo-0613` | 4 k | The original GPT-3.5, from June 2023. |

## Future Development

-   **Image & Audio Out**: create images with DALL·E, speak with ElevenLabs or other API accessible models.
-   **Code Execution**: add [Templater](https://github.com/SilentVoid13/Templater) code to your prompts, run any code the AI generates (are you sure ?!).
-   **AI-2-AI Prompt**: let your various AI configs talk to each other, create your own "Council of Gladdises".

## Installation

### From within Obsidian

1. Open the "Community plugins" tab in the settings.
2. Click the "Browse" button and search for "Gladdis".
3. Click the "Install" button and enable the plugin.

### With the BRAT plugin

1. Install the [Beta Reviewers Auto-update Tool plugin](https://github.com/TfTHacker/obsidian42-brat).
2. Follow the instructions for ["Adding a beta plugin"](https://tfthacker.com/Obsidian+Plugins+by+TfTHacker/BRAT+-+Beta+Reviewer's+Auto-update+Tool/Quick+guide+for+using+BRAT#Adding+a+beta+plugin).

### Manually from GitHub

1. Download the `main.js` & `manifest.json` files from the [latest release](https://github.com/AurelienStebe/Gladdis/releases) into your vault's plugins folder: `<vault>/.obsidian/plugins/gladdis/`.

## How to Contribute ?

Feel free to open new issues or submit PRs, while the Gladdis community is growing.

## About the Author

Gladdis is created by [Aurélien Stébé](https://github.com/AurelienStebe), a senior French freelance [Toptal Software Engineer](https://www.toptal.com/resume/aurelien-stebe).
