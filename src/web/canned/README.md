# The canned preview's data

The preview substitutes recordings and explicitly invented account data for a platform. Neither is a live account.

## Recorded — real pi, deterministic local provider

| File | What it is |
|---|---|
| `stream.jsonl` | Frames emitted by the real `BoxSteward` and pi 0.87.1 over five prompts, including initial life/model/thinking records, system-state counts without the prompt/tool snapshot, tools, cancellation, provider failure and context edits. Scene and abort lines are the capture's markers; timestamps are measured offsets. |
| `models.json` | pi's answers to `get_state` and `get_available_models` through the steward before the first prompt: Google `gemini-3.6-flash`, thinking `low`. |
| `files/` | The seeded `sales.csv` and the report pi's real tool execution produced. The paths the recording prints name these files; pi's session directory is not among them. |
| `stops/stream.jsonl` | One session from `scripts/stop-capture.mjs`, a scene per shape: the frames the real steward and pi 0.87.1 send a page for a Stop mid-text, mid-bash, mid-read (a read of a named pipe with no writer), with two steps running, and before the first byte; a message sent while cx writes; and two whole turns (thinking then text; text then a step) that tests cut to play a reconnect; then a message sent while cx works and the page's Stop, mid-text and mid-step, with the page's send again; then one sent mid-step then `abort` alone, which pi records and answers nothing after, as it does a message it took before a Stop held; and last a summary asked from cx's card after an answer, its provider answer held four seconds so the page's line is seen. A scripted loopback provider answers; pi runs every tool and writes every record. The tests replay each scene (`stops.test.ts`), and the preview plays them as `?recording=stops`. A call the run never reached cannot be produced this way — built-in calls of one message run at once — so its test takes the mid-bash file with the step's result removed. |

Re-recorded on 2026-09-24 with:

```sh
node scripts/web-capture.mjs <directory> gemini-3.6-flash --local-fixture
```

The pinned **pi 0.87.1** and real steward run in a temporary tenant root. `scripts/web-capture-fixture.ts` scripts Google-protocol responses on loopback, not a vendor model. **No vendor request or real credential is used.** `PI_OFFLINE=1` disables startup refresh and the temporary global settings disable cache warming. Copy the three outputs here together. `provenance.json` in the capture output identifies its local-fixture origin; this README is the checked-in provenance.

What the fixture arranges:

- The same five scenarios as the earlier recording: calculate and write a sales report, answer a Chinese prompt, examine a missing inventory file, cancel a long answer, and observe a failing provider. Text and tool selections are scripted, not evidence of a model's reasoning.
- Twelve real tool calls across the first and third scenes. The fixture deliberately asks `read` for absent `inventory.csv`; that tool fails. Bash computes the report from the CSV, and one command sleeps between output chunks to expose partial output.
- The fourth scene streams slowly; the capture sends `abort` 1.5 seconds after its first text delta. The cancelled assistant entry is pi's.
- The fifth scene returns a provider-shaped 503 “overloaded” response. Pi records four failed assistant entries and three context edits for its abandoned attempts. Those edits and system/usage metadata retain their entries/cursors but are not chat replies or raw JSON on the page: each edit is to null, so the page draws only the last failed attempt, the one pi kept. The steward removes the system preamble, sections and tool schemas before recording or streaming them; the system entry at seq 3 holds only the owned form and counts.
- The first scene starts before attach so its life and initial metadata are not discarded. The preview announces one stable canned epoch in the connection's microtask before Send is available and maps the captured life to it, so the first Send retains its pending echo and working state. No canonical entry is removed from the recording.
- The capture machine's temporary tenant path and OS owner become `/tenant` and `tenant`; the pi package's checkout path becomes the image path `/usr/local/lib/node_modules/@earendil-works/pi-coding-agent` if referenced in model/tool output. All stream bodies otherwise remain what the steward emitted; the system snapshot is removed in the translator, not by this capture's substitutions. A generic absolute-host-path check, with only the box's tenant/package roots allowed, rejects paths from differently named checkouts too. The provider base URL in `models.json` is the refusing/capture loopback address; the preview reads model provider/id/name, not that URL.
- The preview caps playback gaps at 1.2 seconds. Fixture streaming and pi's retry waits, not free-tier throttling, determine this recording's original offsets.

The former 0.84.2 live-Google stream and files remain in git history, not as new-version evidence. The original vendor mode of `web-capture.mjs` still requires `GEMINI_API_KEY`; it was not used for this recording. `src/web/stream-model.test.ts` replays the fixture and asserts current system metadata, tool results, partial output, cancellation, failures, working state, cursor preservation and live/resumed equivalence.

## Recorded — two messages waiting, a Stop and a second Stop

`waiting/stream.jsonl` is a session of its own, played at `?recording=waiting`. It was recorded on 2026-10-09 with:

```sh
PI_OFFLINE=1 node scripts/stop-capture.mjs <directory> gemini-3.6-flash waiting
```

**pi 1.1.0**, the pin when it was recorded, and the real steward run in a temporary tenant root, as for `stops/`, on the image's steering mode (`steeringMode` in `src/sandbox/image/pi-home/settings.json`, `all`); the scripted Google-protocol provider on loopback answers. **No vendor request and no credential are used.** Its frames are pi 1.1.0's, where `stops/` holds pi 0.87.1's. Two scenes:

