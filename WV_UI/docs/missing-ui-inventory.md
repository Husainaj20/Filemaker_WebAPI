# Missing UI Inventory

## Missing screens and modules

- Records module shell with real list, detail, and actions
- Activity or audit log workspace with filters and trace inspection
- Settings or integration diagnostics screen for FileMaker connectivity and mapping visibility
- Dedicated issue diagnostics screen for backend and Data API failures

## Missing request-module states in the old implementation

- List empty state with clear next action
- List loading state
- Workspace empty state when nothing is selected
- Save-in-progress state
- Transition error state with actionable missing fields
- Backend offline state
- FileMaker integration failure state with trace id

## Missing request interactions

- Stable backend-owned create flow
- Stable backend-owned transition flow
- Consistent notes composer with server persistence
- Consistent attachment handling through one persistence boundary
- Traceable validation feedback instead of browser-only heuristics

## Missing design and layout structure

- Consistent app shell for future modules
- Clear separation of list pane, detail workspace, and workflow rail
- Clean hierarchy for overview, details, communications, documents, notes, and history
- Modern empty/loading/error surfaces instead of placeholder text
- Explicit persistence visibility so operators know whether a request is saved, pending, or failed

## Missing responsive behavior

- Predictable collapse from 3-column workspace to a stacked mobile layout
- Sticky but safe summary panels
- Field grids that collapse cleanly without overlapping legacy sections
