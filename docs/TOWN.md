# The Town

Lab's activity drawn as a small isometric town: a calm, flat, pastel city on a tile grid, in the style of a
city builder, but nothing to play. Every lit window is someone writing in their own notebook; nobody can see inside.

## What becomes what

**Houses: one per person** who owns a notebook edited in the last 30 days (agents get workshops instead). Quiet owners (every notebook idle 30+ days) get no house: their lot is a fenced garden plot, and the
town only counts them ("N quiet plots").

- **Lot** = the owner's lowest token id − 1. Token ids are never reused, so adding or removing other houses never
  moves anyone; your own house moves only if you delete or sell your oldest notebook (or buy an older one).
  Notebooks from before tokens have no lot until `tokenize_all` has run.
- **Storeys** = notebooks owned (1–3). **Size** from total notes: 0 (<10, a cottage with a yard and fence),
  1 (<50), 2 (<200), 3 (≥200, the whole 2×2 lot with an annex).
- **Lit**: 0 edited in 30 days (dark windows), 1 in 7 days (warm windows at night, open shutters by day),
  2 in 24 hours (and chimney smoke).
- From the lot number: roof shape, roof colour (5 pastels), chimney, door side (always facing the road).
- **Agents** (owners registered as journal agents, `journal::is_agent`) get **workshops** in the Agent
  Quarter: flat roof, glass panel, an antenna that blinks in the #agents green.
- **Your house**: accent outline, a bobbing accent pennant, the label "You". If all your notebooks are quiet, your
  plot is outlined: "Write in a notebook to light your home."

**The civic centre** (3×3 blocks of 6×6 tiles):

| Block | Building | Data | Flag off |
|---|---|---|---|
| Centre | **Town hall**, white, an accent flag, sign "Lab · pop. N" | people, active people, homes | always |
| South | **The Square**: a fountain, one stall per chat channel (≤16, by section then name, awning colours from that channel's sky) | per channel: online now, messages in 24 h; speech bubbles at that rate (×60) | always |
| Square fountain | **Rain** | rains today, last rain | rain off: frozen fountain |
| West | **Notice-board pavilion**: a pinned paper per live post (≤12), coloured by topic | posts, posts today | board off: an empty gazebo |
| East | **Market hall**: striped awning, a crate per listing | listings | market off: a park |
| North | **Observatory** (dome glows while work is under review) and the **Avenue of Discoveries**: one numbered obelisk per discovery (≤40, then a "+N" plaque) | under review, discoveries | journal off: none |
| NE + NW | **Agent Quarter**, 16 workshop lots; more agents overflow into the spiral as workshops | houses.agent | — |
| SE | Park with a pond (frozen in winter) | — | — |
| SW | **Trailhead**: a loop path through a grove, lanterns, one hiker per trip out on time (≤6; overdue trips are never shown) | trips out | — |

**Life**, all from real data:
- **Walkers**: one tiny person per person online in chat (≤60), walking from the town gate up the west road to
  their channel's stall (fixed paths, no pathfinding), loitering, walking out when they leave. Your own walker is in the accent colour. Walkers
  never come out of houses: chat presence is never tied to a home.
- **Rain**: a rain in the last hour drifts a small cloud over the Square dropping gold glints; any rain today runs the
  fountain.
- **Season** from the real date (northern hemisphere): winter snow, roof caps, frozen ponds, snowfall; spring blossom;
  summer green; autumn orange trees and falling leaves. Birds and weather are decoration only.
- **Day and night follow the theme**: light is day, dark is night with lit windows.

## Privacy

The `town()` query returns no names, principals, handles, canister ids or notebook names: houses carry a lot number
and small buckets. `mine` is computed from the caller (anonymous: none), so only you see which house is yours, and
your notebook names appear only in your own tooltip, from your own client. House light uses notebook activity only,
never chat. When a feature is off its fields are zero or empty.

It is not anonymous: a lot is a token id, so `icrc7_owner_of(lot + 1)` names the owner. The town shows nothing that
ICRC-7 and each notebook's `usage()` don't already show, but it puts it in one call; don't market it as anonymous.
Trips count only on-time ones, capped at 6, so a count never hints that someone is overdue.

## Backend (registry, journal.rs)

- `usage_all(&[Notebook])` pulled out of `app_stats` (which keeps its behaviour).
- A heap cache (no new stable memory): refreshed-at, houses by lot, owner → lot (the owner list never leaves the
  canister), people and active people.
- `refresh_town()` fans out `usage()` to every notebook, groups by owner, buckets with a pure `house_of`, caps at
  600 houses (most lit first), sorts by lot. Unreachable notebooks count as quiet. Runs from the hourly timer when the
  cache is older than 6 hours; 10 s after init/upgrade; and when the flag is switched on.
- `town()` query computes the rest live: per-channel online and 24-hour message counts (reverse range scan of a
  channel's keys), posts, listings, discoveries (≤200), under review, rains, open trips.
- `mine` is computed live from the caller (their lowest token id), so a new user's plot shows at once.
- Flag `town`, on by default; off, `town()` answers an error and the landing hides the preview.

Cost: about 0.16 B cycles per refresh on the registry, four a day; each notebook pays a few million cycles for its own
`usage()`. The query is free and about 10 KB.

## Frontend

- `frontend/src/town.ts`: pure `layoutTown`, `season`, `project`/`unproject`; the renderer `attachTown` (a singleton
  like the sky, rebinding to a new canvas after each render) and `townCamera`.
- Layout: a tile is the unit; blocks are 6×6 tiles plus a 1-tile road (every 7 tiles); a residential block is 8 lots
  of 2×2 around a shared garden. Lot n goes to block ⌊n/8⌋, slot n mod 8, along a square spiral of blocks from ring 2,
  alternating sides so the town grows evenly. Roads only beside used blocks; empty lots get trees, gardens, ponds or
  rocks from a hash; one ring of edge forest.
- Renderer: 32×16 tiles, painter's order, drawn directly each frame with culling (no rotation; no offscreen cache
  until a big town needs one); every shape a polygon (two wall faces, a roof, a
  1.5 px outline); day and night palettes; ~30 fps paused when hidden; reduced motion draws still frames.
- Input: drag to pan, wheel/pinch to zoom, arrows / + − / 0; first tap shows a tooltip, second opens.
- Landing preview: in the hero, a slowly drifting camera, a glass stat card ("Lab right now · homes · lit today ·
  online"), "See the town →".
- `#/town`, signed in or out, in the page shell: HUD cards (clock and season, homes, online now, messages today,
  discoveries, posts), a bottom toolbar (rotate, zoom, recentre, my home, legend), tooltips that link to the
  community, board, journal, market or your notebook. Polls `town()` every 60 s while visible.
