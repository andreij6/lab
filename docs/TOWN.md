# The town

Lab's activity drawn as a small isometric island town: calm, flat and pastel, in the style of a city builder, with
nothing to play. Every lit window is someone writing in their own notebook; nobody can see inside.

## What becomes what

**Homes: one per person** who owns a notebook edited in the last 30 days. Quiet owners (every notebook idle 30+
days) get no house; the town hall counts their plots.

- **Lot** = the owner's lowest token id − 1. Token ids are never reused, so adding or removing other houses never
  moves anyone; your own house moves only if you delete or sell your oldest notebook (or buy an older one).
  Notebooks from before tokens have no lot until `tokenize_all` has run.
- **Storeys** = notebooks owned (1–3). **Size** from total notes: under 10, 50, 200, more.
- **Lit**: edited within 30 days, 7 days (warm windows at night), 24 hours (chimney smoke).
- **Low**: a notebook with under 30 days of cycles left: a red lamp by the door.
- **Building**: a notebook made in the last 3 days: a building site (or a new storey with scaffolding), with a crane.
- **Your home**: accent outline, a pennant, "You". Quiet: your plot is outlined.

**The civic centre** (3×3 blocks of 6×6 tiles):

| Block | Building | Data |
|---|---|---|
| Centre | Town hall, accent flag | people, homes, quiet plots |
| Front | The Square: a fountain, a stall per chat channel | online now and messages in 24 h per channel; rains (the fountain runs; frozen when rain is off) |
| Left | The board's pavilion, a paper per live post | live posts, new in 24 h |
| Right | Market hall, a crate per listing (a park while the market is off) | listings |
| Back | The town green: a pond under trees, benches | — |
| Back left | The school, its yard of newcomers | members who joined in 7 days |
| Back right | The chapel: rose window, steeple, bell | open fundraisers (the bell swings), ICP raised |
| Front right | Park, pond and the water tower | cycles all notebooks hold and burn a day; level = days left / 365 |
| Front left | Trailhead grove, a hiker per trip out on time | open, on-time check-ins (≤6) |

**Districts** (`DISTRICTS` in `town.ts`): blocks set aside, spread through the town, for landmarks that link out to
the rest of the Internet Computer. Homes skip them (`homeBlock` is the spiral without them), so they never move.

| District | Blocks | Landmarks |
|---|---|---|
| The financial district (right, by the park) | (2,0), (2,1) | OISY Wallet (a bank), ICPSwap (an exchange) |
| The ICP quarter (left) | (−2,−1), (−2,0) | The NNS (a capitol), Dominic Williams (a statue), DFINITY on X (a news station) |
| Embassy row (left, beside the ICP quarter) | (−2,1) | The Swiss Subnet (a chalet data centre), the Pakistan Subnet (a data centre), UNDP · Universal Trusted Credentials (an office and small shops) |
| The spaceport (outskirts: the back right coast, fenced) | none: a site 4 tiles beyond the town's edge | SOON launchpad (a rocket that launches every two minutes) |

