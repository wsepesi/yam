# Complete Test Plan - Yam Platform

## Priority 1: Smoke Tests (Run on Every Commit)

### Authentication & Session Smoke Tests
- [ ] **Basic Login Flow** (`tests/smoke/auth.smoke.test.ts`)
  - [ ] User can login with valid credentials
  - [ ] User cannot login with invalid credentials
  - [ ] Session persists across page refresh
  - [ ] User can logout successfully
  - [ ] Session expires after timeout

### Critical User Path Smoke Tests
- [ ] **Package Lifecycle Smoke** (`tests/smoke/package-flow.smoke.test.ts`)
  - [ ] Staff can register a new package
  - [ ] Package appears in user's package list
  - [ ] User can mark package as picked up
  - [ ] Package status updates correctly
  - [ ] Email notification sends successfully

### API Health Smoke Tests
- [ ] **Critical API Health** (`tests/smoke/api-health.smoke.test.ts`)
  - [ ] `/api/get-packages` responds within 2s
  - [ ] `/api/add-package` responds within 2s
  - [ ] `/api/get-residents` responds within 2s
  - [ ] `/api/users/mailroom` responds within 2s
  - [ ] Database connection is healthy

## Priority 2: API Contract Tests

### Authentication API Contracts
- [ ] **Auth API Contracts** (`tests/contracts/auth-api.contract.test.ts`)
  - [ ] Login response matches expected schema
  - [ ] Session token format validation
  - [ ] User profile response schema validation
  - [ ] Role-based permission response validation

### Package Management API Contracts
- [ ] **Package API Contracts** (`tests/contracts/package-api.contract.test.ts`)
  - [ ] GET `/api/get-packages` response schema
  - [ ] POST `/api/add-package` request/response schema
  - [ ] PUT `/api/log-package` request/response schema
  - [ ] DELETE `/api/remove-package` request/response schema
  - [ ] GET `/api/packages/get-current` response schema
  - [ ] GET `/api/packages/get-retrieved` response schema
  - [ ] POST `/api/fail-package` request/response schema

### Resident Management API Contracts
- [ ] **Resident API Contracts** (`tests/contracts/resident-api.contract.test.ts`)
  - [ ] GET `/api/get-residents` response schema
  - [ ] POST `/api/add-resident` request/response schema
  - [ ] DELETE `/api/remove-resident` request/response schema
  - [ ] POST `/api/upload-roster` request/response schema

### User Management API Contracts
- [ ] **User API Contracts** (`tests/contracts/user-api.contract.test.ts`)
  - [ ] GET `/api/users/mailroom` response schema
  - [ ] PUT `/api/users/[id]/status` request/response schema
  - [ ] GET `/api/managers` response schema
  - [ ] PUT `/api/managers/[id]` request/response schema

### Organization & Mailroom API Contracts
- [ ] **Org/Mailroom API Contracts** (`tests/contracts/org-mailroom-api.contract.test.ts`)
  - [ ] POST `/api/organizations/create` request/response schema
  - [ ] POST `/api/mailrooms/create` request/response schema
  - [ ] GET `/api/get-org-overview-stats` response schema
  - [ ] GET `/api/get-system-overview-stats` response schema

### Settings & Configuration API Contracts
- [ ] **Settings API Contracts** (`tests/contracts/settings-api.contract.test.ts`)
  - [ ] GET `/api/mailroom/get-settings` response schema
  - [ ] PUT `/api/mailroom/update-settings` request/response schema
  - [ ] PUT `/api/mailroom/update-email-settings` request/response schema
  - [ ] GET `/api/mailroom/settings` response schema

### Invitation API Contracts
- [ ] **Invitation API Contracts** (`tests/contracts/invitation-api.contract.test.ts`)
  - [ ] POST `/api/invitations/create` request/response schema
  - [ ] GET `/api/invitations` response schema
  - [ ] DELETE `/api/invitations/[id]` response schema

