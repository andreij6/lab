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
| Back | The notebook works: sawtooth roof, two stacks | notebooks made (total, 7 days, 24 hours: smoke) |
| Back left | The school, its yard of newcomers | members who joined in 7 days |
| Back right | The chapel: rose window, steeple, bell | open fundraisers (the bell swings), ICP raised |
| Front right | Park, pond and the water tower | cycles all notebooks hold and burn a day; level = days left / 365 |
| Front left | Trailhead grove, a hiker per trip out on time | open, on-time check-ins (≤6) |

**Districts** (`DISTRICTS` in `town.ts`): blocks set aside, spread through the town, for landmarks that link out to
the rest of the Internet Computer. Homes skip them (`homeBlock` is the spiral without them), so they never move.

| District | Blocks | Landmarks |
|---|---|---|
| The financial district (right, by the park) | (2,0), (2,1) | OISY Wallet (a bank), ICPSwap (an exchange) |
| The ICP quarter (left) | (−2,−1) | The NNS (a capitol), Dominic Williams (a statue) |
| The spaceport (front left, by the lake) | (−2,2) | SOON launchpad (a rocket that launches every two minutes) |

To add a landmark, add an entry to its district: an id, a `kind`, a title, a blurb, a URL, its block and `at`
([x, y, w, d] in tiles from the block's corner). The `office` kind is a plain building in the landmark's `color`, so
a new one needs no drawing code. A new district is a name, a blurb and blocks; pick blocks before the town reaches
them, or homes there would move.

**The island**: the town's blocks, then an uneven belt of country (woods thinning to the shore, a lake, a river from
the back of the island through the lake and off the front edge in a waterfall, a road out of town over a bridge).
Streets are drawn around the civic centre, all of ring 2, and the residential blocks up to the last one lived in, so
the town grows block by block.

**The campground**, between the lake and the town: a tent for each person who signed in within 30 days and owns no
notebook (≤24; yours first, marked "You"), around a fire lit while anyone camps. The app calls the registry's
`visit()` on sign-in (recorded at most hourly, in MemoryId 39; new visitors stop being recorded at 100,000).

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
  `house_of`, capped at 600 (most lit first); fundraisers from chat messages.
- `town()` query computes the rest live: per-channel online and 24-hour messages, posts, listings, rains, trips,
  building sites (notebooks made in 3 days → their owners' lots), notebooks made in 24 h and 7 days, newcomers.
- Flag `town`, on by default; off, `town()` answers an error and the landing hides the preview.

## Frontend (`frontend/src/town.ts`)

- `layoutTown` is pure and tested (`town.test.ts`): the island's cells (void, land, water, road, bridge), blocks
  along a square spiral from ring 2, lots of 2×2 tiles, the civic centre, fillers and woods from a hash.
- The renderer draws the ground from cached paths, then every object back to front, ~30 fps, paused while hidden or
  scrolled away; reduced motion draws still frames.
- `#/town` (signed in or out): HUD cards, a toolbar (zoom, whole island, my home, legend, day or night), tooltips that
  link to the community, board, market or your notebooks. The landing page shows a slice of it drifting.
