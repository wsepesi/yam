# Test Strategy - Yam Mailroom Platform

## Executive Summary

**CURRENT STATUS: TEST SUITE BROKEN** ❌

The test suite exists but is non-functional due to incomplete mock implementations. Critical blockers:
- Supabase mock missing `createAdminClient` export
- Nodemailer mock missing `default` export
- Test environment setup incomplete

Test coverage prioritized by business impact and technical risk. Focus on multi-tenant security, package lifecycle integrity, and critical user journeys. Avoid over-testing UI components and third-party libraries.

## Testing Principles

1. **Test behavior, not implementation**
2. **Multi-tenant isolation is non-negotiable**  
3. **Package data integrity is critical**
4. **Performance at scale matters**
5. **Security failures are catastrophic**

## Test Pyramid Strategy

### Level 0: Smoke Tests (2-3 minutes, every commit)
**Purpose:** Catch basic breakage before code review
**Coverage:** Essential user flows only

### Level 1: API Contracts (5 minutes, every PR)  
**Purpose:** Prevent breaking changes and type mismatches
**Key validations:** Request/response schemas with Zod, required vs optional fields, error response formats, authentication headers

### Level 2: Business Logic (10 minutes, every PR)
**Purpose:** Validate core domain logic
**Skip:** Simple getters, UI prop passing, library wrappers

### Level 3: Integration Tests (15 minutes, before deploy)
**Purpose:** Test system boundaries and external services

### Level 4: E2E Critical Paths (20 minutes, before deploy)
**Purpose:** Validate complete user journeys
**Each test includes:** Happy path scenario, common error recovery, mobile responsiveness check

## Domain-Specific Test Focus Areas

### Package Management Critical Tests
- **Package ID recycling system:** 1-999 assignment and recycling, concurrent creation safety, failed package cleanup, queue initialization
- **Multi-tenant package isolation:** Mailroom-scoped data access, organization boundaries, bulk operation safety
- **Email notification system:** Template rendering, mailroom customization, failure logging, service outage handling

### Multi-Tenant Security Critical Tests  
- **Organization isolation:** Cross-org data access prevention, URL manipulation protection, RLS enforcement
- **Mailroom isolation:** Manager access boundaries, package data scoping, settings isolation
- **Role-based permissions:** Function access control, privilege escalation prevention, cross-org admin restrictions

### Data Integrity Critical Tests
- **Roster upload handling:** Large file processing, duplicate detection, rollback on failure, ID format preservation
- **Resident matching algorithms:** Exact matching, fuzzy matching, email-based updates, case handling

### Performance & Scale Critical Tests
- **Load benchmarks:** Package lists <2s (1000+ items), resident search <500ms, file uploads <30s (10MB+)
- **Concurrency testing:** Multiple users, large datasets, memory usage monitoring

## Test Data Strategy

### Factories (Preferred)
```typescript
// tests/factories/
createPackage({ status: 'WAITING', mailroomId: 'test-mailroom' })
createResident({ mailroomId: 'test-mailroom', studentId: '12345' })
createOrganization({ slug: 'test-org', status: 'ACTIVE' })
createMailroom({ orgId: 'test-org', slug: 'test-mailroom' })
```

### Scenarios (For E2E)
```json
// tests/scenarios/busy-mailroom.json
{
  "residents": 500,
  "packages": { "waiting": 50, "retrieved": 200 },
  "users": { "managers": 2, "staff": 5 }
}
```

## Critical Failure Scenarios

### Service Outages
- **Database unavailable:** Graceful degradation with user feedback, retry mechanisms, data preservation
- **Email service down:** Queue packages for retry, alternative notification methods, manual workflows

### Concurrent Operations  
- **Package ID conflicts:** Simultaneous registration, pickup during processing, bulk vs individual operations
- **Data race conditions:** Resident creation during upload, settings updates during processing, role changes during sessions

## Implementation Strategy

### Week 1-2: Foundation & Security
1. **IMMEDIATE**: Fix broken mock implementations
   - Fix supabase.mock.ts (add createAdminClient export)
   - Fix nodemailer mock (add default export)
   - Complete test environment database setup
2. Test infrastructure setup (factories, mocks, CI) ⚠️ **PARTIALLY COMPLETE**
3. Smoke tests for core flows ❌ **BROKEN**
4. Multi-tenant isolation and role-based permission tests ❌ **BROKEN**
5. API contract tests for critical endpoints ❌ **BROKEN**

### Week 3-4: Business Logic & Integration
1. Package lifecycle and ID management tests
2. Email notification system validation
3. Roster upload and data processing tests
4. Integration tests for external services
5. E2E critical path coverage

## Quality Gates & Success Metrics

### Coverage Targets
- **Critical paths:** 100% E2E coverage
- **API contracts:** 100% coverage  
- **Business logic:** 85% unit coverage
- **Multi-tenant security:** 100% coverage

### Performance Targets
- **Package operations:** <1s standard operations
- **Search/filter:** <500ms response time
- **File uploads:** <30s for 10MB files
- **Page loads:** <3s on 3G connection

### CI/CD Integration
- **Commit level:** Smoke tests pass, no security failures ❌ **CURRENTLY FAILING**
- **PR level:** Contracts + core unit tests pass, no performance regression >10% ❌ **CURRENTLY FAILING**
- **Deploy level:** Full suite passes, E2E critical paths verified ❌ **CURRENTLY FAILING**

**BLOCKER**: All CI/CD gates are currently failing due to broken test mocks

## Maintenance Philosophy

### Weekly Reviews
- Fix flaky tests immediately (or delete them)
- Review test execution times for optimization
- Update test data to reflect production reality

### Monthly Audits  
- Remove tests that never fail
- Add tests for newly reported bugs
- Review performance benchmarks
- Assess security test coverage gaps

### Emergency Procedures
- **Test suite broken:** Disable flaky tests temporarily, fix critical paths first
- **Performance regression:** Profile operations, compare with baselines, implement fixes with tests
- **Security issue:** Create immediate test to verify fix, expand coverage, review similar vulnerabilities