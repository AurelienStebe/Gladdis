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

Just use standard Markdown text for `User` messages and prompts.
The content of the Gladdis config file will be prepended to this.
Use triple underscores to separate the sections of conversation.

___

__UserName:__ labels also start a new message with custom names.
__Gladdis:__ Gladdis' label and `Assistant` are for AI messages.
__System:__ is for System Prompts (the default in config files).

___

> Quoted lines are ignored, error and token counter callouts too.

[[path/file.md|WikiLinks to file]] and ![[audio_recording.mp3]] links will be parsed.
Static Web pages can be loaded using angle brackets: <https://www.example.com>.

The very last message is the prompt, the LLM response streams below.