- `stop-two-waiting`: while cx writes a long note the capture sends two messages (`prompt` with `streamingBehavior: "steer"`), then the page's Stop as `Visit.stop` makes it with two waiting: `clear_queue`, `abort`; once the stream says no turn runs, `steer` for the second message and `prompt` for the first. pi records both messages in the order sent and answers them in one run.
- `stop-two-waiting-twice`: the same, and the capture sends `abort` again 0.7 seconds into the answer of the run that reads both: the second Stop. pi records that answer as aborted.

The capture's own close is left out of this session, so it does not end on a computer going to sleep. The same path substitutions as `stops/` apply. The preview takes the nth message a person sends in a scene as the scene's nth recorded one, so each waiting bubble lands on its own record whichever goes first after the Stop; a third message has no record and keeps waiting. A scene played with no Stop pressed plays the capture's own.

## The message box's states, each at one address

A preview address names what it opens on (`preview-main.ts`). Beside `recording`, `lang`, `state`, `scene`, `at`, `models`, `keys`, `accounts`, `card` and `ask`:

- `draft=<words>` puts words in the message box; `draft=` leaves it empty. Either way the box is shown as the page draws it: the next recorded message stands in the box, and is sent from an empty one, only at an address that names neither `draft` nor `do`.
- `do=<step>,<step>,…` walks the page from where `scene` and `at` hold it, each step through the page's own controls, the next once the page shows the last: `say` sends the scene's next recorded message; `x:N` presses "Cancel and edit message" on the Nth waiting message; `now` presses "Send now"; `stop` presses Stop (over an empty box: words the address put there are set aside for the press and put back); `hold:<share>` plays on to that share of the scene's frames and pauses; `on` presses cx's computer and 开机 in its card; `up` scrolls the conversation to its top; `line` presses the line beside cx's desk. A package's questions (`ask`) are heard before the walk, so `line` can go to one.
- `asktime=<ms>` gives each question `ask=` draws that time, as a package would, so the fold when a wait runs out is one address; the platform's own five minutes for a question with none are not waited out in the preview. `do=pick:N` presses the first question's Nth option in the chat, `do=skip` its Skip, and `do=send:<words>` sends words of the address's own from the message box.
- `do=land` writes a file on the canned board, as cx would at a turn's end, and sends the board's frame: the column opens nothing by itself.
- `ask=<method>,<method>,…` draws what a package asks the person, at the end of the conversation the address opens on: `select`, `confirm`, `input`, `editor` and `notify`, each once per mention. `options`, `several` and `paged` draw an option card — one question, one that takes several answers, three on one card — as the page's option form carries them, and `propose`, `bare` and `long` a confirm card — the prototype's export, with what will happen, with nothing under the band, and with a long title and a path that does not break — as the confirm form carries them; each with pi's longest timeout, and a turn's end leaves it, as on a box. **The questions are invented** (`preview-main.ts`): no recording here holds a package's question, and the page hears each as the frame a box sends for one. An answer is taken as a box takes it and goes nowhere. A scene that plays on ends its turn and takes the open questions with it, as on a box, so the address holds them at `at=end`: `?recording=waiting&scene=1&at=end&ask=select,confirm,input,editor,notify`.
- `moved=<way>:<provider>,<way>:<provider>` draws a move off a used-up way at the end of the conversation the address opens on: the answer the first way ended, then the line naming it and the way that answers next, as `account:anthropic,platform:balance`. **Both are invented** (`preview-main.ts`): no recording holds a move, and the page hears each as the entry a box sends. A door the page cannot read draws nothing.
- `state=below_floor_unsold` is `below_floor` for an account the page sells no credit to (`features.checkout` off).

Each address below takes `&lang=en` or `&lang=zh`; the theme is the browser's or Settings' choice, not the address's.

