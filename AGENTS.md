# Agent notes

## UI

The dashboard UI is built on [ui-sdk](https://ui-sdk.dev) (`@ui-sdk/react` + `@ui-sdk/core`).
Before writing or changing UI code:

- Follow the `ui-sdk` skill if it is installed. Install it with
  `npx skills@latest add vercel-labs/ui --skill ui-sdk`; this writes `.agents/skills/ui-sdk`
  (git-ignored, per machine).
- Read `node_modules/@ui-sdk/react/docs/llms.txt`, then the page for the component you use.
- Import each component from its own entry (`@ui-sdk/react/dialog`), never the package root.
- Style through `data-slot` and state attributes (`data-open`, `data-checked`). The app's
  chrome for those parts lives in the "UI kit" section at the end of `src/index.css`, and
  reads the derived tokens (`--surface-raised`, `--border-soft`, `--ring`, …), so every theme
  preset styles it.
- Compose the app's wrappers from `src/components/ui/` (`Button`, `IconButton`, `Modal`,
  `Input`, `FieldRow`, `SelectField`, `SwitchField`, `useConfirm`, `useToast`) instead of
  hand-rolling dialogs, popups or form rows.

The dashboard shell lives in `src/components/shell/AppShell.tsx`; the Ctrl+K palette in
`src/components/CommandPalette.tsx`. Theme colours are written to `--color-*` and the
document is tagged with `data-theme-type` by `src/lib/themeType.ts`.

Every view has a path (`src/lib/route.ts`): `/monitor`, `/files`, `/settings/<section>`.
The sidebar is expanded, a 72 px rail, or hidden behind a floating button (`useShell()`
from `AppShell` switches it). The monitor view is `src/monitor/view/`; its settings are
the `monitor-*` sections of `SettingsView`, which stage edits in `MonitorDraftProvider`
and save on Save/Ctrl+S. Shared readings use `StatTile`, `LevelMeter`, `RingMeter`,
`Sparkline`, `InlineAlert`, `KeyValueList` and `LiveBadge` from `src/components/ui/`, with
thresholds in `src/lib/levels.ts`. Theme files hook the monitor through `.mv-*` classes.

`npm test` runs the node suites, then the Vitest component tests (`src/**/*.test.tsx`,
setup in `src/testing/setup.ts`). Every interface gets the ui-sdk agent test.
