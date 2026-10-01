# Personal WhatsApp bot

A small assistant built on whatsapp-web.js. It runs as a linked device on your own
WhatsApp account and obeys messages **you** send (from your own "Message yourself"
chat). Messages from anyone else are ignored.

| Command                                                          | What it does                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `!menu`                                                          | Tap-to-choose poll: Remind me, Repeat reminder, Schedule a message, Quick message, Message a group, Shopping list, Birthdays, News & markets (links), Daily tools (headlines, weather, prayer times, morning brief), Articles (ideas, drafts, publish to dev.to), My reminders. Works only in your own "Message yourself" chat |
| `!help`                                                          | Lists commands                                                                                                                                                                                                                                                                                                                 |
| `!ping`                                                          | Replies `pong`                                                                                                                                                                                                                                                                                                                 |
| `!stop` / `!restart`                                             | Stop the bot (stays stopped until you start it again) / restart it. Only works in your own chat                                                                                                                                                                                                                                |
| `!article <topic>`                                               | Writes a draft with Claude, shows it, and publishes to dev.to only after you tap **Publish** (or **Save as draft**, or **Rewrite**)                                                                                                                                                                                            |
| `!ideas` / `!ideas on`, `off`, `time 8am`                        | Four topic ideas now / a daily offer of ideas at that time                                                                                                                                                                                                                                                                     |
| `!topics AI, productivity`                                       | Set the topics used for ideas                                                                                                                                                                                                                                                                                                  |
| `!pause` / `!resume`                                             | Make the bot quiet (it ignores everything except `!resume`, `!stop`, `!restart`; reminders wait) / active again. The pause survives restarts. Only `!pause` needs your own chat                                                                                                                                                |
| `!remind 6pm buy milk`                                           | Reminds you (`18:00`, `6:30pm`, `in 10m`, `tomorrow 7am`)                                                                                                                                                                                                                                                                      |
| `!reminders` / `!cancel 1`                                       | List / cancel pending reminders and scheduled messages                                                                                                                                                                                                                                                                         |
| `!contact add wife 923001234567`                                 | Save a name for a number (country code, no `+`)                                                                                                                                                                                                                                                                                |
| `!contacts`                                                      | List saved names                                                                                                                                                                                                                                                                                                               |
| `!news`                                                          | Links to stock sites, world news and AI news (edit the `NEWS` list in `bot.js` to change sources)                                                                                                                                                                                                                              |
| `!city Karachi`                                                  | Set your city (used for weather, prayer times and the morning brief)                                                                                                                                                                                                                                                           |
| `!weather` / `!prayer`                                           | Weather and prayer times for your city. `!prayer hanafi` or `!prayer standard` sets the Asr method                                                                                                                                                                                                                             |
| `!headlines world`, `ai` or `business`                           | Top 5 headlines with links                                                                                                                                                                                                                                                                                                     |
| `!brief on`, `off`, `now` or `time 7:30am`                       | Daily morning brief: weather, today's reminders, yesterday's spending, top headlines                                                                                                                                                                                                                                           |
| `!group add family Our Family Group`                             | Save a WhatsApp group you are in (by its name) so you can schedule messages to it                                                                                                                                                                                                                                              |
| `!groups`                                                        | List saved groups                                                                                                                                                                                                                                                                                                              |
| `!template add Good night` / `!templates` / `!template remove 2` | Manage the quick messages offered by the menu                                                                                                                                                                                                                                                                                  |
| `!schedule 7am wife Good morning`                                | Sends that message to a saved contact at that time                                                                                                                                                                                                                                                                             |
| `!spent 12 lunch` / `!today`                                     | Log an expense / show today's total                                                                                                                                                                                                                                                                                            |

Reminder times use UTC+5 by default. Change it with `TZ_OFFSET_MIN` (minutes from UTC).

## Setup on Windows

1. Install **Node.js** (LTS) from nodejs.org and **Git** from git-scm.com.
2. Open PowerShell and run:

    ```powershell
    git clone https://github.com/Bilalkhanten/web.js
    cd web.js
    git checkout claude/dreamy-gates-ef492d
    npm install
    cd bot
    npm install
    node bot.js
    ```

    `npm install` in the repo root downloads the Chromium that the bot uses, so you do
    not need Chrome or Opera.

3. A QR code appears in the terminal. On your phone: WhatsApp → **Linked devices** →
   **Link a device**, then scan it. Wait for `READY`.
4. Send `!ping` to yourself. The bot replies `pong`.

The login is saved in `bot/data/`, so you only scan once.

## Start automatically when you log in (Windows)

Register a scheduled task that runs the bot **hidden** (closing a visible window stops
the bot). In PowerShell, from the repo folder:

```powershell
$vbs = "$PWD\bot\start-hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory "$PWD\bot"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName "WhatsAppBot" -Action $action -Trigger $trigger -Settings $settings
Start-ScheduledTask -TaskName "WhatsAppBot"
```

- `start-bot.bat` restarts the bot if it crashes and logs to `bot\data\bot.log`.
- To **stop** the bot, send `!stop` in WhatsApp, or run `bot\stop-bot.bat`. To **start** it, double-click `bot\start-now.bat` (or `Start-ScheduledTask -TaskName "WhatsAppBot"`). To remove the task:
  `Unregister-ScheduledTask -TaskName "WhatsAppBot" -Confirm:$false`.

## Notes

- The bot only works while the laptop is on, awake and online. Keep it from sleeping
  (Settings → System → Power → Sleep: Never while plugged in).
- If the bot was offline when a scheduled message was due, and it is more than 15
  minutes late, it is **not** sent. The bot tells you instead.
- Mac/Linux: run `node bot.js` (or use `pm2 start bot.js --name wa-bot && pm2 save && pm2 startup`).
- Extra options: `HEADLESS=false` shows the browser window, `BOT_CHROME_PATH` points at a
  specific Chrome/Chromium, `BOT_DATA_DIR` moves the data folder.
- This is an unofficial client. Keep message volume low and use it for personal use.

Weather uses Open-Meteo, prayer times use Aladhan, headlines come from public BBC, Al Jazeera,
MIT Technology Review and Ars Technica RSS feeds. None needs an account or key.

## Articles (dev.to)

The **✍️ Articles** menu option suggests topics, writes a draft with Claude, and publishes to dev.to.
**Nothing is published unless you tap Publish**; "Save as draft" puts it on dev.to unpublished.

1. Get a **Claude API key** (console.anthropic.com → API keys). Each draft costs a few cents.
2. Get a **dev.to API key** (dev.to/settings/extensions → "DEV Community API Keys").
3. Copy `bot\.env.example` to `bot\.env` and paste the keys in. `.env` is git-ignored; never share it.
4. Install the new dependency and restart: `cd bot`, `npm install`, then `!restart` (or `stop-bot.bat` + `start-now.bat`).
5. Send `!topics AI, productivity`, then `!menu` → **✍️ Articles**.

Every article gets an AI-assistance disclosure line (change the wording with `ARTICLE_DISCLOSURE`).
At most 2 articles can be published live per day. Drafts are kept in `bot\data\drafts`.
Review each draft carefully: you are responsible for what is published under your name, and AI
text can contain mistakes. Medium has no usable API, so publish here and import to Medium by hand if you wish.