| Address | What it shows |
|---|---|
| `?recording=waiting&scene=1&at=end&draft=` | cx at rest, the box empty: Send, off |
| `?recording=waiting&scene=1&at=end&draft=Compare+the+two+carriers` | cx at rest, words in the box: Send |
| `?recording=waiting&scene=1&at=0.3&draft=` | cx writing, the box empty: Stop |
| `?recording=waiting&scene=1&at=0.3&draft=Keep+it+short.` | cx writing, words in the box: Send |
| `?recording=waiting&scene=1&at=0.3&do=say` | one message waiting, over "Cancel and edit message" and "Send now" |
| `?recording=waiting&scene=1&at=0.3&do=say,say` | two messages waiting |
| `?recording=waiting&scene=1&at=0.3&draft=One+more+thing&do=say,say,x:1` | after "×" on the first of two: its words ahead of what the box held, the focus in the box, the other still waiting |
| `?recording=waiting&scene=1&at=0.3&do=say,say,now,hold:0.8` | after "Send now": the answer stopped, both messages read, the run that reads them under way |
| `?recording=waiting&scene=1&at=0.3&do=say,say,stop,hold:0.8` | after a first Stop with two waiting: the same, reached from the control |
| `?recording=waiting&scene=2&at=0.3&do=say,say,stop,stop` | after a second Stop: that run stopped too, cx at rest, Send, off |
| `?state=below_floor` | the box closed under the floor, a top-up on offer |
| `?state=below_floor_unsold` | the box closed under the floor, where the page sells no credit |
| `?state=box_pending` | the box closed while the computer is set up |
| `?state=below_floor&money=free-lapsed`, `?state=below_floor&money=free-failed` | the box closed under the floor after Pro expired, and after its renewal's charge failed |
| `?orgs=2`, `?orgs=2&in=org_preview_1`, `?orgs=16&in=org_preview_16` | a person in organisations (one to sixteen, the third with a long name), on their own account or on one of them: the corner's line and its accounts; a press switches by loading the address again in that account, and with `&own=road` a press on their own account opens `road.html?state=plans&orgs=…` |
| `?orgs=2&in=org_preview_1&seats=seats`, `cut_pending`, `cancelling`, `retrying` or `none`, with `&role=member` for a member | the organisation in use by what its seats are doing, as `/me` says it, its money following the state: 组织设置 at `#/organization`, and the chat's line with `&state=below_floor` |
| `&change=declined`, `failed` or `hold` | how the platform answers 管理席位's 确认并购买: the card declined; the raise taken and not settled, a 502 that the same count pressed again settles with no second charge; or no answer yet, so the wait stands still |

A second Stop plays only in scene 2: scene 1's recording holds none, so at a scene 1 address a second Stop or Escape is asked of the page and nothing answers it. To press both stops by hand, open `?recording=waiting&scene=2&at=0.3&do=say,say`; left alone after the first, that scene plays the capture's own second Stop about a second later.

### The line beside cx's desk

Each state of the signed prototype (`spikes/chat-status/README.md`), held where the line says it. 「等待你回答」 leads to the question's card in the chat, the one place a package's question is drawn, with the board installed or not (`spikes/chat-status/question-card/`, signed 2026-11-05):

| State | Address | The line |
|---|---|---|
| `ready` | `?recording=conversation&scene=1&at=end&draft=Check+returns` | none |
| `sent` | `?recording=conversation&scene=1&at=0.1&draft=` | Reading your message, words only |
| `thinking` | `?recording=conversation&scene=1&at=0.15&draft=` | Thinking |
| `tool` | `?recording=conversation&scene=1&at=0.48&draft=` | Running a command, the card's time |
| `result` | `?recording=conversation&scene=1&at=0.5&draft=` | Reading the result |
| `next` | `?scene=3&at=0.12&draft=` | Reading inventory.csv |
| `failed` | `?scene=3&at=0.14&draft=` | Reading the result, leading to the failed card |
| `several` | `?recording=stops&scene=4&at=0.5&draft=` | Running a command: the first of two begun at once |
| `results` | `?recording=stops&scene=4&at=0.9&draft=` | Reading the results |
| `answering` | `?recording=conversation&scene=1&at=0.8&draft=` | Answering |
| `tidying` | `?recording=stops&scene=14&at=0.8&draft=` | Summarising the chat, words only |
| `asking` | `?recording=conversation&scene=1&at=0.48&draft=&ask=select&do=line` | the choice's card in the chat, the focus on its first option, marked |
| `asking` yes/no | `?recording=conversation&scene=1&at=0.48&draft=&ask=price&do=line` | the yes/no card in the chat, the focus on the card itself, marked |
| `chat-ask` | `?board=none&recording=conversation&scene=1&at=0.48&draft=&ask=select` | Waiting for your answer ›, the question's card at the end of the live turn (`spikes/chat-status/question-card/`, signed 2026-11-05) |
| `chat-typing` | `?board=none&recording=conversation&scene=1&at=0.48&draft=Check+the+UK+store&ask=select` | the same, words in the message box; the control is Send |
| `chat-answered` | `?board=none&recording=conversation&scene=1&at=0.48&draft=&ask=select&do=pick:1` | the card folded where it stood to its title and Amazon US; the next step's own words |
| `chat-message` | `?board=none&recording=waiting&scene=1&at=0.3&draft=&ask=select&do=say` | the card folded to Not answered, the message under it, read once the step ends |
| `chat-stopped` | `?board=none&recording=stops&scene=2&at=0.5&draft=&ask=select&do=stop` | none: the card folded to Not answered, the step stopped, the turn over |
| `chat-timeout` | `?board=none&recording=conversation&scene=1&at=0.48&draft=&ask=select&asktime=500` | the card folded to Not answered when the wait ran out — here the half-second `asktime`, a package's own time, gives it; with no time it folds once the platform says the box took its own answer at five minutes — and cx goes on |
| `board-base` | `?board=afternoon-files&recording=conversation&scene=1&at=end&column=open` | the board's base: 待办's two files as cards, each its time, title and words, the rival's a file with no front matter, its heading its title |
| `board-asking` | `?board=afternoon&recording=conversation&scene=1&at=0.48&draft=&ask=select&column=open` | a package's question waiting in the chat while the column is open; the board holds none of it |
| `board-landed` | `?board=afternoon-files&recording=conversation&scene=1&at=end&draft=&do=land` | a file lands at a turn's end: the column opens nothing, and the icon carries no number |
| `starting` | `?state=asleep&do=say` | Switching on, words only, cx's bubble quiet; on a page opened mid-start the time counts from the page's first sight of it or the earliest message waiting (ruled 2026-11-03, as built) |
| `starting-alone` | `?state=asleep&do=on` | the same, from 开机 in the computer's window |
| `typing` | `?recording=conversation&scene=1&at=0.48&draft=And+the+strap%3F` | as `tool`; the control is Send |
| `steer` | `?recording=waiting&scene=1&at=0.3&do=say` | Answering (this recording writes, it runs no command), a message waiting in its quiet bubble, with no line of its own above the composer |
| `low` | `?money=member-low&recording=conversation&scene=1&at=0.48&draft=` | as `tool`, under "Balance under $1.00 See balance" |
| `stopped` | `?recording=stops&scene=2&at=end` | none; the card stopped |
| `scrolled` | `?recording=conversation&scene=1&at=0.48&do=up` | as `tool`, read from higher up |
| `revealed` | `?recording=conversation&scene=1&at=0.48&do=up,line` | as `tool`; the card marked for 1.6 s, the focus on it |
| `ended` | `?recording=conversation&scene=1&at=end&draft=` | none |