### Shared Types Contract Tests
- [ ] **Type Validation** (`tests/contracts/shared-types.contract.test.ts`)
  - [ ] Package interface matches API responses
  - [ ] Resident interface matches API responses
  - [ ] UserProfile interface matches API responses
  - [ ] Organization interface matches API responses
  - [ ] Mailroom interface matches API responses

## Priority 3: Critical Business Logic Unit Tests

### Authentication & Authorization Logic
- [ ] **Session Handling** (`tests/unit/auth/session-handling.test.ts`)
  - [ ] Session creation and validation
  - [ ] Token expiration handling
  - [ ] Session refresh logic
  - [ ] Cross-tab session synchronization

- [ ] **Role Permissions** (`tests/unit/auth/role-permissions.test.ts`)
  - [ ] User role can only access user functions
  - [ ] Manager role can access user + manager functions
  - [ ] Admin role can access user + manager + admin functions
  - [ ] Super-admin role can access all functions
  - [ ] Cross-organization permission boundaries
  - [ ] Mailroom-specific permission scoping

- [ ] **Invitation Flow** (`tests/unit/auth/invitation-flow.test.ts`)
  - [ ] Invitation creation with proper permissions
  - [ ] Invitation expiration logic
  - [ ] Role assignment validation
  - [ ] Duplicate invitation prevention
  - [ ] Cross-organization invitation restrictions

### Package Management Logic
- [ ] **Package Queue Management** (`tests/unit/packages/package-queue.test.ts`)
  - [ ] Package creation with auto-generated IDs
  - [ ] Package status state transitions
  - [ ] Package pickup flow validation
  - [ ] Package failure handling
  - [ ] Duplicate package detection

- [ ] **Email Notifications** (`tests/unit/packages/email-notifications.test.ts`)
  - [ ] Email template rendering with resident data
  - [ ] Email sending trigger conditions
  - [ ] Email retry logic on failure
  - [ ] Mailroom-specific email customization
  - [ ] Email queue management

- [ ] **Bulk Operations** (`tests/unit/packages/bulk-operations.test.ts`)
  - [ ] Bulk package creation
  - [ ] Bulk package status updates
  - [ ] Bulk package removal
  - [ ] Transaction rollback on partial failure

### Data Management Logic
- [ ] **Roster Upload Processing** (`tests/unit/data/roster-upload.test.ts`)
  - [ ] Excel file parsing accuracy
  - [ ] CSV file parsing accuracy
  - [ ] Invalid file format handling
  - [ ] Missing required field validation
  - [ ] Large file processing (1000+ residents)
  - [ ] Duplicate resident detection during upload

- [ ] **Resident Matching** (`tests/unit/data/resident-matching.test.ts`)
  - [ ] Exact name match logic
  - [ ] Fuzzy name matching algorithm
  - [ ] Email-based matching
  - [ ] Student ID-based matching
  - [ ] Case-insensitive matching
  - [ ] Special character handling

- [ ] **Statistics Aggregation** (`tests/unit/data/stats-aggregation.test.ts`)
  - [ ] Package count calculations by status
  - [ ] Time-based package metrics
  - [ ] Resident activity statistics
  - [ ] Mailroom performance metrics
  - [ ] Organization-wide statistics

### User Management Logic
- [ ] **User Role Management** (`tests/unit/users/role-management.test.ts`)
  - [ ] Role assignment validation
  - [ ] Role change permission checking
  - [ ] User status transitions (INVITED → ACTIVE → REMOVED)
  - [ ] Self-modification prevention
  - [ ] Organization boundary enforcement

- [ ] **User Profile Management** (`tests/unit/users/profile-management.test.ts`)
  - [ ] Profile creation on first login
  - [ ] Profile update validation
  - [ ] Organization assignment logic
  - [ ] Mailroom assignment logic

