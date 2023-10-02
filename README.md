<br/>

<h3 align="center">Gladdis (Generative Language Artificial Dedicated & Diligent Intelligence System) - it's an AI chatbot.</h3>

<hr/><br/>

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
-   **Document Loading**: text files WikiLinks are auto-loaded, just drag and drop files into the conversation window. (no PDF yet)
-   **System Prompts**: name your system prompts, create personalities and use FrontMatter to choose whom to talk to.

## Installation

### From within Obsidian (soon)

1. Open the "Community plugins" tab in the settings.
2. Click the "Browse" button and search for "Gladdis".
3. Click the "Install" button and enable the plugin.

### With the BRAT plugin

1. Install the [Beta Reviewers Auto-update Tool plugin](https://github.com/TfTHacker/obsidian42-brat).
2. Follow the instructions for ["Adding a beta plugin"](https://tfthacker.com/Obsidian+Plugins+by+TfTHacker/BRAT+-+Beta+Reviewer's+Auto-update+Tool/Quick+guide+for+using+BRAT#Adding+a+beta+plugin).

### Manually from GitHub

1. Download the `main.js` & `manifest.json` files from the [latest release](https://github.com/AurelienStebe/Gladdis/releases) into your vault's plugins folder: `<vault>/.obsidian/plugins/gladdis/`.

## Documentation [WIP]

### Obsidian Commands

Gladdis provides 3 commands, map them to hotkeys in the settings or create buttons with the [Commander plugin](https://github.com/phibr0/obsidian-commander).

-   **Chat with Gladdis**: the main command to perform the full processing, including the call to the LLM model.
-   **Process the Content**: to check that all links and transcriptions are correct, and get a full token count.
-   **Process the Prompt (or Selection)**: to check just the prompt or selection and get a specific token count.

### Settings / Options

-   **Data Root Path**: Gladdis will search for config files in the `configs` subfolder, and will write the chat and call logs in the `history` subfolder.
-   **OpenAI Secret Key**: create an OpenAI API account, [generate an API key](https://platform.openai.com/account/api-keys) and paste it in the settings panel.
-   **FrontMatter Defaults**: adjust the various defaults for the Gladdis and Whisper options.

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

The very last message is the prompt, the LLM response streams below.
```

## Future Development

-   **PDF & Web Support**: load PDF WikiLinks just like text files, load web pages external links as well.
-   **Image & Audio Out**: create images with DALL·E, speak with ElevenLabs or other API accessible models.
-   **Code Execution**: add [Templater](https://github.com/SilentVoid13/Templater) code to your prompts, run any code the AI generates (are you sure ?!).
-   **AI-2-AI Prompt**: let your various AI configs talk to each other, create your own "Council of Gladdises".

## How to Contribute ? [WIP]

Please be patient while I create the issue & PR templates and finish the documentation.

## About the Author

Gladdis is created by [Aurélien Stébé](https://github.com/AurelienStebe), a senior French freelance [Toptal Software Developer](https://www.toptal.com/resume/aurelien-stebe).
