<p align="center">
    <img height="230" width="320" alt="Gladdis Logo" src="https://raw.githubusercontent.com/AurelienStebe/Gladdis/main/gladdis.svg">
</p>

## Description

[Obsidian](https://obsidian.md) exists to help you build a second brain. Gladdis exists to give that brain a pen (let it do the writing for once), ears (talking is easier than typing) and multiple split personalities (give your system prompts names). Further plans for v1.0 include: a brush (let it paint like an artist), a voice (listening is easier than reading), an internal monologue (together we are more than our sum) and the ability to execute code (what could possibly go wrong ?).

### Current Features

-   **Simple Markdown Syntax**: the conversation window is any open Markdown file, the streaming LLM response is appended.
-   **Whisper Transcription**: audio files WikiLinks are auto-transcribed, use the Obsidian "audio recorder" core plugin.
-   **Document Loading**: text files WikiLinks are auto-loaded, just drag and drop files into the conversation window.
-   **PDF & Web Support**: load PDF WikiLinks just like text files, load web pages external links as well using `<URL>`.
-   **Image Vision AIs**: send images to vision supporting LLMs using local WikiLinks or Markdown external web links.
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
    config: Gladdis   # select which AI you talk to
    model: gpt-4o     # choose the current AI model
    server: http://   # use local or custom servers
    temperature: 42   # test different temperatures
    top_p_param: 88   # or various probability mass
whisper:
    config: Whisper   # switch transcription config
    model: whisper-1  # change the transcription AI
    temperature: 24   # test different temperatures
    echoOutput: true  # write transcription callout
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

The following [OpenAI models](https://platform.openai.com/docs/models) are supported via the paying API:

| Label | Tokens | Vision | Notes |
| ----- | :----: | :----: | ----- |
| `gpt-4o` | 128 k | ✅ | OpenAI's high-intelligence flagship model for complex, multi-step tasks. |
| `gpt-4o-mini` | 128 k | ✅ | OpenAI's affordable and intelligent small model for fast, lightweight tasks. |
| `chatgpt-4o-latest` | 128 k | ✅ | Dynamic model continuously updated to the current version of GPT-4o in ChatGPT. |
| `gpt-4-turbo` | 128 k | ✅ | The latest GPT-4 Turbo model with vision capabilities (GPT-4o is cheaper and faster). |
| `gpt-3.5-turbo` | 16 k | | The latest GPT-3.5 Turbo model with higher accuracy (GPT-4o mini is cheaper and more capable). |

Open Source models can be used locally via [Ollama](https://ollama.com/) or [LocalAI](https://localai.io/):

| Label | Tokens | Vision | Notes |
| ----- | :----: | :----: | ----- |
| `llama3.2` | 128 k | | Meta's new 1B and 3B models optimized for multilingual dialogue use cases. |
| `llama3.1` | 128 k | | Meta's 8B, 70B and 405B models with overall stronger reasoning capabilities. |
| `phi3.5` / `phi3` | 128 k | | Microsoft's new Phi 3.5 "Mini" (3.8B) and Phi 3 "Medium" (14B) open models. |
| `qwen2.5` | 128 k | | Alibaba Cloud's Qwen multilingual Chinese models ranging from 0.5B to 72B. |
| `gemma2` | 128 k | | Google's Gemma 2B, 9B and 27B models featuring a brand new architecture. |
| `llava` | 4 k | ✅ | Family of Large Language-and-Vision Assistant models between 7B and 34B. |

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
2. Follow the instructions for ["Adding a beta plugin"](https://tfthacker.com/brat-quick-guide#Adding+a+beta+plugin).

### Manually from GitHub

1. Download the `main.js` & `manifest.json` files from the [latest release](https://github.com/AurelienStebe/Gladdis/releases) into your vault's plugins folder: `<vault>/.obsidian/plugins/gladdis/`.

## How to Contribute ?

Feel free to open new issues or submit PRs, while the Gladdis community is growing.

## About the Author

Gladdis is created by [Aurélien Stébé](https://github.com/AurelienStebe), a senior French freelance [Toptal Software Engineer](https://www.toptal.com/resume/aurelien-stebe).