### Organization & Mailroom Logic
- [ ] **Multi-Tenant Isolation** (`tests/unit/org/tenant-isolation.test.ts`)
  - [ ] Organization data isolation
  - [ ] Mailroom data isolation
  - [ ] Cross-tenant access prevention
  - [ ] Shared resource access validation

- [ ] **Settings Management** (`tests/unit/settings/settings-management.test.ts`)
  - [ ] Mailroom settings validation
  - [ ] Email template customization
  - [ ] Pickup option configuration
  - [ ] Settings inheritance and overrides

### Frontend Component Logic & Rendering
- [ ] **General Component Testing Approach**
  - [ ] Unit and integration tests for key React components using React Testing Library.
  - [ ] Focus on component logic, state management, event handling, user interactions, and conditional rendering.
- [ ] **Key Mailroom Tab Components** (`components/mailroomTabs/`)
  - [ ] `ManageRoster.tsx`: Test resident listing, search/filter, add/remove interactions, roster upload triggering.
  - [ ] `ManagePackages.tsx`: Test package listing, status updates (pickup, fail), search/filter.
  - [ ] `Pickup.tsx`: Test package search, selection, and pickup confirmation logic.
  - [ ] `RegisterPackage.tsx`: Test package registration form logic, resident lookup, and validation.
  - [ ] `ManageSettings.tsx`: Test settings form interaction and updates.
  - [ ] `ManageEmailContent.tsx`: Test email template customization and saving.
- [ ] **Key Organization & Admin Tab Components** (`components/orgTabs/`, `components/adminTabs/`)
  - [ ] `OrgMailroomsTab.tsx` (`components/orgTabs/`): Test mailroom listing, creation dialog trigger.
  - [ ] `AdminOrganizationsTab.tsx` (`components/adminTabs/`): Test organization listing, creation dialog trigger.
  - [ ] Dialogs (e.g., `CreateMailroomDialog.tsx`, `AddResidentDialog.tsx`, `CreateOrganizationDialog.tsx`): Test form inputs, validation, submission, and open/close states.
- [ ] **Shared & Core UI Components**
  - [ ] `components/AutocompleteWithDb.tsx`: Test search functionality, item selection, and data fetching/display.
  - [ ] `components/Layout.tsx`: Test structural integrity, navigation rendering, and slot content display.
  - [ ] `components/ReportName.tsx`: Test name reporting logic and UI interaction.
- [ ] **Higher-Order Components (HOCs)**
  - [ ] `components/withAuth.tsx`: Verify it correctly protects wrapped components, allows access for authenticated users, and redirects unauthenticated users.
  - [ ] `components/withOrgAuth.tsx`: Verify it correctly handles organization-specific access, allowing/denying access based on user's organization membership and roles.
- [ ] **Dynamic Page Component**
  - [ ] `pages/[org]/[mailroom]/[[...tab]].tsx`:
    - [ ] Test correct tab rendering and content display based on dynamic URL parameters (`org`, `mailroom`, `tab`).
    - [ ] Verify appropriate props are passed down to the active tab component.
    - [ ] (Note: While E2E tests will cover its integrated behavior, focused unit/integration tests for its routing logic and conditional rendering are highly valuable).

## Priority 4: End-to-End Critical Paths

### User Package Lifecycle
- [ ] **Complete User Flow** (`cypress/e2e/critical/01-user-package-lifecycle.cy.ts`)
  - [ ] User logs in successfully
  - [ ] User views their package list
  - [ ] User sees new package notification
  - [ ] User marks package as picked up
  - [ ] Package disappears from active list
  - [ ] Package appears in pickup history

### Staff Package Lifecycle
- [ ] **Complete Staff Flow** (`cypress/e2e/critical/02-staff-package-lifecycle.cy.ts`)
  - [ ] Staff logs in successfully
  - [ ] Staff navigates to register tab
  - [ ] Staff registers new package for resident
  - [ ] Email notification is sent
  - [ ] Package appears in packages list
  - [ ] Package can be failed if needed
  - [ ] Package can be removed if needed

