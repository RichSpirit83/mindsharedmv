## Why the badges aren't showing

The chip code is correct — the badges only render when `mapped_data.revenue` and `mapped_data.capital_raised` exist. I checked your database directly: **none of the 38 founders in this session have those fields populated**, along with several other key fields (sector, business type, PMF, sales stage, employee count, ICP, primary market).

The raw CSV has the values — they just never got mapped during upload because the column headers were too long for the auto-mapper. Examples of what came in:

- `"Company Size (Revenue): Please indicate the ARR as of the end of 2025"` → should map to `revenue`
- `"Company Size (Capitalization): Please indicate the amount of investment received from external investors..."` → should map to `capital_raised`
- `"Describe what sector(s) are most relevant to you"` → should map to `sector`
- `"What is the primary market that you serve?"` → should map to `primary_market`
- `"Which of the following best describes your business?"` → should map to `business_type`
- `"Have you found product-market fit?"` → should map to `has_pmf`
- `"Where are you in your sales evolution?"` → should map to `sales_stage`
- `"Company Size (# of Employees): Please indicate..."` → should map to `employee_count`
- `"Briefly Describe your ideal customer profile (ICP)"` → should map to `icp`

The auto-mapper's alias list only had short forms ("revenue", "sector", "icp"), so these long form headers slipped through. Your raw CSV data is intact — only `mapped_data` is incomplete.

## Plan

### Step 1 — Backfill the 38 founders in Session 2 from their raw CSV data

Run a one-shot data update that, for each founder in this session, reads the long-form CSV columns out of `raw_data` and writes the values into `mapped_data` for: `revenue`, `capital_raised`, `sector`, `primary_market`, `business_type`, `has_pmf`, `sales_stage`, `employee_count`, `icp`.

- Only fills in fields that are currently empty — won't overwrite anything you've already edited.
- No re-upload needed. After this runs, the Revenue + Capital Raised badges will appear on every chip that has a value, and the Founder Profile cards will be complete.

### Step 2 — Strengthen the auto-mapper so this doesn't recur

Update `src/lib/founderFields.ts` to add these long-form aliases to the canonical field map:

- `sector`: + "describe what sector"
- `primary_market`: + "what is the primary market"
- `business_type`: + "which of the following best describes your business"
- `customer_type`: + "general go to market profile"
- `icp`: + "briefly describe your ideal customer profile", "ideal customer profile"
- `employee_count`: + "company size # of employees", "company size employees"
- `revenue`: + "company size revenue", "indicate the arr", "annual recurring revenue"
- `capital_raised`: + "company size capitalization", "amount of investment received"
- `has_pmf`: + "have you found product market fit"
- `sales_stage`: + "where are you in your sales evolution", "sales evolution"

Future CSV uploads with the same Typeform-style long headers will auto-map correctly without manual intervention.

### Step 3 — Confirmation snapshot

Already in place: the "Pre-tags backup (2026-04-24)" of Round 1 from the previous step is still in the database. Step 1 only touches `breakout_companies.mapped_data`, not the table assignments — your matching layout (38 founders across 5 tables) is unaffected.

## Files touched

- **Data update** (`breakout_companies` rows for session `f0833640-…` only): backfill `mapped_data` from `raw_data`.
- **Code**: `src/lib/founderFields.ts` — extend `FIELD_ALIASES`.
- **No** changes to chip rendering (the badges code is already correct), no schema migration, no edge function changes.

## What you'll see after

- Refresh the matching page → every chip with revenue/capital data shows the green and blue badges next to the company name.
- Open any Founder Profile → Revenue, Capital Raised, Sales Stage, PMF, Sector, Primary Market, Business Type, ICP all populated.
- Re-uploading a similar CSV in the future maps these fields automatically.

Approve and I'll backfill the data and update the aliases.