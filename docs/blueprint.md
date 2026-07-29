# MovieViewingFinder — Bot specification

**Archetype:** content

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that returns legal streaming options, trailers, and public-domain links for movies/series requested by the owner. Shows official sources first, with watchlist and disambiguation features.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- single user (bot owner)

## Success criteria

- Displays accurate streaming options with official links for 90% of queries
- Maintains persistent watchlist with add/remove functionality
- Handles title disambiguation with 6-option UI

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with bot description and usage instructions
- **Add to watchlist** (button, actor: bot, callback: watchlist:add) — Add current title to persistent watchlist
- **Show watchlist** (button, actor: user, callback: watchlist:view) — Display all items in personal watchlist

## Flows

### title_search
_Trigger:_ user text message

1. Receive title query
2. Find best match
3. Show options bundle with buttons
4. Handle disambiguation if >6 matches

_Data touched:_ Query, TitleMatch, OptionsBundle

### watchlist_management
_Trigger:_ /watchlist or button

1. Show current watchlist
2. Allow remove/add actions
3. Confirm changes

_Data touched:_ Watchlist

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Query** _(retention: persistent)_ — User-submitted movie/series name with optional metadata
  - fields: title_text, year, season, episode
- **TitleMatch** _(retention: session)_ — Best-matching media record from external sources
  - fields: imdb_id, title, year, type
- **OptionsBundle** _(retention: none)_ — Curated viewing options for a title
  - fields: streaming_links, trailer_url, public_domain_links, availability_notes
- **Watchlist** _(retention: persistent)_ — User's saved titles for later viewing
  - fields: title_ids, last_accessed

## Integrations

- **Telegram** (required) — Bot API messaging
- **Movie/TV Metadata API** (required) — Title matching and metadata
- **Streaming Availability API** (required) — Official source discovery
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Manage personal watchlist
- View recent query history (last 100)

## Notifications

- Watchlist updates confirmation
- Query history access

## Permissions & privacy

- Only responds to owner's Telegram account
- No third-party data sharing

## Edge cases

- No matches found for title
- Region-locked content with no public-domain alternatives
- Public-domain only results

## Required tests

- End-to-end title search flow with disambiguation
- Watchlist persistence across sessions
- Private responses only to owner

## Assumptions

- Owner will provide necessary API keys
- Public-domain sources will be available for some titles
