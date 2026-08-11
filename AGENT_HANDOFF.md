# UltraRack agent handoff

Living notes for the next chat/agent. **Update this file** when a decision or major checkpoint lands. Skip chit-chat.

## Where things are

| Item | Value |
|------|--------|
| App | Single file: `index.html` (~7k lines, Three.js module, no build) |
| Author | Michael C. — keep credit / LICENSE / maker mark |
| Branch | `cursor/42u-rack-3d-2483` (GitHub Pages serves this branch) |
| Live | https://michaelchonghp.github.io/serverRoom/ |
| Base | `main` |
| Units | cm |

## Scene layout (stable)

- **Row A:** Rack1–3 at `+ROW_SEP/2`, `rotY = 0`
- **Row B:** Rack4–6 at `-ROW_SEP/2`, `rotY = π`, `xShift = -RACK_PITCH`
- **Power wall:** MCB (bottom) → UPS Bypass (above) → vertical trunk → **Dist panel on far side of trunk** (toward racks / −X)
- Conduits into trunk: **MCB→trunk** (at MCB height, PDU2 / building feed) · **Bypass→trunk** · **trunk→Dist**
- Parallel **return trunk** into room for UPS output return (separate lane, not reverse of outbound)
- Underfloor: outbound + separate return lane
- Ceiling **U-shaped power trunk** just below Wyr-Grid (`CPT_Y = WG_Y - CPT*0.5 - 8`), feeder from Rack1-end corner into wall trunk
- Every rack: rear **top rectangular cable opening**; zero-U **PDU1** (rear-view left = local +X), **PDU2** (rear-view right = local −X); C13 faces; light aluminum; height **60%** of channel, vertically centered

## Power model — decisions

### Green “32A TPN” (Show Power)

- Path: **MCB → Bypass → trunk → underfloor → UPS 32A TPN IN → OUT → return lane → Bypass → Dist**
- **Ends at Dist.** No more 32A TPN after the distribution board (by design).
- Single looping pulse along that polyline.

### Dist → PDU1 (UPS-protected feed) — blue

- Dist feeds **only PDU1** of each rack.
- Dist detail circuits: **L1–L6 → Rack1–6 PDU1** · **L7 → Security system** (details only; **no cable drawn**)
- Ratings: Rack1 PDU1 = **32A** industrial socket; Rack2–6 = **16A**
- PDU1 detail: powered from **UPS via Dist → ceiling industrial socket → whip**

### MCB → PDU2 (building power) — red

- PDU2 of each rack is fed from **MCB directly** (building power, **not** UPS).
- Logic: PDU1 = UPS-protected · PDU2 = raw building feed.
- Path mirrors blue tree: **MCB → trunk conduit → up trunk → feeder → U corner → arm A (1–3) + arm B (cross → 4–6) → spur to each PDU2**.
- Same U-corner split / no-backtrack / per-PDU spur pulse model as blue.
- Physical PDU2 whips/plugs: same as PDU1 — black cable ~3% slack through top opening → industrial plug into PDU2 ceiling socket
- Legend: red **Building feed** (`MCB → trunk → splits → PDU2`)

### Blue / red x-ray + pulses (shared tree rules)

- Static line: **outbound tree only** — no return path.
- Blue and red share the same physical trunk but run as **parallel lanes** (`BLUE_TRUNK_OFF` ≈ (−2.2, 0, +1.6) · `RED_TRUNK_OFF` ≈ (+2.2, 0, −1.6)); spurs leave the offset lane and end on the real socket/PDU.
- Must **follow wall trunk then ceiling trunk** (no aisle shortcuts).
- Pulses:
  1. One pulse leaves origin (Dist blue / MCB red) → **U corner**
  2. At U corner **splits into two arms** (row A + row B) — **no backtrack**
  3. On each arm, at each PDU socket junction **splits**: spur → that PDU (ends); continue along arm
  4. After **all 6** arrivals + short pause → **restart** from origin
- Legend: green **32A TPN** · blue **UPS feed** · red **Building feed**

### Physical wiring already in scene

- Ceiling industrial sockets (IEC 60309, **non-interactive**); Rack1 sockets **×1.2** (32A look) — both PDU1 and PDU2 positions
- PDU1 **and PDU2** whips on all racks: black cable, **~3%** in-rack slack, through top opening → industrial plug into ceiling socket
- Short silver conduits: MCB↔Bypass (vertical), MCB→trunk, Bypass→trunk, trunk→Dist
- **Core links (virtual):** C1↔C2 and C3↔C4 **ports 47–50** — straight aqua LC–LC x-rays; 47/48 raised · 49/50 lowered by one line thickness. Controls → **Core** show/hide. LEDs green on those ports. Sticky green detail callout points at the **C1↔C2 port 47** link midpoint while Core is shown.
- **Wyr-Grid waterfalls:** Panduit **WGSWF4BL**-style side waterfall (black, 3″ bend) on the **rear-side** rail of the basket above **each rack** (6 total).