## Recorded — one seller's conversation

`conversation/stream.jsonl` and `conversation/files/` are a second recording, which the preview plays in place of the first at `?recording=conversation`: one conversation holding everything the stream draws. It was recorded on 2026-09-28 the same way — the pinned **pi 0.87.1** and the real steward in a temporary tenant root, pi offline, a deterministic Google-protocol fixture on loopback, **no vendor request and no credential** — by a scratch variant of the local-fixture mode that is not in `scripts/`. What differs:

- Four prompts: a price check, a notes edit with a month's orders counted, a price-match reply that asks for a missing file, and, after the capture sends pi `compact`, a summary in Chinese. Each fixture reply is a run of thought summaries and then one function call or the answer; pi executes every call and writes every record.
- pi's `grep`, `find` and `ls` are turned on in the temporary settings, which the box leaves off, so that the conversation holds each tool's drawing; `rg` and `fd` come from the capture machine. The same settings set `keepRecentTokens` to 465, and the compaction's summary is the fixture's answer to pi's summary request.
- `cx` is a stand-in on the tenant's `PATH`: it waits 1.2 seconds, lands an invented Keepa observation and prints the receipt `src/cx/receipt.ts` renders for it. The observation, listings, notes and orders are invented.
- The same path substitutions as above; no path of the capture machine remains, which `src/web/chat-model.test.ts` checks while it replays the recording through the page's drawing.

## Recorded before this page — the earlier steward's stream

`pre-upgrade/stream.jsonl` is the recording the earlier steward made with pi 0.84.2 against a live provider, kept from the tree as it stood before the pi 0.87.1 upgrade; `pre-upgrade/items.json` is what that tree's own page reducer rendered for it (its `reduce` over the same events, serialised). The platform deploys before every box carries the rebuilt image, so for a while a running box's steward keeps sending pi's own `type: "text"` blocks in partial tool output and its stored entries keep their earlier forms; `src/web/stream-model.test.ts` replays this recording and holds the page to the same items. Regenerate `items.json` only from the pre-upgrade reducer: `git show <pre-upgrade commit>:src/web/stream-model.ts` run over the recording's frames through `toEvent`.

## The road, from the terms to the chat page

`road.html?state=<state>&lang=zh|en` is the start page over invented account data (`src/web/road-preview.ts`): it opens where the state names and presses the road's own controls to the state's press. A press that fails answers after half a second, so its wait is seen; the payment provider's fields are the placeholder the rest of the preview draws. 跳过 and 开始使用 go on to `index.html?state=box_pending`.

`road.html?state=plans&orgs=2` is the plans page of a person in organisations on their own account, which has no computer: its head holds the way back, and a press on an organisation opens the chat preview in it.

`road.html?state=from-billing`, `from-billing-trial` and `from-billing-lapsed` are the plans page as 调整方案 in a person's 账单 opens it, for one who holds Pro, one on a trial and one whose Pro ended; its `← 账单` and its 订阅 go to the chat preview's 账单. 账单's 调整方案 in the chat preview opens the one its `?money=` names.

| State | What it opens on |
|---|---|
| `terms`, `terms-fail` | the terms; 创建账户 pressed and refused |
| `plans`, `plans-ended` | the plans on a trial; after a trial, with 跳过 |
| `plans-invited`, `plans-invited-used` | the plans from a member's link: the $5.00 coupon, and $1.00 after the three coupons, each naming the inviter as masked |
| `card`, `card-once-alipay` | 订阅's card: 连续包月 by card; 单月 by Alipay |
| `card-wait`, `card-declined`, `card-unread` | 支付 pressed and waiting; the card declined; the provider's form unread |
| `unpaid` | back unpaid from 单月 by Alipay |
| `name`, `name-fail`, `name-paid` | the name for a member, whose 继续 opens the questions; 继续 refused; the name after 订阅's card was paid, with what was paid at its head |
| `ask`, `ask-some`, `ask-back` | the first question, cx waving; three chosen; come back to by 返回 from the second, cx standing |
| `ask-next`, `ask-next-some` | the second question, cx studying; two chosen and a line typed |
| `ask-wait`, `ask-failed` | 开始使用 pressed and waiting; refused, every choice kept |
| `open-unread`, `open-back` | the account's read not coming back: 无法连接, read again every ten seconds; failing once, then the plans |
| `return-wait`, `return-unread`, `return-back` | back from 单月 by Alipay: its answer still read; its read not coming back; failing once, then the name with what was paid |

