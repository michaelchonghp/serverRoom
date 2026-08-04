# UltraRack agent handoff

Living notes for the next chat/agent. **Update this file** when a decision or major checkpoint lands. Skip chit-chat.

## Where things are

| Item | Value |
|------|--------|
| App | Single file: `index.html` (~7k lines, Three.js module, no build) |
| Author | Michael C. — keep credit / LICENSE / maker mark |
| Branch | `cursor/42u-rack-3d-2483` |
| PR | https://github.com/michaelchonghp/telegramTestOne/pull/4 — title may be human-edited (**preserve PR title** when updating via tools) |
| Base | `main` |
| Units | cm |

## Scene layout (stable)

- **Row A:** Rack1–3 at `+ROW_SEP/2`, `rotY = 0`
- **Row B:** Rack4–6 at `-ROW_SEP/2`, `rotY = π`, `xShift = -RACK_PITCH`
- **Power wall:** MCB (bottom) → UPS Bypass (above) → vertical trunk → **Dist panel on far side of trunk** (toward racks / −X)
- Parallel **return trunk** into room for UPS output return (separate lane, not reverse of outbound)
- Underfloor: outbound + separate return lane
- Ceiling **U-shaped power trunk** just below Wyr-Grid (`CPT_Y = WG_Y - CPT*0.5 - 8`), feeder from Rack1-end corner into wall trunk
- Every rack: rear **top rectangular cable opening**; zero-U **PDU1** (rear-view left = local +X), **PDU2** (rear-view right = local −X); C13 faces; light aluminum; height **60%** of channel, vertically centered

## Power model — decisions

### Green “32A TPN” (Show Power)

- Path: **MCB → Bypass → trunk → underfloor → UPS 32A TPN IN → OUT → return lane → Bypass → Dist**
- **Ends at Dist.** No more 32A TPN after the distribution board (by design).
- Single looping pulse along that polyline.

### Dist → PDU1 (UPS-protected feed)

- Dist feeds **only PDU1** of each rack (what is connected today).
- Dist detail circuits: **L1–L6 → Rack1–6 PDU1**
- Ratings: Rack1 PDU1 = **32A** industrial socket; Rack2–6 = **16A**
- PDU1 detail: powered from **UPS via Dist → ceiling industrial socket → whip**
- PDU2: **not** on Dist PDU1 circuits (spare / future)

### Blue x-ray + pulses

- Static blue line: **outbound tree only** — Dist → **horizontal to wall trunk** → **up trunk** → feeder → U trunk (Row A 1–3 → cross → Row B 4–6) + **one-way spur** down to each PDU1. **No return path** (power does not flow back).
- Must **follow wall trunk then ceiling trunk** (no vertical rise at Dist; no aisle shortcuts for far racks).
- Pulses (not one continuous loop):
  1. One pulse leaves **Dist**
  2. At each PDU1 socket junction it **splits**: spur → that PDU and **disappears on arrival**; another pulse **continues** along the trunk
  3. After **all 6** PDU arrivals + short pause → **restart** from Dist
- Legend (one line): green **32A TPN** · blue **UPS feed** (`Dist → trunk → splits → PDU1`)

### Physical wiring already in scene

- Ceiling industrial sockets (IEC 60309, **non-interactive**); Rack1 sockets **×1.2** (32A look)
- PDU1 whips on all racks: black cable, **~3%** in-rack slack, through top opening → blue plug into ceiling socket

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
2. **PDU2** not fed (no Dist circuits / whips story yet).
3. Dist→ceiling feed is conceptual via blue x-ray (physical Dist→ceiling cables not fully modeled).

## Major checkpoints (newest first)

| Commit / state | What landed |
|----------------|-------------|
| (this branch) | Blue start: Dist → trunk conduit → up trunk → ceiling feeder (not vertical at Dist) |
| `10c0948` | Blue pulses split at junctions; end at PDU; restart after 6; no return x-ray |
| `ac5166f` / legend | Blue path follows U trunk; (pulse return later replaced by split model) |
| PDU1 whips + sockets | All racks whipped; Rack1 32A size; non-interactive sockets |
| Ceiling U trunk | Under Wyr-Grid; feeder into wall trunk |
| Dist past trunk + UPS return | Separate return lane; green ends at Dist |
| Dual rear PDUs | PDU1/PDU2 zero-U; cable openings |
| Multi-rack room | Face-to-face rows, raised floor, power wall, Wyr-Grid |

## How a new agent should start

1. Read **this file**
2. Open `index.html` — power section near ceiling trunk / `blueTrunkLegs` / `startBlueFeedWave`
3. Branch `cursor/42u-rack-3d-2483`, PR #4
4. Do **not** casually rewrite PR title
5. Update **this file** when decisions change
