# [0.6.0](https://github.com/AurelienStebe/Gladdis/compare/0.5.1...0.6.0) (2024-11-13)


### Bug Fixes

* add ESLint rules exceptions and fixes ([51a81b5](https://github.com/AurelienStebe/Gladdis/commit/51a81b5f42f0fbb87e9032c9e8c26935264bfcc7))
* improve PDF, Whisper & Web pages modals ([ad68498](https://github.com/AurelienStebe/Gladdis/commit/ad684988104e1304ac9f57ee2d4b42e33b17005e))


### Features

* add a model catalog and details FM params ([1f50162](https://github.com/AurelienStebe/Gladdis/commit/1f50162b927f0a2fd173f42cf8025ef3c98f7dc1))
* add support for local LLM & Whisper servers ([76f8737](https://github.com/AurelienStebe/Gladdis/commit/76f87378fa0cf5493153f2558632c03ae72ad80d))
* add support for vision LLMs and image loading ([20ef157](https://github.com/AurelienStebe/Gladdis/commit/20ef1575b677db562943c34e19a430d49a690b98))

## [0.5.1](https://github.com/AurelienStebe/Gladdis/compare/0.5.0...0.5.1) (2024-04-03)


### Bug Fixes

* add icons to the Commands and new logo ([686499c](https://github.com/AurelienStebe/Gladdis/commit/686499c1c3bbcc35d2a13eb199f5edbe322bb64c))
* add PDF parsing & improve the Web Browsing on Desktop ([561626f](https://github.com/AurelienStebe/Gladdis/commit/561626f0afd635d2ca04f0a4cb03c1044348b85f))
* improve the empty Web Browsing results handling ([6e1ab98](https://github.com/AurelienStebe/Gladdis/commit/6e1ab98f84291ecf445199a57c6fd2997c0bef3b))
* improve the Error Modal formating with empty errors ([ed39133](https://github.com/AurelienStebe/Gladdis/commit/ed39133a489aab582c86f63708d57e52982044c7))
* refactor all error messages outputs into 3 functions ([13dd0b3](https://github.com/AurelienStebe/Gladdis/commit/13dd0b3301b2094fab7fe98f985a89e0eeca8492))
* run the "parseLinks" utils in parallel with "Promise.all" ([4f851a7](https://github.com/AurelienStebe/Gladdis/commit/4f851a7e02a0b6e8a69b67e0b8be07823b8bc175))
* scanner's MD file detector and error type ([89d348b](https://github.com/AurelienStebe/Gladdis/commit/89d348b139c0e8fb29b3d1ccb24537ee1ff4dc3d))
* WikiLinks scanner with MD filenames with a dot in it ([95b67b9](https://github.com/AurelienStebe/Gladdis/commit/95b67b90e4eef585048196dcc60562ebdd09b01d))

# [0.5.0](https://github.com/AurelienStebe/Gladdis/compare/0.4.3...0.5.0) (2024-03-09)


### Bug Fixes

* add the new OpenAI models in the settings panel ([a10ccdd](https://github.com/AurelienStebe/Gladdis/commit/a10ccddd9adfc0ab65a3679db75e94ca49edaee7))
* improve the Token Counter & correct the counting ([d06e725](https://github.com/AurelienStebe/Gladdis/commit/d06e725519d1206881c7fc581f6cc5d0663e8b8c))
* minor code improvements, no real change ([875d053](https://github.com/AurelienStebe/Gladdis/commit/875d053fcebe97742e9c6fdfd1ba03d2ab925e74))
* only transcribe the prompt and not all messages ([101fe19](https://github.com/AurelienStebe/Gladdis/commit/101fe1988ebeef2b5698915a69d867db96364c11))


### Features

* add the Web Browsing feature for static websites ([2357149](https://github.com/AurelienStebe/Gladdis/commit/23571495c7ece52c179acc9cc4ebf756d3f3161b))

## [0.4.3](https://github.com/AurelienStebe/Gladdis/compare/0.4.2...0.4.3) (2023-10-07)


### Bug Fixes

* bug with empty config file values in settings ([0df2dc3](https://github.com/AurelienStebe/Gladdis/commit/0df2dc3f08d82bcbd6c9bcdf5eaa7dbd8c63869b))
* remove “dotenv“ dep in Obsidian, code “parse“ ([16e202f](https://github.com/AurelienStebe/Gladdis/commit/16e202f865e4585791b4250ca50010f5d958a0c3))
* remove YAML dep in Obsidian with import alias ([b256b1f](https://github.com/AurelienStebe/Gladdis/commit/b256b1f90ab488e07a87614100a2182dbdb2d7dc))

## [0.4.2](https://github.com/AurelienStebe/Gladdis/compare/0.4.1...0.4.2) (2023-10-02)


### Bug Fixes

* adapt the core logic to be an Obsidian plugin ([21680cc](https://github.com/AurelienStebe/Gladdis/commit/21680cc1a6746b41a9dcdffbe0b6ffbd0a4aa66f))
* create a new commands API & adapt the service ([d6a5c16](https://github.com/AurelienStebe/Gladdis/commit/d6a5c16069224f782a24679476a387d6a84398b5))
* create the Obsidian plugin with settings panel ([ca79915](https://github.com/AurelienStebe/Gladdis/commit/ca7991547b6790db81d97907c6f7ff550b7c8c50))
* the WikiLinks regex & update all dependencies ([1e6d5b0](https://github.com/AurelienStebe/Gladdis/commit/1e6d5b0b99e9edd8dbe849d8b2bea56216276806))

## [0.4.1](https://github.com/AurelienStebe/Gladdis/compare/Gladdis-v0.4.0...Gladdis-v0.4.1) (2023-08-25)


### Bug Fixes

* adapt Gladdis to new code & improve Heuristics ([5529d93](https://github.com/AurelienStebe/Gladdis/commit/5529d93e1941c5adb7d1ed6d0389a34cd4f6831b))
* add ".env" example file & update dependencies ([87ec4ff](https://github.com/AurelienStebe/Gladdis/commit/87ec4ffdd3cd76c41ac575b2d97fb6e63c305f60))
* add a wiki links scanner & file path resolver ([e7702e2](https://github.com/AurelienStebe/Gladdis/commit/e7702e28ad1c1aebd30a61017682e0f5066a2850))
* improve the Whisper & Scanner error handling ([4e5a1e3](https://github.com/AurelienStebe/Gladdis/commit/4e5a1e377415692765ad72db454b456e60b1b5e3))
* improvements, bug fixes to the config & UI/UX ([5c0be74](https://github.com/AurelienStebe/Gladdis/commit/5c0be748eaa637b81ea893f1981a330b8afee0a7))
* upgrade to openai API v4 and update all deps ([b26fb37](https://github.com/AurelienStebe/Gladdis/commit/b26fb377a4572784c3e4cb13a956ac08435afb33))

# [0.4.0](https://github.com/AurelienStebe/Gladdis/compare/Gladdis-v0.3.1...Gladdis-v0.4.0) (2023-04-29)


### Bug Fixes

* final bug fixes before the NPM package release ([cc49c95](https://github.com/AurelienStebe/Gladdis/commit/cc49c9571aa4ead3b80f59e5883aa0ef1dfa165c))


### Features

* add AI config loading & switch to "fs-extra" ([d764740](https://github.com/AurelienStebe/Gladdis/commit/d764740bd732249e4567a46a71624597534d6ade))