## Placeholders — invented account data

`settings.json` invents balances, conversion, credits, spending and provider rates for the preview. Source names, suppliers, native units/conversions and per-request costs come from `src/source-packages/*/manifest.json`; the installed packages are main's own publishes to npm — `@comchatx/cx-assistant`, `@comchatx/cx-topics`, `@comchatx/cx-board`, `cx-sources`, `cx-keepa`, `cx-amazon-sp-api` and `@comchatx/cx-amazon-ads` (`PINNED_PACKAGES`, `src/source-packages/published.ts`) — and the one of ComChatX's in a public repository, `cx-amazon-seller`, as an account that installed them all holds them, with the two third parties cx Core Bundle lists in their authors' words, `pi-web-access` at the version npm's list states and `billion-context` at the version whose READMEs `shipped` holds; a new account installs nothing until cx Core Bundle is pressed (`DEFAULT_PACKAGES`). Provider IDs come from the model proxy table. None of the preview's account operations reaches a platform or persists outside the tab.

`catalogue.json` holds the Plugins prototype's example records (Amazon analysis, Charts, Review Lens, Web reader and the rest, and the three bundles Amazon seller, Listing studio and Amazon ads; Amazon seller names the banner's drawing, `art`, which the page holds in `src/web/plugin-marks.ts` and Discover's banner draws; each one's line opens 「占位示例：」, "Placeholder: " in English, as the example Pi packages' do, so a reader of the preview tells an example from what a seller gets), read over the catalogue the preview draws, `CATALOGUE` in `src/web/canned-catalogue.ts`: the repository's (`src/web/catalogue.ts`, which keeps no record of a package of ours) with ours as `ours.json` holds them; `plugins-world.json` is what the example person holds of them — model plugins, switches, a month by day and media models — and what a model vendor's page needs that no record states: each vendor's chat series with their versions and prices (`series`), the series each held vendor has in chat (`seriesInChat`), the day each example record was last updated (`updated`), the version each states (`versions`, the prototype's, which a record's header says while nobody holds the plugin and which its package is listed at once installed, so installing changes no version), and the moment the example world stands on (`today`, noon of 2026-09-28 as a wall-clock minute read in the browser's own zone, as the purchases are, and after the newest of them: "updated … ago" counts from it; in a zone more than twelve hours ahead of UTC that noon is still the day before in UTC, and "updated … ago" counts one day more; the sources' month in both files begins 2026-09-01, the month that day is in). An example record's Try it is its templates, `box.prompts`, as a package's are, and Amazon seller's Overview ends on the one example of its own, a list in its markdown: a record's Overview is its `description`, one markdown text, with its Why use it as the next paragraph. `catalogue.json` also holds GPT's, Claude's and Kimi's records over the repository's, alike but for the card's line, which there names the subscription the example world offers; Keepa's record is drawn from `ours.json`, whose own-key sentence the page draws where the example world's Keepa takes a key. A way stored for a held vendor comes with the saved key or the sign-in it needs, so no stored way is unconnected; `plugins_day_one` and `plugins_first_release` play the repository's catalogue alone, with the official bundles the code holds (`src/shared/bundles.ts`) and no other, so they list no series, date and version no record, and come with no saved key and no sign-in. Where series are listed a vendor's Models tab draws them with their ticks, versions and pins, a media model turns on behind its card, a new series is said under the vendor's header and its Yours row, and a vendor the example person does not hold (Grok, GLM, MiniMax) is offered on Discover with its page; in `plugins_first_release` the tab is the list of the models the box serves. A vendor's Settings there draws the balance's Use and Stop, the subscription's sign-in, the order of use and the free-plan line, and a vendor not held keeps its Settings tab with its Install; in `plugins_first_release` Settings is the balance's state and the key's field alone. A vendor's Usage there is its month: in money by day and by model where the balance paid (GPT, Claude, Gemini), with what the person's own subscription carried beside it; in tokens where only the person's own key did (DeepSeek); one line on a vendor with nothing used (Kimi) or not installed (Grok); `plugins_first_release` draws no Usage tab on a vendor. "Choose vendors for chat" opens `#/plugins/models` in both. Every figure there is a placeholder in the live scale (a unit is a millionth of a dollar, as `/me` answers); the live backend reads neither file.

