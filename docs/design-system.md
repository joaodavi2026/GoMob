# GoMob Design System

Tokens live in `src/app/globals.css` (Tailwind v4 `@theme`). Import components from `@/components/ui` (barrel) or the individual files. UI text is English.

Colors: `primary #FF6B00` (hover `#E85D00`, pressed `#CC5200`, light `#FFF1E6`), `canvas`, `ink`, `muted`, `border`, `risk-low|moderate|high|unknown`. Orange and white dominate; risk colors only communicate operational state and are always paired with text.

## Foundations (existing)
| Component | Variants / states |
|---|---|
| `Button` | `variant`: primary, secondary, ghost, danger; `size`: sm, md, lg, icon; `loading`, `disabled`. Icon-only buttons need `aria-label`. |
| `Input` | `label`, `error` (role=alert), `leading`, `trailing`. |
| `Card`, `Badge` (neutral, primary, low, moderate, high, unknown), `Skeleton`, `EmptyState`, `ErrorState`, `DemoBadge`, `RiskBadge`, `Logo` (full/mark), `useToast` (success/error). |

## Overlays (`overlay.tsx`)
All share: portal, Escape closes, backdrop click closes, focus trap, focus restored on close, body scroll lock, `role="dialog"` + `aria-modal`. Mark the preferred initial focus target with `data-autofocus`.
- `Modal` centered on desktop, bottom-anchored on phones.
- `Drawer` right side panel (`max-w-sm`).
- `BottomSheet` mobile-first sheet with grab handle, respects safe area.
- `ConfirmDialog` props: `destructive`, `loading`, `confirmLabel`, `cancelLabel`.
- `Tooltip` wraps one focusable element; shows on hover and focus. `side`: top, bottom.

## Navigation and selection
- `Tabs` (`tabs.tsx`): controlled, `role=tablist`, arrow/Home/End navigation. Render the active panel yourself.
- `Dropdown` (`dropdown.tsx`): action menu; `trigger` render-prop receives the props to spread on your button; arrow key navigation; item `danger`, `disabled`, optional `header`.
- `Combobox`: ARIA 1.2 autocomplete. `filter` (local filtering, default on; turn off for remote search), `loading`, `emptyText`, `leading` icon. Controlled via `query` / `onQueryChange` / `onSelect`.
- `SearchInput`: `type=search`, clear button, requires an `aria-label`.

## Data display
- `MetricCard` (`default`, `primary`), `LineChip`, `BusCard` (button when `onClick`, else static; shows Demo tag), `RouteCard` (selected state, steps, transfers, walking time, risk meter, Demo badge).
- `RiskIndicator`: LOW / MODERATE / HIGH / INSUFFICIENT_DATA meter with text label and optional score; `compact` hides the numeric score.
- `EtaIndicator`: minutes, or "ETA unavailable" when null.
- `LiveStatus`: CONNECTED, UPDATING, STALE, UNAVAILABLE, DEMO pill; `hideLabelOnMobile`.
- `timeAgo(iso)`: "Last updated 2 minutes ago".
- `DataTable`: typed columns, `hideOnMobile`, loading skeleton rows, empty and error states, `caption` for screen readers.

## Layout (`src/components/layout`)
- `PassengerShell`: header (logo, data source indicator from `GET /api/system/status`, avatar menu with sign out), desktop sidebar (>= lg), mobile bottom navigation (Home, Routes, Map, Favorites, Profile; active tab orange), skip link, safe-area padding.
- `LoadingScreen`, hooks `useMe()` and `useSystemStatus()`.

## Accessibility rules
Visible focus ring (global `:focus-visible`), labels on every input, `role="alert"` for errors, `aria-current="page"` on navigation, reduced-motion respected, no horizontal page scroll (wide content scrolls inside its own container). White text on `primary` is used only for large/bold text and buttons.
