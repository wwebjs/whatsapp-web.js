<div align="center">
    <p>
        <a href="https://wwebjs.dev">
            <img src="https://github.com/wwebjs/Assets/blob/main/Collection/GitHub/whatsapp-web.js.png?raw=true"
                title="whatsapp-web.js" alt="WWebJS Website" />
        </a>
    </p>
    <p>
        <a href="https://www.npmjs.com/package/whatsapp-web.js"><img
                src="https://img.shields.io/npm/v/whatsapp-web.js.svg" alt="npm" /></a>
        <a href="https://www.npmjs.com/package/whatsapp-web.js"><img alt="NPM Downloads"
                src="https://img.shields.io/npm/d18m/whatsapp-web.js" /></a>
        <a href="https://github.com/wwebjs/whatsapp-web.js/graphs/contributors"><img alt="GitHub contributors"
                src="https://img.shields.io/github/contributors-anon/wwebjs/whatsapp-web.js" /></a>
        <a href="https://depfu.com/github/wwebjs/whatsapp-web.js?project_id=9765"><img
                src="https://badges.depfu.com/badges/4a65a0de96ece65fdf39e294e0c8dcba/overview.svg" alt="Depfu" /></a>
        <a href="https://discord.wwebjs.dev"><img
                src="https://img.shields.io/discord/698610475432411196.svg?logo=discord" alt="Discord server" /></a>
    </p>
</div>

## About

whatsapp‑web.js is a powerful [Node.js][nodejs] library that lets you interact with WhatsApp Web, making it easy to build a dynamic WhatsApp API with nearly all features of the web client. It uses [Puppeteer][puppeteer] to access WhatsApp Web’s internal functions and runs them in a managed browser instance to reduce the risk of being blocked.

## Links

- [GitHub][gitHub]
- [Guide][guide] ([source][guide-source])
- [Documentation][documentation] ([source][documentation-source])
- [Discord Server][discord]
- [npm][npm]

## Installation

**Node.js `v18.0.0` or higher, is required.**

```sh
npm install whatsapp-web.js
yarn add whatsapp-web.js
pnpm add whatsapp-web.js
```

Having trouble installing? Take a peak at the [Guide][guide] for more detailed instructions.

## Example usage

```js
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client();

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', (msg) => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
```

Take a look at [example.js][examples] for additional examples and use cases.  
For more details on saving and restoring sessions, check out the [Authentication Strategies][auth-strategies].

## Supported features

| Feature                                          | Status                                       |
| ------------------------------------------------ | -------------------------------------------- |
| Multi Device                                     | ✅                                           |
| Send messages                                    | ✅                                           |
| Receive messages                                 | ✅                                           |
| Send media (images/audio/documents)              | ✅                                           |
| Send media (video)                               | ✅ [(requires Google Chrome)][google-chrome] |
| Send stickers                                    | ✅                                           |
| Receive media (images/audio/video/documents)     | ✅                                           |
| Send contact cards                               | ✅                                           |
| Send location                                    | ✅                                           |
| Send buttons                                     | ❌ [(DEPRECATED)][deprecated-video]          |
| Send lists                                       | ❌ [(DEPRECATED)][deprecated-video]          |
| Receive location                                 | ✅                                           |
| Message replies                                  | ✅                                           |
| Join groups by invite                            | ✅                                           |
| Get invite for group                             | ✅                                           |
| Modify group info (subject, description)         | ✅                                           |
| Modify group settings (send messages, edit info) | ✅                                           |
| Add group participants                           | ✅                                           |
| Kick group participants                          | ✅                                           |
| Promote/demote group participants                | ✅                                           |
| Mention users                                    | ✅                                           |
| Mention groups                                   | ✅                                           |
| Mute/unmute chats                                | ✅                                           |
| Block/unblock contacts                           | ✅                                           |
| Get contact info                                 | ✅                                           |
| Get profile pictures                             | ✅                                           |
| Set user status message                          | ✅                                           |
| React to messages                                | ✅                                           |
| Create polls                                     | ✅                                           |
| Channels                                         | ✅                                           |
| Vote in polls                                    | ✅                                           |
| Communities                                      | 🔜                                           |

Something missing? Make an issue and let us know!

## Supporting the project

You can support the maintainer of this project through the links below:

- [Support via GitHub Sponsors][gitHub-sponsors]
- [Support via PayPal][support-payPal]

## Contributing

Feel free to open pull requests; we welcome contributions! However, for significant changes, it's best to open an issue beforehand. Make sure to review our [contribution guidelines][contributing] before creating a pull request. Before creating your own issue or pull request, always check to see if one already exists!

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at [whatsapp.com][whatsapp]. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners. Also it is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## License

Copyright 2019 Pedro S Lopez

Licensed under the Apache License, Version 2.0 (the "License");  
you may not use this project except in compliance with the License.  
You may obtain a copy of the License at <https://www.apache.org/licenses/LICENSE-2.0>.

Unless required by applicable law or agreed to in writing, software  
distributed under the License is distributed on an "AS IS" BASIS,  
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and  
limitations under the License.

[guide]: https://guide.wwebjs.dev/guide
[guide-source]: https://github.com/wwebjs/wwebjs.dev/tree/main
[documentation]: https://docs.wwebjs.dev/
[documentation-source]: https://github.com/wwebjs/whatsapp-web.js/tree/main/docs
[discord]: https://discord.wwebjs.dev
[gitHub]: https://github.com/wwebjs/whatsapp-web.js
[npm]: https://npmjs.org/package/whatsapp-web.js
[nodejs]: https://nodejs.org/en/download/
[examples]: https://github.com/wwebjs/whatsapp-web.js/blob/main/example.js
[auth-strategies]: https://wwebjs.dev/guide/creating-your-bot/authentication.html
[google-chrome]: https://wwebjs.dev/guide/creating-your-bot/handling-attachments.html#caveat-for-sending-videos-and-gifs
[deprecated-video]: https://www.youtube.com/watch?v=hv1R1rLeVVE
[gitHub-sponsors]: https://github.com/sponsors/wwebjs
[support-payPal]: https://www.paypal.me/psla/
[contributing]: .github/CONTRIBUTING.md
[whatsapp]: https://whatsapp.com
[puppeteer]: https://pptr.dev/
