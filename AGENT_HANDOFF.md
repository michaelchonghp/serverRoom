# UltraRack agent handoff

Living notes for the next chat/agent. **Update this file** when a decision or major checkpoint lands. Skip chit-chat.

## Where things are

| Item | Value |
|------|--------|
| App | Single file: `index.html` (~7k lines, Three.js module, no build) |
| Author | Michael C. — keep credit / LICENSE / maker mark |
| Branch | `cursor/42u-rack-3d-2483` (GitHub Pages serves this branch) |
| Live | https://michaelchonghp.github.io/telegramTestOne/ |
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
- **Fiber (started):** C1↔C2 redundancy — 4× Panduit OM4 LC–LC aqua; route each end **port → nearest side → rear → top opening → Wyr-Grid**, across basket, reverse into peer. Inventory in `FIBER_LINKS`; cords not interactive. Port LEDs green when `linked: true`.

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
| (this) | First fiber: C1↔C2 OM4 aqua LC–LC ×4 (ports 47–50); `FIBER_LINKS` inventory remarks |
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