`ours.json` holds ours as the platform's `GET /plugins/ours` answers them (`docs/parts/bundles-and-gallery.md` §3 item 7): the seven of ours the root pins from npm (`src/source-packages/published.ts`), at those versions, with their `comchatx` field and README, what each ships as the platform reads it (`shipped`: its READMEs, its `SKILL.md` skills and its templates) and the plugins among its `dependencies` (`uses`) (`catalogue.test.ts` holds each to its pinned copy), and the other five as their repositories would publish them, each with a September date so the example world's "updated … ago" counts from before its `today`. It also holds `@comchatx/providers` as npm holds it: the providers' shared core, whose manifest carries no `pi` object, so it comes with `library` and the page draws no card for it, as on the live page.

`plugins-world.json` names the order the example world's records stand in (`order`): the signed prototype's, Jev and its makers as the catalogue stands them, Jev first and the makers in OpenRouter's ranking (2026-11-03), bundles and plugins by id, with the repository's own records after them in the catalogue's order; the two states that play the repository's catalogue alone keep its order. Both example sources take an own key, none held. An upload is listed as a package the person installed themselves, on, named from its file (the name without `.tgz`, `.tar.gz` or `.zip` and without the version `npm pack` writes before it, so `mine-1.0.0.tgz` is `mine`) or, with no file, from its link (an npm name whole, with or without `npm:`, else the link's repository or last part without its version or the branch a page of it names), so one package is one name whichever way it arrives; nothing is read from it, so it states no version and says nothing of itself, and a name already listed changes nothing. The prototype draws none of this: its press only says that checking and installing are not drawn. An upload with neither a file nor a link is refused, and `plugins_install_fails` refuses every upload. Upload's row in Create's menu is greyed, so nothing on the page calls it.

`plugins-world.json` also holds four invented packages the example person installed themselves, which no record of the catalogue names (`ownPackages`): one that ships a README (`readmes`), one that ships none, one that states a name and nothing else, and one whose README is too large to carry (`largeReadmes`). A package whose source lies under `/opt/comchatx/packages/` stands for the row an account made before 2026-10-20 holds of a default the image then carried: removed, the list still carries it, and it installs again as it was.

A card of the Plugins pages is in the address, so any state can be opened with a card over it, for a look or a screenshot: `?state=normal#/plugins/p/keepa?card=remove:p:keepa`. A state that does not serve the card draws the page without it and takes it out of the address, as every state does for Upload's card, whose row is greyed.

The Plugins page's one card, as round 29 and its corrections signed it, is walked at these addresses (the prototype's state names on the left):

| State | Address |
|---|---|
| `discover` | `?state=normal#/plugins/discover/all/downloads` |
| `keepa-key`, `keepa-key-empty`, `keepa-key-saved` | `?state=plugins_first_release#/plugins/p/keepa/settings`: who pays, the balance's row and the key's field; Save with the field empty says to paste a key first; Save with a key holds it, saying it is saved, with Remove key |
| `discover-kind` | `?state=normal#/plugins/discover/skill/recent` |
| `contributor-card`, `contributor-page` | `?state=normal#/plugins/discover/all`, Extensions under ComChatX plugins; `#/plugins/n/%40example%2Fcx-sample` |
| `pi-section`, `pi-recent` | `?state=normal#/plugins/discover/all/downloads`, `…/all/recent`, Pi plugins under the bar |
| `card-norepo` | `?state=normal#/plugins/discover/all`, searched for "ollama" after Show more |
| `shelf-extensions`, `shelf-models` | `?state=normal#/plugins/discover/shelf/extensions/downloads`, `…/shelf/models/downloads` |
| `discover-models` | `?state=normal#/plugins/discover/all`, the Models shelf; GPT, Claude, Gemini, DeepSeek, Kimi and GLM carry their maker package's facts and links (`makers.json`) |
| `ours-page`, `pi-page` | `?state=normal#/plugins/p/<id>`, `#/plugins/n/pi-web-access` |
| `updates`, `update-asleep`, `update-failed` | `?state=plugins_updates#/plugins/yours/all`, `plugins_updates_asleep`, `plugins_updates_fail` |
| `npm-unreachable` | `?state=npm_unreachable#/plugins/discover/all` |
| `ours-unread` | `?state=ours_unread#/plugins/yours/all`, `#/plugins/discover/all`: the platform's read of ours failed, and cx's computer lists `@comchatx/cx-topics`, `@comchatx/cx-subagents` and `cx-keepa` from npm |

