

## Plan: Presentation Carousel with Timer + Briefing Company Count Fix

### 1. Presentation View Overhaul (`PresentationView.tsx`)

Replace the current static grid with a **3-slide carousel** using Embla (already installed):

**Slide 1 — Table Assignments**: The existing grid of table cards with participants (already has companies from DB). Keep current layout but ensure company names show clearly alongside participant names.

**Slide 2 — Session Prompts**: Full-screen display of the session's engagement prompts, large text, styled for readability from a distance.

**Slide 3 — Timer**: A countdown/count-up timer based on session `breakout_start` and `breakout_end` times.
- On load, parse `breakout_start` (e.g. "11:00") and compare to current local time.
- If current time >= start time → auto-start the timer counting down to `breakout_end`.
- If current time < start time → show "Starting at {time}" with a manual "Start Now" button.
- Manual start button always available to override.
- Large clock-style display showing MM:SS remaining.

**Navigation**: Left/right arrows + dot indicators at the bottom. Keyboard arrow support comes free from the carousel component.

### 2. Lead Briefings Company Count Fix (`LeadBriefings.tsx`)

The count is already shown on line 243 (`{table.companies.length} companies`), but the label says "companies" — verify it's rendering correctly. The issue may be that `companies` array is empty due to a data loading problem. Will check and ensure the count displays prominently in the card header.

### File Changes

| Action | File |
|--------|------|
| Rewrite | `src/pages/admin/PresentationView.tsx` — carousel with 3 slides (tables, prompts, timer) |
| Edit | `src/pages/admin/LeadBriefings.tsx` — ensure company count is visible and correct |

