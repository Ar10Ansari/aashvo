# Aashvo — Test Strategy & Quality Assurance Framework

**Version:** 1.0.0  
**Lead:** QA Engineer & Principal Architect  

---

## 1. Quality Gates & Continuous Verification

Every stage of code development must satisfy the following Quality Gates:

```
[Lint & Code Style] ──► [TypeScript Strict Check] ──► [Unit & Component Tests]
         │
         ▼
[Vite Production Build] ──► [Automated Browser Agent Validation] ──► [Accessibility & A11y]
```

1. **Gate 1: TypeScript Strict Mode (`tsc --noEmit`)**
   - Zero unresolved type errors, no unsafe `any` leaks in core domain models.
2. **Gate 2: Production Build Integrity (`npm run build`)**
   - Clean compilation into `dist/` with zero missing module references.
3. **Gate 3: Browser Subagent Visual & Functional Inspection**
   - Validate desktop (1280px+) and mobile (375px–414px) viewports.
   - Verify hero typography rendering, landscape illustration positioning, search filtering responsiveness, modal popups, and drawer transitions.
4. **Gate 4: Accessibility & Contrast**
   - Contrast ratio for text >= 4.5:1 against Warm Ivory (`#F5F3ED`) background.
   - All interactive controls (buttons, links, inputs) have accessible labels or ARIA tags.
   - Respects `prefers-reduced-motion` media query.

---

## 2. Test Execution Matrix

| Test Suite | Scope | Target Metrics |
| :--- | :--- | :--- |
| **Unit / Logic** | Currency formatters, freshness calculators, filtering logic. | 100% pass on edge cases (0 rent, missing photos, old dates). |
| **Component UI** | PropertyCard, FlatmateCard, HeroSearch, CostBreakdownModal. | Renders in loading, empty, and populated states without layout shifts. |
| **E2E User Flows** | 1. Filter places by budget & locality.<br>2. Open property detail modal.<br>3. Send interest request.<br>4. Submit new listing via wizard.<br>5. Moderate listing in admin view. | Completed end-to-end without console errors. |
| **Visual QA** | Compare live render against editorial design guidelines. | Warm ivory canvas, forest green accents, refined serif headlines, architectural landscape. |