A click on a package is answered with its entry and ended on the list, and the page state plays how: `click_image`, `click_npm` and `click_bound` take the times measured on a real box (about a second, 14 s, and the 240 s bound, which answers `timed_out`); `click_pi_failed` and `click_timed_out` end with that reason after a second, whatever was clicked; `click_single_file` and `click_not_listed` refuse what cx's computer refuses so and nothing else — `single_file` a turning off alone, `not_listed` a turning on or off — and end every other click as `click_image` does; `click_box_unreachable`, `click_waiting_full` and `click_sources_unavailable` are refused at the click, the full row after the source the package sells is switched, as the platform asks its gate before its row; `click_midway` installs the first package asked and fails every later one, so of an install of several the first goes in and each later one stands failed in the queue (the Amazon ads bundle shows it). In `click_not_listed` the canned box lists the switched package no longer once it has answered, as a real box's list would. `plugins_first_release` draws the page from `FIRST_RELEASE`, the switches its first live release will use, over the day-one catalogue, the packages a new box lists and the person's own four. The `spapi_*` states draw the same, each with the Amazon SP-API source in `settings.json` as its Settings is to be seen: `spapi_empty` with nothing saved; `spapi_filled` with its client pair saved and no store, so the pair is still asked for, as it is until a store passes; `spapi_connected` with one store (`exampleus`, North America) and `spapi_two` with a second (`exampleuk`, Europe); `spapi_refused`, where Amazon refuses every store checked in its own words (`CANNED_AMAZON_REFUSAL`); `spapi_key_required`, where the gate finds a saved field missing and the page says its refusal line alone; and `spapi_checking`, where the check never answers, so "Checking with Amazon…" stays. The `ads_*` states open Amazon Ads' Settings where no press reaches, each held under one Client identifier (`CANNED_ADS_CLIENT`): `ads_conditions` with a row whose ad accounts Amazon listed, one whose Far East host did not answer, one Amazon refused later and one it listed none for; `ads_two_dead` with two refused rows under a listed one; `ads_none` with nothing saved, where Amazon's check of what is connected finds no ad account; and `ads_failing` with one listed row, where the platform fails every connect and every removal, so the page says it was not saved. The `s3_*` states draw the same with cx-s3-storage installed, its record read from `s3-storage.json` (the box half's `package.json`, READMEs and skill as that repository holds them, drawn in these states alone, since npm holds no release of it) and its source listed as the gate lists it, six fields, two of them secret, no price, checked by its own fields: `s3_empty` with nothing saved; `s3_saved` with every field saved and the source on; `s3_refused`, where the bucket refuses every check in its own words (`CANNED_BUCKET_REFUSAL`). In each, a value that starts `http://` is refused as the gate's address rule refuses it, in its words naming the field alone, and the fields saved before it stay saved; the check takes `CANNED_VERIFY_MS` and turns the source on, a save naming no field checks what is saved, and Remove clears every field and turns it off. The `cxfeishu_*` states draw the same with cx-feishu installed, as its Settings is to be seen: `cxfeishu_none` with no bot saved and `cxfeishu_saved` with one (`CANNED_FEISHU_HOOK`); a save takes only a Feishu bot's address and is refused `malformed` otherwise, as the platform refuses it, and what is saved is kept until the page state is changed. In every other state the check takes a moment (`CANNED_VERIFY_MS`) and accepts. In every state the canned backend keeps what is saved at the source until the page state is changed, and turns the source on once a store works and off once none is left, as the gate does. Its Models shelf holds a card for each vendor the box's own catalogue lists. The preview's box is running in every state but `asleep` and `refused`: there a click is answered with its entry and kept, an install or an update stands in the queue as a waiting row, with the clock where its ✓ would stand and no toast but 「已加入队列。」, while a removal is drawn gone and a switch turned at once; each is ended when the box opens. The canned computer never answers a 取消 `started`: a waiting click leaves at once, so the preview never draws a row that 取消 could not take back. `plugins_updates` draws `plugins_first_release` with Keepa a release behind the version ours give, so three plugins have a new version, and each update takes npm's time (`CLICK_NPM_MS`) before the package is listed at the newest; `plugins_updates_asleep` is the same on a sleeping box, which keeps the updates for its next opening; `plugins_updates_fail` is the same with npm out of reach, so each update fails after npm's time, `pi_failed`, in npm's own words.

