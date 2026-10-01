# daily-articles

A standalone publisher (not connected to the WhatsApp bot, and it shares no code with it). Once a day it writes
**one article** on **AI, Python, Cloud or Machine Learning** with Claude, has a second Claude pass **review it as a
fact-checking editor**, and publishes it to **dev.to**. It needs no input from you while it runs.

## What one run does

1. Skips if you already published an article today (so running twice never double-posts).
2. Picks the area of the day (rotates AI → Python → Cloud → Machine Learning).
3. **Gathers fresh material** for that area so the article can cover what is current: recent library releases
   (GitHub release feeds, PyPI), cloud announcements (AWS What's New, Google Cloud release notes) and the hottest new
   developer questions (Stack Overflow). Public sources, no accounts. A source that fails is skipped.
4. Claude writes **one practical problem-solving article**: a configuration guide, a programming technique, or the diagnosis
   and fix of a specific error, grounded in that material. Near-duplicate topics are rejected.
5. **Automatic quality checks** (below), with one automatic repair if something is wrong.
6. A second Claude pass **reviews it as a fact-checking editor against the same sources**: approve, revise (the corrected
   text is re-checked once) or reject.
7. Publishes according to `PUBLISH_MODE`. In `live` mode an article goes public **only if the quality checks and the
   review both pass**; otherwise it is saved as a draft for you.

## Formatting and quality checks

Every article must pass these before it can go live:

- Sections in a fixed order: TL;DR, The problem, Environment, Solution (numbered steps), Why this works, Common pitfalls,
  Summary, Sources. No H1 in the body, 700-1800 words.
- Every code block is fenced and names its language; code fences are balanced.
- **Links only from the sources it was given** (anything else is blocked, which also stops text injected into a source from
  planting links), and at least one source must be cited.
- No risky commands (download-and-run scripts, `chmod 777`, recursive deletes, disabling TLS verification).

## Safety settings (please read)

| `PUBLISH_MODE`    | What happens                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `draft` (default) | Saves an **unpublished draft** on dev.to every day. Nothing becomes public. |
| `live`            | Publishes only if the review **approved**; otherwise saves a draft.         |
| `dry`             | Prints the article, publishes nothing, needs no dev.to key.                 |

- **Start in `draft` mode** for the first week or two and read the drafts at dev.to/dashboard. When you trust the
  quality, switch on unattended publishing by setting `PUBLISH_MODE=live` (in `.env`, or the `PUBLISH_MODE` variable in
  GitHub). Nothing else needs to change.
- **Every article ends with an AI-assistance disclosure line.** You can change its wording (`ARTICLE_DISCLOSURE`) but it
  cannot be turned off. dev.to's rules expect AI-assisted posts to be disclosed and to add real value; low-effort or
  spammy automated posting can get an account restricted.
- **One article per day, at most.**
- AI can still be wrong, and an unattended publisher puts your name on whatever passes the automatic review. Check
  your dev.to dashboard now and then, and use the kill switch below if quality slips.
- **Kill switch:** set `PUBLISH_MODE=draft` (or disable the scheduled task / workflow).
- A failed run (missing key, API error) exits with an error so schedulers report it.

## Setup

1. **Claude API key:** console.anthropic.com → API keys. Expect roughly 10-30 cents per article (two or three model
   calls); that is an estimate, so check your usage.
2. **dev.to API key:** dev.to/settings/extensions → "DEV Community API Keys".
3. Install: `cd daily-articles`, `npm install` (Node 18+).
4. Copy `.env.example` to `.env`, fill in the two keys (never share them or commit `.env`), keep `PUBLISH_MODE=draft`.
5. Try it: `node publish.js` (or `PUBLISH_MODE=dry` first to just read an article). Tests: `npm test`.

## Running it every day

**Option A - GitHub Actions (cloud, laptop can be off).** Make a **new repository** whose root is the contents of this folder (it stays fully separate from everything else),
copy `github-workflow.yml` to `.github/workflows/daily-article.yml` in it, and add the two secrets and the
`PUBLISH_MODE` variable (instructions are at the top of that file). Scheduled workflows run only from a
repository's default branch.

**Option B - Windows Task Scheduler (laptop must be on at some point that day).** In PowerShell:

```powershell
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "publish.js" -WorkingDirectory "C:\Users\DELL\web.js\daily-articles"
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "DailyArticle" -Action $action -Trigger $trigger -Settings $settings
```

`-StartWhenAvailable` runs a missed job when the laptop is next on; the "already published today" check prevents a
double post. Logs of each run are appended to `published-log.jsonl`.

## Options

`AREAS` (comma list, default `AI,Python,Cloud,Machine Learning`; the sources are defined in `lib/sources.js`), `ARTICLE_MODEL` (default `claude-opus-5-5`),
`ARTICLE_DISCLOSURE`. Keys can also be real environment variables instead of `.env`.

## Notes on "latest"

The article is only as current as the sources it was handed that day, and it may only state recent facts that appear in
them. If no source can be fetched, it writes an evergreen troubleshooting article and does not claim anything is new.
Stack Overflow's free API allows about 300 requests per day per address, which is plenty for one run.
