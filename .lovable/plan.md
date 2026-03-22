

## Plan: Fix Founder Pool Header Stickiness + Import Dialog Sizing

### Changes to `src/pages/admin/FounderPool.tsx`

**1. Sticky header section**
- Wrap the header (title, badge, upload buttons) and search bar in a `shrink-0` container so they never scroll
- The table Card already uses `flex-1 min-h-0 overflow-auto`, which handles the scrollable area — just need to ensure the header section doesn't participate in the scroll

**2. Wider import dialog**
- Change `sm:max-w-2xl` to `sm:max-w-4xl` on the `DialogContent` so the preview table columns are fully visible

**3. Fix dialog overlay coverage**
- The screenshot shows content bleeding through the dialog background. This is likely because the dialog's overlay isn't covering the full viewport. Add `className="z-50"` to ensure proper stacking, and verify the `DialogContent` has proper background styling (add `bg-background` if missing)

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/FounderPool.tsx` | Add `shrink-0` to header/search wrapper; widen dialog to `sm:max-w-4xl`; fix overlay z-index |

