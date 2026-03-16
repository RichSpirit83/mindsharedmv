

## Plan: Fix PDF Download — Print-Friendly One-Page PDF

### Problem
The current PDF captures the on-screen grid via `html2canvas`, which produces a dark-themed, hard-to-read image that doesn't fit well on one printed page. The goal is a clean, printable one-page summary.

### Approach
Replace the `html2canvas` approach with a **programmatic jsPDF layout** that directly draws text onto the PDF. This gives full control over sizing, ensures it fits on one landscape A4 page, and produces clean printable output.

### Implementation

**File: `src/pages/admin/MatchingWorkspace.tsx`**

Replace `handleDownloadPdf` with a function that:

1. Creates a landscape A4 PDF
2. Calculates a grid layout based on number of tables (e.g., 3 columns × 2 rows for 6 tables)
3. For each table card, draws into its grid cell:
   - **Table number + name** (bold)
   - **Theme** (small italic)
   - **Table Head / Leads** with name + company
   - **"COMPANIES"** header
   - Each company name + founder name
4. Uses small font sizes (7-9pt) to fit everything on one page
5. Adds a title at top with session name and date
6. Remove the `html2canvas` import (no longer needed)

### Key details
- Grid cell dimensions calculated dynamically: `availableWidth / cols` and `availableHeight / rows`
- Font sizes: title 12pt, table header 9pt, content 7pt
- Colors via `jsPDF.setTextColor()` for headers vs body text
- No image rendering — pure text, so it's sharp and small file size

### Files changed

| File | Change |
|------|--------|
| `src/pages/admin/MatchingWorkspace.tsx` | Replace `handleDownloadPdf` with programmatic jsPDF text layout; remove `html2canvas` import |

