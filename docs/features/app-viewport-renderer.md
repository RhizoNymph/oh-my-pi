# App-owned transcript viewport

## Scope

The experimental app viewport renderer keeps the coding-agent transcript scrollable while the live HUD, status line, and editor remain pinned to the bottom of the terminal. Enable it for one process with:

```sh
PI_TUI_RENDER_BACKEND=app-viewport omp
```

In scope:

- alternate-screen lifecycle for the primary interactive TUI;
- an application-owned transcript offset and follow-tail state;
- mouse-wheel, PageUp/PageDown, Alt+Home, and Alt+End navigation;
- bottom-pinned root components after the transcript boundary;
- editor input and hardware-cursor placement while reading earlier transcript rows;
- fixed-grid repainting without native-scrollback writes or ED3;
- text fallback for inline images whose terminal placements cannot yet be safely relocated.

Not in scope:

- replacing the default native-scrollback renderer;
- app-side text selection, copy, search, or transcript export;
- preserving the alternate-buffer transcript on the normal screen after exit;
- live switching between render backends;
- graphical image relocation inside the app-owned viewport.

## Data and control flow

1. `InteractiveMode` builds the root component order: startup/history content, `TranscriptContainer`, anchored HUD/status components, and `editorContainer`.
2. `TranscriptContainer.render()` assembles current transcript rows and implements `AppViewportScrollRegion`. Its endpoint marks the absolute root-frame row after the transcript. Startup rows before the transcript remain part of the scrollable prefix; every root row after it is sticky chrome.
3. `TUI` chooses its backend once in the constructor. `TUIOptions.renderBackend` takes precedence; otherwise `PI_TUI_RENDER_BACKEND=app-viewport` selects the experimental backend.
4. On the first frame, `TUI` enters DEC alternate screen 1049, reapplies keyboard enhancement, enables SGR mouse reporting, and registers the alternate-screen state for emergency restoration.
5. `TUI.render()` composes the same semantic root frame used by the native backend. Native committed-row claims are forced to zero, so `TranscriptContainer` retains all locally scrollable rows rather than compacting finalized rows into terminal history.
6. The app viewport planner splits the prepared frame at the transcript endpoint. It slices the transcript prefix at `scrollTop`, pads a short transcript with blank rows, and bottom-aligns the sticky suffix. If the suffix itself exceeds terminal height, the bottommost rows win so the editor remains reachable.
7. When follow-tail is active, `scrollTop` tracks the latest transcript window. Scrolling upward disables follow-tail. New streamed rows then repaint without changing the reader's offset. Reaching the bottom or pressing Alt+End restores follow-tail.
8. Cursor markers stay in semantic frame coordinates until the viewport is planned. Transcript markers map through `scrollTop`; sticky markers map through the bottom-aligned suffix. Offscreen markers are hidden. Overlay markers already use screen coordinates.
9. The emitter homes the cursor and rewrites exactly the visible alternate-screen grid under synchronized-output/autowrap guards. It never appends line feeds past the grid, emits ED3, or updates the native committed-row ledger.
10. On shutdown, TUI disables mouse and keyboard enhancement, leaves alternate screen once, clears emergency alt-screen state, and skips normal-buffer shell cursor-placement math.

## Related files

| File | Role | Key exports/interfaces |
|---|---|---|
| `packages/tui/src/tui.ts` | Backend selection, frame boundary collection, scroll/follow state, input routing, viewport planning, alternate-screen lifecycle, cursor mapping, fixed-grid emission | `TUI`, `TUIOptions`, `TUIRenderBackend`, `AppViewportScrollRegion` |
| `packages/tui/src/mouse.ts` | Complete SGR mouse report parsing used for wheel navigation and overlay arbitration | `parseSgrMouse`, `SgrMouseEvent` |
| `packages/tui/src/terminal.ts` | Terminal I/O, keyboard enhancement, resize callbacks, emergency alternate-screen restoration | `Terminal`, `ProcessTerminal`, `setAltScreenActive` |
| `packages/tui/src/components/image.ts` | Per-TUI image budget; forces text fallbacks for this backend until placements can be relocated safely | `ImageBudget`, `Image` |
| `packages/coding-agent/src/modes/components/transcript-container.ts` | Retained semantic transcript rows and scroll-region endpoint | `TranscriptContainer` |
| `packages/coding-agent/src/modes/interactive-mode.ts` | Root layout whose post-transcript children become sticky chrome | `InteractiveMode` |
| `packages/tui/test/app-viewport.test.ts` | Observable viewport, input, cursor, follow-tail, overflow, lifecycle, and no-native-history contracts | test-only probes |

## Invariants and constraints

- Backend choice is fixed for a `TUI` instance. A native-to-app runtime switch would first have to rehydrate rows already compacted into native history.
- App viewport mode MUST feed zero native committed rows to every root component. Otherwise `TranscriptContainer` may compact history that the app still needs to scroll.
- The transcript endpoint MUST be read after the component renders and translated into root-frame coordinates.
- Sticky suffix overflow MUST retain the bottommost rows; losing the editor is never an acceptable clamp strategy.
- Upward navigation MUST disable follow-tail. New transcript rows MUST NOT move a reader who is not following.
- Ordinary editor input MUST continue to reach the focused editor while the transcript is scrolled.
- Visible frame emission MUST remain bounded to terminal height and MUST NOT emit ED3 or create alternate-buffer scrollback.
- DEC 1049 enter/exit, keyboard enhancement, mouse reporting, and `setAltScreenActive` state MUST remain balanced, including stop and emergency cleanup.
- Fullscreen overlays reuse the already-active alternate buffer; they MUST NOT nest 1049 save/restore sequences.
- Non-fullscreen overlays take input precedence over transcript scrolling.
- Terminal graphics MUST remain text fallbacks until placement deletion/repositioning can be done without discarding stable image IDs.
- The default `native-scrollback` backend and its append-only commit contract remain unchanged when the experimental backend is not selected.