## Design / product constraints

- Light UI theme (not dark generic rack from `main` PR #3)
- Brand: Austin Hughes UltraRack / Rack1–6; credit Michael C.
- Prefer one composition; don’t turn overview into a dashboard
- When file gets painful (~10–12k lines, merge pain, or equipment/power/UI each huge): **propose split** (`equipment.js` / `power.js` / `ui.js`) — user asked to be told, not to big-bang refactor early

## Open / unresolved

1. **Merge with `main`:** add/add conflict on `index.html`.  
   - `main` ≈610-line dark generic single 42U rack (PR #3)  
   - this branch ≈7k-line UltraRack facility  
   - **Conflicting intents** — needs explicit choose-ours / keep-main / dual-path decision. Merge was **aborted**; not resolved.
2. **(resolved)** PDU2 physical whips/plugs — same pattern as PDU1.
3. Dist→ceiling / MCB→ceiling feeds are conceptual via colored x-rays (physical Dist/MCB→ceiling cables not fully modeled beyond wall conduits into trunk).

## Major checkpoints (newest first)

| Commit / state | What landed |
|----------------|-------------|
| (this) | Sticky green Core callout pointing at C1↔C2 port-47 link midpoint |
| prior | Virtual C3↔C4 ports 47–50 aqua links (same pattern as C1↔C2) |
| prior | Virtual C1↔C2 ports 47–50 aqua lines (47/48 up · 49/50 down by thickness) |
| prior | Virtual C1↔C2 ports 47+49 aqua lines, vertically spaced by line thickness |
| prior | Virtual C1↔C2 port-47 aqua line + Controls → Core toggle |
| prior | Scrapped prior multi-port aqua core-link experiment |
| prior | Repo rename live URL → `serverRoom` |
| prior | Removed physical OM4 patch-cord experiment |
| prior | Wyr-Grid side waterfalls (×6, rear rail) |
| prior | (reverted) C1↔C2 OM4 aqua patch-cord experiment |
| `da14edf` | PDU2 whips + industrial plugs on all racks (same as PDU1) |
| `b4da94b` | Blue/red x-ray lanes offset inside the same trunk (not coincident) |
| `0fc89d0` | Dist L7 security (details only); MCB→trunk conduit; red MCB→PDU2 x-ray + U-corner split pulses |
| `70e6c61` | Blue pulses split at U corner into row A + row B arms — no backtrack after Rack3 |
| `9db28b3` | Blue start: Dist → trunk conduit → up trunk → ceiling feeder (not vertical at Dist) |
| `10c0948` | Blue pulses split at junctions; end at PDU; restart after 6; no return x-ray |
| PDU1 whips + sockets | All racks whipped; Rack1 32A size; non-interactive sockets |
| Ceiling U trunk | Under Wyr-Grid; feeder into wall trunk |
| Dist past trunk + UPS return | Separate return lane; green ends at Dist |
| Dual rear PDUs | PDU1/PDU2 zero-U; cable openings |
| Multi-rack room | Face-to-face rows, raised floor, power wall, Wyr-Grid |

## How a new agent should start

1. Read **this file**
2. Open `index.html` — power section near ceiling trunk / `startBlueFeedWave` / `startRedFeedWave`
3. Branch `cursor/42u-rack-3d-2483` (Pages); feature work on `cursor/<name>-4d50` then merge into Pages branch
4. Do **not** casually rewrite PR titles
5. Update **this file** when decisions change

## Conversation decisions to carry forward (2026-08-09)

### Patch panels and access/fiber layout

- Patch panel labels standardized to `PATCH 1`…`PATCH 8` (bold, high-visibility), ordered **top to bottom** (PATCH 1 at highest RU).
- 24-port patch panel front uses **single-row** RJ-45 layout (not 2x12), black panel with high-contrast ports.
- Patch label placement moved to panel **bottom-left** from aisle view; font resized/tuned for readability while preserving label footprint.
- Rack3 and Rack4 are the patching racks; Rack4 patch panel stack mirrors Rack3.
- 26F Rack1 and Rack2 inherited patching pattern from 25F Rack3/4 respectively.
- 26F Rack1 includes fiber panel matching 25F Rack1 style.

### 26F UPS + battery additions

- Added 26F Rack2 6kVA UPS model (`APC SRT6KRMXLI`) at 4U.
- Final accepted look is reuse of 25F 7U UPS front mesh style, scaled for 4U (after earlier rejected mesh attempts).
- Added one external battery pack for that UPS: `APC SRT192RMBP` at 3U.
- Battery front mesh style matches 25F batteries, scaled for 3U.

### UPS legend redesign (25F)

- Legend content converted from text list into compact **flowchart-style** diagram while keeping glow color language:
  - green = 32A TPN path
  - blue = UPS feed
  - red = MCB/building feed
- `32A TPN`, `UPS feed`, `MCB feed` labels remain left-aligned.
- Arrow/line styling tuned to be slim and consistent; red line specifically reduced and then global line style matched to it.
- Arrowheads increased ~20% from tiny state after line slimming.
- Overall legend height compressed for sleeker profile.
- PDU2 moved closer to PDU1 and Bypass closer to UPS to shorten connection strokes.
- Diagram text inside boxes increased (~20%) without enlarging boxes.
- Important rendering fix: avoid filter clipping on thin SVG paths (WebKit issue); path glow treatment adjusted so non-red paths remain visible.

### Power highlighting behavior

- Under `Show Power`:
  - MCB highlighted glowing **red**
  - UPS + Bypass highlighted glowing **green**
  - DB highlighted glowing **blue**
- UPS highlight includes x-ray-through visibility (glow shell behavior) so it reads through occluding geometry.
- Power flow visuals (glow/cable look) made ~30% more solid (less transparent/dull).

### 25F underfloor Cat6 trunk and dimensions

- Added underfloor Cat6 cabling trunk in cold aisle: **400mm W x 200mm H**.
- Trunk material is silver/metallic (same family as power trunk); "copper" refers to cable type, not trunk material.
- Routing adjustments applied to avoid conflicts:
  - shortened near power crossing for clearance
  - shifted laterally to avoid pedestal/column intersections
  - moved to Rack1/+X side per user correction
  - added extra clearance and slight extension beyond raised-floor edge
- Trunk converted from solid to **hollow** with realistic wall thickness (~2.5mm).
- Dimension callouts:
  - explicit 400mm (width) and 200mm (height)
  - geometry corrected so width and vertical dimensions are true dimensions
  - labels billboard to face camera
  - dimensions/labels now respect occlusion (no x-ray requirement)

### Cat6 cabling inside trunk (latest state)

- Initial single cable implementation replaced with bundled implementation.
- Current logical bundle is **24 cables** in row profile **4/5/6/5/4** (top to bottom), matching CBOT24K-inspired packing intent.
- Added tie-band rings along run so it reads as a bundled loom.
- Because true 6.6mm OD is barely visible at normal scene camera scale, a temporary **visibility scale** is applied to cable draw diameter so bundle structure is perceptible in view.
- If strict physical realism is required later, reduce/remove `bundleVizScale` and rely on close-up/cutaway views for inspection.

### Codebase split status (2026-08-11)

- Phase 1 split is now in place:
  - `index.html` is reduced to document markup + import map + module/bootstrap tags.
  - CSS moved to `styles/main.css`.
  - Main JS moved to `src/main.js`.
- `index.html` now includes explicit split comments near `<head>`/script bootstrapping to guide future agents.
- First modular JS cut is implemented:
  - UI DOM selector wiring moved into `src/modules/ui-elements.js` via `getUiElements()`.
  - `src/main.js` imports and destructures that module instead of declaring all control-element selectors inline.
- Additional restrained splits (without over-fragmenting files):
  - Blue/red power lane + pulse subsystem extracted to `src/modules/power-blue-red.js` (`initBlueRedPowerSystem()`).
  - Pointer/tap picking event wiring extracted to `src/modules/interaction.js` (`attachPointerInteractions()`).
  - `src/main.js` now orchestrates these modules while retaining scene assembly logic in one place.
- Future modular cuts should continue by domain (power logic, callouts, equipment factories) while passing shared state/context explicitly.

### Floor-specific one-off behavior

- Requested one-off UX rule: while `26F` is selected in floor controls, hide the **25F Rack1 Dell server** (`srv-poweredge-r750`) only.
- Implemented via `unit.userData.hideOn26F = true` at rack equipment placement time and `syncFloorConditionalVisibility()` called during init + `setFloor()`.
- Hardened implementation: tracked explicit refs in `hideOn26FUnits[]` and re-applied visibility in `animate()` each frame, preventing later code paths from re-showing the Dell while on 26F.
