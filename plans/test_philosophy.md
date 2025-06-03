# Practical Testing Guide - Yam Platform

## Core Testing Philosophy

Focus on what breaks most: authentication, permissions, data integrity, and critical user paths. Skip testing library components and obvious functionality.

## Priority 1: Smoke Tests (Run on Every Commit)

```bash
tests/smoke/
├── auth.smoke.test.ts         # Can users log in?
├── package-flow.smoke.test.ts  # Register → Search → Pickup
└── api-health.smoke.test.ts    # Are critical APIs responding?
```

**Coverage:** 5-minute test suite covering the absolute essentials

## Priority 2: API Contract Tests

```bash
tests/contracts/
├── package-api.contract.test.ts
├── resident-api.contract.test.ts
├── auth-api.contract.test.ts
└── shared-types.contract.test.ts
```

**Key Tests:**

- Response shape validation using Zod schemas
- Required vs optional fields
- Backwards compatibility checks
- Frontend/backend type alignment

## Priority 3: Critical Business Logic

```bash
tests/unit/
├── auth/
│   ├── session-handling.test.ts
│   ├── role-permissions.test.ts
│   └── invitation-flow.test.ts
├── packages/
│   ├── package-queue.test.ts      # Queue number assignment
│   ├── email-notifications.test.ts 
│   └── bulk-operations.test.ts
└── data/
    ├── roster-upload.test.ts       # Complex parsing logic
    ├── resident-matching.test.ts   # Deduplication logic
    └── stats-aggregation.test.ts
```

**Skip:** UI component tests, simple getters/setters, library wrappers

## Priority 4: E2E Critical Paths

```bash
cypress/e2e/critical/
├── 01-user-package-lifecycle.cy.ts
│   # Login → View packages → Pickup
├── 02-staff-package-lifecycle.cy.ts
│   # Login → Register → Email sent → Package appears
├── 03-manager-operations.cy.ts
│   # Roster upload → User invite → Settings change
└── 04-multi-tenant-isolation.cy.ts
    # Verify org A can't see org B data
```

**Key Scenarios:**

- Happy paths for each user role
- Most common error recovery (duplicate package, missing resident)
- Permission boundaries
- Session timeout handling

## Priority 5: Integration Tests (API + DB)

```bash
tests/integration/
├── package-lifecycle.test.ts    # Full package flow with real DB
├── user-permissions.test.ts     # Role-based access with real auth
├── email-delivery.test.ts       # Email service integration
└── file-upload.test.ts         # Large file handling
```

**Focus:** Test boundaries between systems, not internal implementation

## Priority 6: Regression Prevention

```bash
tests/regression/
├── visual/                      # Percy or similar
│   ├── package-list.visual.ts
│   ├── forms.visual.ts
│   └── responsive.visual.ts
├── performance/
│   ├── large-datasets.perf.ts  # 1000+ packages load time
│   └── file-upload.perf.ts     # 10MB file upload
└── backwards-compat/
    └── api-versions.test.ts     # Old API formats still work
```

**Performance Budgets:**

- Package list: <2s for 1000 items
- Page load: <3s on 3G
- File upload: <10s for 10MB

## Test Data Strategy

```bash
tests/fixtures/
├── seed-test-db.ts              # Minimal data for tests
├── factories/
│   ├── package.factory.ts       # Generate test packages
│   ├── resident.factory.ts      # Generate test residents
│   └── org.factory.ts          # Generate test orgs
└── scenarios/
    ├── empty-mailroom.json
    ├── busy-mailroom.json       # 1000+ packages
    └── multi-org.json          # Complex hierarchy
```

## What NOT to Test

- Library components (buttons, inputs, modals)
- Simple prop passing
- CSS classes
- Getters/setters without logic
- Third-party integrations beyond the integration point

## Failure Scenarios to Cover

```bash
tests/failure-scenarios/
├── supabase-outage.test.ts      # Graceful degradation
├── email-service-down.test.ts   # Queue for retry
├── concurrent-package-pickup.test.ts
└── session-expiry-during-operation.test.ts
```

## CI/CD Test Execution

```bash
# Every commit (5 mins)
pnpm test:smoke

# Every PR (15 mins)
pnpm test:smoke
pnpm test:contracts
pnpm test:unit:critical

# Before deploy (30 mins)
pnpm test:all
pnpm test:e2e:critical

# Nightly (2 hours)
pnpm test:e2e:full
pnpm test:performance
pnpm test:visual
```

## Maintenance Guidelines

1. **Delete tests that never fail** - They're not testing anything useful
2. **Fix flaky tests immediately** or delete them
3. **Keep E2E tests simple** - Complex E2E tests break often
4. **Mock at service boundaries** not individual functions
5. **Use factories** not static fixtures
6. **Test behavior** not implementation

## Coverage Targets

- **Critical Paths:** 100% E2E coverage
- **Business Logic:** 80% unit coverage
- **API Contracts:** 100% coverage
- **Overall:** Don't chase numbers, chase confidence

## Quick Start Commands

```bash
# Developer daily workflow
pnpm test:watch     # Unit tests in watch mode
pnpm test:smoke     # Before pushing

# Debugging failures
pnpm test:debug     # Run with debugger
pnpm cypress:open   # Debug E2E visually

# Full validation
pnpm test:ci        # What CI runs
```

## Test Review Checklist

- [ ] Does this test prevent a real bug we've seen?
- [ ] Will this test fail if someone breaks the feature?
- [ ] Is this the simplest way to test this?
- [ ] Can this be covered by a higher-level test?
- [ ] Will this test be maintainable in 6 months?