### Manager Operations
- [ ] **Complete Manager Flow** (`cypress/e2e/critical/03-manager-operations.cy.ts`)
  - [ ] Manager logs in successfully
  - [ ] Manager uploads resident roster
  - [ ] Manager invites new users
  - [ ] Manager updates mailroom settings
  - [ ] Manager customizes email templates
  - [ ] Manager views package statistics
  - [ ] Manager manages other users

### Admin Operations
- [ ] **Complete Admin Flow** (`cypress/e2e/critical/04-admin-operations.cy.ts`)
  - [ ] Admin logs in successfully
  - [ ] Admin creates new organization
  - [ ] Admin creates new mailroom
  - [ ] Admin assigns managers to mailrooms
  - [ ] Admin views system-wide statistics
  - [ ] Admin manages organization settings

### Multi-Tenant Security
- [ ] **Tenant Isolation** (`cypress/e2e/critical/05-multi-tenant-isolation.cy.ts`)
  - [ ] User A cannot see Organization B data
  - [ ] Manager A cannot access Mailroom B
  - [ ] Admin A cannot access Organization B
  - [ ] API endpoints enforce tenant boundaries
  - [ ] URL manipulation doesn't bypass security

### Error Recovery Scenarios
- [ ] **Common Error Recovery** (`cypress/e2e/critical/06-error-recovery.cy.ts`)
  - [ ] Duplicate package registration handling
  - [ ] Missing resident registration flow
  - [ ] Network timeout recovery
  - [ ] Invalid form submission handling
  - [ ] Session expiry during operation

## Priority 5: Integration Tests (API + Database)

### Package Management Integration
- [ ] **Full Package Lifecycle** (`tests/integration/package-lifecycle.test.ts`)
  - [ ] Package creation → Database storage → Email trigger
  - [ ] Package pickup → Status update → History logging
  - [ ] Package failure → Status update → Notification
  - [ ] Package removal → Database cleanup → Audit trail

### User Permission Integration
- [ ] **Role-Based Access** (`tests/integration/user-permissions.test.ts`)
  - [ ] Database role validation with API endpoints
  - [ ] Organization boundary enforcement
  - [ ] Mailroom access control
  - [ ] Permission caching and invalidation

### Email Delivery Integration
- [ ] **Email Service Integration** (`tests/integration/email-delivery.test.ts`)
  - [ ] Nodemailer configuration validation
  - [ ] Email template rendering with real data
  - [ ] Email delivery confirmation
  - [ ] Failed email retry mechanism
  - [ ] Email service failover

### File Upload Integration
- [ ] **Large File Handling** (`tests/integration/file-upload.test.ts`)
  - [ ] Excel roster upload with 1000+ residents
  - [ ] CSV roster upload processing
  - [ ] File validation and error handling
  - [ ] Memory usage during large uploads
  - [ ] Progress tracking for large files

### Database Operations Integration
- [ ] **Complex Database Operations** (`tests/integration/database-operations.test.ts`)
  - [ ] Multi-table transaction handling
  - [ ] Concurrent access scenarios
  - [ ] Database constraint enforcement
  - [ ] Data integrity validation
  - [ ] Supabase client reliability

## Priority 6: Regression Prevention

### Visual Regression Tests
- [ ] **UI Consistency** (`tests/regression/visual/`)
  - [ ] Package list rendering (`package-list.visual.ts`)
  - [ ] Form layouts and styling (`forms.visual.ts`)
  - [ ] Responsive design validation (`responsive.visual.ts`)
  - [ ] Navigation and tab rendering (`navigation.visual.ts`)
  - [ ] Modal and dialog rendering (`modals.visual.ts`)