To add a landmark, add an entry to its district: an id, a `kind`, a title, a blurb, a URL, its block and `at`
([x, y, w, d] in tiles from the block's corner). The `office` kind is a plain building in the landmark's `color`, so
a new one needs no drawing code. A new district is a name, a blurb and blocks; pick blocks before the town reaches
them, or homes there would move.

**Quests** (TownHouse.badges, bits): 1 Sprout (10 notes: a flower bed), 2 Weaver (25 links: ivy), 4 a week's streak
(a flag on the roof), 8 a month's streak (a statue), 16 Librarian (100 notes: a lantern). Computed by the registry at
refresh from each notebook's `usage()` (notes, links, streak; the notebook keeps a map of days a person changed a note),
summed per owner. `Town.my_quests` gives the caller their own (notes, links, best streak).

**Sponsors** (`sponsors.rs`, MemoryIds 41-43, flag `sponsors`): propose → admin `review_sponsor` → `pay_sponsor`
(months × `sponsor_price`, through the usual ICRC-2 allowance; the ICP is swept into the registry's cycles). `town()`
carries the live ones (name, blurb, url, colour; no principals); the frontend fills the static Sponsors district
(blocks (1,−2), (2,−2), eight lots) with `office` buildings in their colour.

**The outskirts**, beyond the last streets and away from homes (both move outward as the town grows): the spaceport
on the back right coast, fenced, and the notebook works (the factory: sawtooth roof, two stacks, smoke when a notebook
was made today, a crate per notebook this week) in the front right corner by the railway. Each gets rounded ground and
one access road along a street row, so it crosses no lots.

**The island**: the town's blocks, then an uneven belt of country (woods thinning to the shore, a lake, a river from
the back of the island through the lake and off the front edge in a waterfall, a road out of town over a bridge).
Streets are drawn around the civic centre, all of ring 2, and the residential blocks up to the last one lived in, so
the town grows block by block.

**The station**, across the front of the island: a railway between two buffer stops (a trestle over the river; the train fades in and out at the ends), a
platform where visitors wait (people who signed in within 30 days and own no notebook, ≤24; yours first, marked
"You"), a station house, and a train that comes in every 90 seconds, stops and goes on. The street from the town gate
runs to it, so walkers come in from the station. The app calls the registry's `visit()` on sign-in (recorded at most
hourly, in MemoryId 39; new visitors stop being recorded at 100,000).

**Life**: people online in chat walk from the town gate to their channel's stall (yours in the accent colour; they
never come out of houses, so chat is never tied to a home); newcomers play in the schoolyard; hikers walk the trail;
seasons from the date; light theme is day, dark is night.

## Privacy

`town()` returns no names, principals, handles, canister ids or notebook names: houses carry a lot number and small
buckets. `mine` is computed from the caller (anonymous: none). It is not anonymous: a lot is a token id, so
`icrc7_owner_of(lot + 1)` names the owner, and each notebook's `usage()` and cycles are already readable. The town
shows nothing new, but puts it in one call; don't market it as anonymous. Trips count only on-time ones, capped at 6.

## Backend (`canisters/registry/src/town.rs`, `stats.rs`)

- A heap cache refreshed every 6 hours (10 s after an upgrade; when the flag is switched on): every notebook's
  `usage()` and `canister_status` (cycles, idle burn a day), 50 at a time; houses grouped by owner and bucketed by
  `house_of`; at most 600 are drawn (`pick_houses`: grouped by size, storeys and how recently edited, taken a
  group at a time in turn and in a scattered order, so a mix of every kind spread over the town). `town()` also
  sends `homes` (all of them), `max_shown` and the caller's own `my_house`, which the app always draws. The HUD
  says how many are shown when it is fewer than all.
- `town()` query computes the rest live: per-channel online and 24-hour messages, posts, listings, rains, trips,
  building sites (notebooks made in 3 days → their owners' lots), notebooks made in 24 h and 7 days, newcomers.
- Flag `town`, on by default; off, `town()` answers an error and the landing hides the preview.

## Frontend (`frontend/src/town.ts`)

- `layoutTown` is pure and tested (`town.test.ts`): the island's cells (void, land, water, road, bridge), blocks
  along a square spiral from ring 2, lots of 2×2 tiles, the civic centre, fillers and woods from a hash.
- The renderer draws the ground from cached paths, then every object back to front, ~30 fps, paused while hidden or
  scrolled away; reduced motion draws still frames.
- `#/town` (signed in or out): a dock along the bottom (stat chips and the controls: zoom, whole island, my home, tour,
  legend, sponsor, day or night), a tour (`TOUR` steps in main.ts; `townFly` eases the camera and `spotlight` rings the
  target; the model home on the green is a fixed house with every badge), tooltips that
  link to the community, board, market or your notebooks. The landing page shows a slice of it drifting.