`npm.json` is pi's gallery as the platform serves it from npm (`GET /plugins/npm`, `GET /plugins/npm/<name>`): 209 packages from one read of npm's list, each dated to the instant npm published the version it names (read from npm's registry on 2026-11-05 for the signed prototype), so a card says the minutes and the hours within a day, with their kinds, and one invented package made for ComChatX by someone else, `@example/cx-sample`, marked `comchatx` as its search entry's keyword would mark it, which the preview serves to ComChatX's section alone (`section=comchatx`), the list's `total` and `read_at`, and READMEs for five of them (`readmes`), `pi-web-access`'s cut as npm cuts a long one (`cut`) and `@bacnh85/pi-cron`'s given one sentence npm's copy lacks, a link to `pi-subagents`' npm page, so a reader of the preview walks from that package's Overview (`#/plugins/n/@bacnh85%2Fpi-cron`, under the `package` state) to `pi-subagents`' page here, and the two READMEs `billion-context` ships at 0.1.212 (`shipped`, 73,434 and 65,726 bytes), which its page draws whole as the platform reads them from the CDN. The canned backend pages, filters and sorts it as the platform does; `npm_unreachable` refuses every read of it, as the platform does when npm has not answered and nothing is kept.

`makers.json` is invented: six model makers' packages (`@comchatx/openai`, `anthropic`, `google`, `deepseek`, `moonshotai`, `zai`) as the platform's organization answer would give them, so the preview's maker cards draw a package's facts and links. Their dates, versions and repository are made up for the preview, not read from npm, and no test pins them to a published package; they give no downloads figure, so the Models shelf keeps the order the catalogue stands it in. Each of the six carries its card's words in its `comchatx` field (`card`, `mark`, `aliases`, `plans`), and `@comchatx/openai` the steps of its sign-in card as its package declares them (`signIn`), so ChatGPT's card in the preview is drawn from that declaration (`?signin=open#/plugins/p/openai/settings`, Sign out, then Sign in to ChatGPT), and `fields` holds the same field of every other provider package that carries one, and typesafe's, so the preview draws every maker card's words as the live page does once those packages are published (`src/shared/maker-words.ts`).

The account list (`settings.json`) holds the five subscriptions the platform signs in to, as `FLOWS` in `src/platform/provider-login.ts` names them: OpenAI (ChatGPT), Anthropic (Claude), Kimi For Coding, Meta (Muse) and xAI (Grok/X). All begin signed out.

`catalog.json` is generated from the pinned pi-ai catalog: IDs and names only, OpenRouter's whole chat list (its 396 Messages and Completions models at pi 1.3.0), Radius's pinned public models and Meta's catalog included. It describes what each preview provider/account would serve without asking a provider. `src/web/canned-backend.test.ts` holds every entry to that catalog and verifies every listed account/provider has a catalog.

`models_openrouter` plays the example world with OpenRouter installed and its API key saved, which put it in chat fourth, after three of the example world's vendors, with the first five series its list has; `models_openrouter_full` is the same with the example world's five vendors in chat, so OpenRouter found no place. In every state of the example world OpenRouter's series are its whole list grouped by maker, with no price, since OpenRouter bills the person.

Source/package descriptions and provider display names are preview copy; no manifest supplies those descriptions. Money/rates here are never a billing ruling or a live ledger answer.

## Recorded — one seller's month, for History

`history/stream.jsonl` (English) and `history-zh/stream.jsonl` (Chinese) are the conversation the sidebar's History is walked on, played at `?recording=history` and `?recording=history-zh`. Each was recorded on 2026-10-21 with:

```sh
node scripts/history-capture.mjs <directory> en   # or zh
```

The pinned **pi 1.3.0** and the real steward run in a temporary tenant root, with the image's `cx-topics` package built as the image builds it and named in the tenant's own list, as a seller who installed it holds it. A scripted OpenAI-protocol fixture on loopback answers cx, Jev and the platform's default model, behind the image's own `typesafe` and `balance` entries with only the port changed. **No vendor request and no credential are used.** What the script arranges:

- **The words are the signed prototype's** (`spikes/topics/data.js`), in one language per capture: two messages before the first title, then 30 pieces of work from 3 August to 30 September, each one or two turns.
- **Titling:** the package's pass judges each seller message. The title model answers nothing for the two opening messages, so they stay untitled; the first piece's first message is titled without asking Jev, as nothing comes before it; Jev answers new work on each later piece's first message; and the title model answers the piece's title, which the package writes as the label; every later message continues. One later message in the Buy Box work is judged as making its title stale, and the title model answers the new one, written on the work's first message. The last message, sent with a quote, starts new work too: that makes 32 labels.
- **The stamps are moved.** pi stamps what it records on the capture machine's clock, and a month cannot be captured in minutes, so each scene's `timestamp` values are shifted to the day and time the prototype names (US Pacific). The gaps within a scene are kept, and nothing else in a frame changes. `restamped` in the script does this.
- **Paths:** the capture's temporary root becomes `/opt/comchatx`, the tenant root becomes `/tenant`, and the OS owner becomes `tenant`.

## cx and its computer, each kind at one address

The preview's computer says when it will sleep on each connection (`saysSleep`, set by `preview-main.ts`), so the computer's card has a time to read. Each address takes `&lang=en` or `&lang=zh`.

| Address | What it shows |
|---|---|
| `?state=normal` | the computer on, its card's title counting whole minutes |
| `?state=last_minute` | the last minute: cx yawns, and the title says so in its own words |
| `?state=asleep` | the computer off; Switch on in either card, or a message, starts it, and the start takes `CANNED_START_MS` |
| `?state=refused` | off; a start is refused, the platform full (`global_limit`) |
| `?state=start_fails` | off; a start fails (a 502 from the box's step) |
| `?state=reconnecting` | out of reach, the computer last heard on |
| `?state=asleep_reconnecting` | out of reach, the computer last heard asleep |
| `?state=low_balance` | on, with less than one dollar left: the coin, and cx saying so once |
| `?state=below_floor`, `?state=below_floor_unsold` | under the floor: the computer asleep, as the platform closes it there |
| `?state=box_pending` | a new account's computer being set up |

## 设置 › 账户

`account-photo.svg` is an invented profile photo, drawn by the prototype of the account section; no person's. The section is walked at `#/settings/account` with these knobs, each beside any other:

| Address | What it opens on |
|---|---|
| `?devices=1`, `?devices=3`, `?devices=8` | one device (this browser), three, or eight; three by default |
| `?devices=unread` | the devices' read refused: 暂时无法获取 |
| `?unknown=1` | the third device with no kind and no place: 未知设备 |
| `?photo=kept` | a photo held, so the menu offers 移除 |
| `?account=hold` | the photo, the name, a device's end and 删除账户 left unanswered, so a press's turning stands still |
| `?move=fail` | the same moves refused |
| `?money=member-topup`, `?money=member-cancelled`, `?money=free-failed` | 删除账户 held: a subscription active, cancelled with its period running, being tried again |