### Performance Regression Tests
- [ ] **Performance Benchmarks** (`tests/regression/performance/`)
  - [ ] Large dataset handling (`large-datasets.perf.ts`)
    - [ ] 1000+ packages load time <2s
    - [ ] 5000+ residents load time <3s
    - [ ] Pagination performance
  - [ ] File upload performance (`file-upload.perf.ts`)
    - [ ] 10MB Excel file upload <10s
    - [ ] Progress reporting accuracy
  - [ ] API response times (`api-performance.perf.ts`)
    - [ ] Package listing <1s
    - [ ] Resident search <500ms
    - [ ] Statistics generation <2s

### Backwards Compatibility Tests
- [ ] **API Compatibility** (`tests/regression/backwards-compat/`)
  - [ ] Legacy API format support (`api-versions.test.ts`)
  - [ ] Database schema migration validation
  - [ ] URL structure backwards compatibility
  - [ ] Authentication token compatibility

## Additional Critical Test Categories

### Security Tests
- [ ] **Authentication Security** (`tests/security/auth-security.test.ts`)
  - [ ] SQL injection prevention
  - [ ] XSS attack prevention
  - [ ] CSRF protection validation
  - [ ] Session fixation prevention
  - [ ] Brute force protection

- [ ] **Authorization Security** (`tests/security/authorization-security.test.ts`)
  - [ ] Direct object reference prevention
  - [ ] Privilege escalation prevention
  - [ ] API endpoint authorization
  - [ ] Resource access validation

### Data Validation Tests
- [ ] **Input Validation** (`tests/validation/input-validation.test.ts`)
  - [ ] Email format validation
  - [ ] Name field validation
  - [ ] Student ID validation
  - [ ] File type validation
  - [ ] Size limit enforcement

- [ ] **Business Rule Validation** (`tests/validation/business-rules.test.ts`)
  - [ ] Duplicate prevention rules
  - [ ] Required field enforcement
  - [ ] Logical constraint validation
  - [ ] Cross-field validation rules

### Failure Scenario Tests
- [ ] **Service Outages** (`tests/failure-scenarios/`)
  - [ ] Supabase database outage (`supabase-outage.test.ts`)
    - [ ] Graceful degradation
    - [ ] User feedback
    - [ ] Retry mechanisms
  - [ ] Email service failure (`email-service-down.test.ts`)
    - [ ] Queue for retry
    - [ ] User notification
    - [ ] Alternative communication
  - [ ] Concurrent operations (`concurrent-operations.test.ts`)
    - [ ] Package pickup conflicts
    - [ ] Resident creation conflicts
    - [ ] Role assignment conflicts
  - [ ] Session expiry scenarios (`session-expiry.test.ts`)
    - [ ] Graceful handling mid-operation
    - [ ] Data preservation
    - [ ] Redirect to login

## Test Infrastructure & Utilities

### Test Data Management
- [ ] **Fixtures & Factories** (`tests/fixtures/`)
  - [ ] Database seeding (`seed-test-db.ts`)
  - [ ] Package factory (`factories/package.factory.ts`)
  - [ ] Resident factory (`factories/resident.factory.ts`)
  - [ ] User factory (`factories/user.factory.ts`)
  - [ ] Organization factory (`factories/organization.factory.ts`)
  - [ ] Mailroom factory (`factories/mailroom.factory.ts`)

### Test Scenarios
- [ ] **Scenario Definitions** (`tests/scenarios/`)
  - [ ] Empty mailroom scenario (`empty-mailroom.json`)
  - [ ] Busy mailroom scenario (`busy-mailroom.json`)
  - [ ] Multi-org scenario (`multi-org.json`)
  - [ ] Single-user scenario (`single-user.json`)
  - [ ] Manager-only scenario (`manager-only.json`)

### Mock Services
- [ ] **Service Mocks** (`tests/mocks/`)
  - [ ] Email service mock (`email-service.mock.ts`)
  - [ ] Supabase client mock (`supabase.mock.ts`)
  - [ ] Authentication mock (`auth.mock.ts`)
  - [ ] File upload mock (`file-upload.mock.ts`)

## CI/CD Test Execution Strategy

### Commit-Level Tests (5 minutes)
```bash
pnpm test:smoke
```
- [ ] Authentication smoke tests
- [ ] Package flow smoke tests
- [ ] API health smoke tests

### Pull Request Tests (15 minutes)
```bash
pnpm test:pr
```
- [ ] All smoke tests
- [ ] Critical API contract tests
- [ ] Core business logic unit tests
- [ ] Security tests

### Pre-Deploy Tests (30 minutes)
```bash
pnpm test:deploy
```
- [ ] All unit tests
- [ ] All integration tests
- [ ] Critical E2E paths
- [ ] Performance benchmarks

### Nightly Full Suite (2 hours)
```bash
pnpm test:nightly
```
- [ ] Complete test suite
- [ ] Visual regression tests
- [ ] Extended performance tests
- [ ] Failure scenario tests
- [ ] Security penetration tests

## Test Environment Requirements

### Database Setup
- [ ] Test database with realistic data volumes
- [ ] Database cleanup between test runs
- [ ] Transaction rollback capabilities
- [ ] Test data isolation

### External Service Mocking
- [ ] Email service sandbox
- [ ] File upload simulation
- [ ] Authentication provider mocking
- [ ] Third-party service stubs

### Performance Testing Environment
- [ ] Consistent hardware specifications
- [ ] Network throttling capabilities
- [ ] Load generation tools
- [ ] Monitoring and profiling tools

## Success Criteria

### Code Coverage Targets
- [ ] Critical paths: 100% E2E coverage
- [ ] API contracts: 100% coverage  
- [ ] Business logic: 85% unit coverage
- [ ] Integration points: 90% coverage
- [ ] Overall: 80% line coverage (minimum)

### Performance Targets
- [ ] Package list load: <2s for 1000 items
- [ ] Resident search: <500ms response time
- [ ] File upload: <10s for 10MB files
- [ ] Page load: <3s on 3G connection
- [ ] API response: <1s for standard operations

### Quality Gates
- [ ] Zero critical security vulnerabilities
- [ ] Zero flaky tests in CI
- [ ] 99.5% test pass rate
- [ ] All E2E critical paths passing
- [ ] Performance budgets maintained

## Maintenance Guidelines

### Test Health Monitoring
- [ ] Weekly test execution review
- [ ] Flaky test identification and fixing
- [ ] Performance regression monitoring
- [ ] Test coverage trend analysis

### Test Suite Evolution  
- [ ] Remove tests that never fail
- [ ] Update tests for feature changes
- [ ] Add tests for reported bugs
- [ ] Refactor tests for maintainability

### Documentation Requirements
- [ ] Test plan updates with feature changes
- [ ] Test case documentation
- [ ] Failure investigation guides
- [ ] Environment setup instructions

---

## Quick Reference Commands

```bash
# Development workflow
pnpm test:watch          # Unit tests in watch mode
pnpm test:smoke          # Before pushing commits
pnpm test:debug          # Debug failing tests
pnpm cypress:open        # Debug E2E visually

# CI workflow  
pnpm test:ci             # Full CI test suite
pnpm test:coverage       # Generate coverage report
pnpm test:performance    # Run performance benchmarks

# Specific test categories
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests only
pnpm test:e2e            # E2E tests only
pnpm test:contracts      # API contract tests only
```

## Completion Checklist

When all checkboxes above are completed:
- [ ] Every critical user path is tested end-to-end
- [ ] All API contracts are validated
- [ ] Core business logic is thoroughly unit tested
- [ ] Multi-tenant isolation is verified
- [ ] Performance benchmarks are established
- [ ] Security vulnerabilities are prevented
- [ ] Failure scenarios are handled gracefully
- [ ] Regression protection is in place
- [ ] Test infrastructure is maintainable
- [ ] CI/CD pipeline validates quality gates

**Project Status: FULLY TESTED** ✅ 