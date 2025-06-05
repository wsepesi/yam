# Yam Development Roadmap

This document outlines the development priorities for the Yam mailroom management platform, stack-ranked by impact on service functionality, maintainability, and production scalability.

## Priority 0: Foundation (Immediate)

### 1. ❌ **BROKEN** Test Suite Completion
**Impact**: Maintainability (Critical), Scaling (High)
**STATUS**: Test suite is currently broken due to incomplete mock implementations
- **CRITICAL**: Fix supabase mock (missing createAdminClient export)
- **CRITICAL**: Fix nodemailer mock (missing default export)
- **CRITICAL**: Complete test environment setup with database isolation
- Complete smoke tests for auth, package lifecycle, API health
- Implement API contract tests with Zod schemas
- Add integration tests for critical business logic
- Expand E2E coverage for all user roles
- Add security tests for authorization vulnerabilities
**Timeline**: 2-3 weeks (BLOCKED until mocks fixed)

## Priority 1: Critical Fixes (This Month)

### 2. 🔒 API Authorization & Security
**Impact**: Service (Critical), Scaling (Critical)
- Add authorization checks to package API endpoints
- Ensure users can only access their assigned mailroom data
- Fix invitation expiration validation in registration flow
- Add rate limiting to sensitive endpoints
**Timeline**: 1 week

### 3. 🚨 Fix User Ban/Management
**Impact**: Service (High), Maintainability (Medium)
- Replace hard deletion with soft delete (status-based banning)
- Fix cascading deletion issues that break DB links
- Preserve user data while preventing access
- Add user promotion/demotion actions
- Implement proper status management (ACTIVE, REMOVED, BANNED, etc.)
**Timeline**: 3-4 days

### 4. 📱 Mobile Responsiveness
**Impact**: Service (High), Scaling (High)
- Fix fixed layouts breaking on mobile devices
- Add horizontal scrolling to tables
- Implement responsive navigation
- Fix overlapping alerts on small screens
**Timeline**: 1 week

### 5. 🎯 Cascading Deletion Pattern Fix
**Impact**: Maintainability (High), Service (Medium)
- Change auth table deletion cascading pattern
- Ensure data integrity when users are removed
- Add soft delete options where appropriate
**Timeline**: 2-3 days

## Priority 2: Core Features (Next 4-6 Weeks)

### 6. 📦 Bulk Package Performance
**Impact**: Service (High), Scaling (High)
- Convert sequential package pickup to parallel processing
- Optimize individual package operations (currently ~1s each)
- Add database indexes for common queries
- Implement batch processing for DB operations
- Add progress indicators for bulk operations
- General speed profiling and optimization
**Timeline**: 1 week

### 7. 👥 Invitation System Enhancement
**Impact**: Service (High), Maintainability (Medium)
- Fix resend invitation to existing users (currently fails)
- Allow updating invitation email without creating new user
- Clean up orphaned invitations when users are deleted
- Add resend invitation button in UI
- Implement invitation management UI
- Add bulk invitation capability
**Timeline**: 3-4 days

### 8. 🎨 UI/UX Polish
**Impact**: Service (Medium), Maintainability (Low)
- Fix spacing inconsistencies across the app
- Implement proper skeleton loaders
- Add breadcrumb navigation
- Improve form validation feedback
**Timeline**: 1 week

### 9. 📊 Import Historical Data (Cobeen)
**Impact**: Service (Medium), Scaling (Low)
- Build import tool for MongoDB to Supabase migration
- Map legacy Cobeen mailroom data to current schema
- Add data validation and transformation logic
- Create rollback mechanism for failed imports
- Handle resident matching and deduplication
**Timeline**: 3-4 days

## Priority 3: Platform Improvements (Next 2-3 Months)

### 10. 🧹 Code Quality & Best Practices
**Impact**: Maintainability (High), Scaling (Medium)
- Fix linting configuration and errors
- Clean up unnecessary comments
- Review and fix useState/useEffect patterns
- Add Error Boundaries for graceful error handling
- Implement proper loading states
**Timeline**: 1-2 weeks

### 11. 🔍 Search & Filtering Enhancement
**Impact**: Service (High), Scaling (Medium)
- Add global search functionality
- Implement advanced filtering options
- Add saved searches/filters
- Improve package search performance
**Timeline**: 1-2 weeks

### 12. 📧 Notification System Expansion
**Impact**: Service (High), Scaling (Medium)
- Add in-app notifications
- Implement notification preferences
- Add package aging reminders
- Create notification queue for reliability
**Timeline**: 2 weeks

### 13. 📈 Analytics & Reporting
**Impact**: Service (High), Scaling (Low)
- Add date range selectors to dashboards
- Implement custom report builder
- Add export capabilities for charts
- Create scheduled reports feature
**Timeline**: 2-3 weeks

## Priority 4: Long-term Platform Evolution (3-6 Months)

### 14. 📬 Migrate to Resend
**Impact**: Maintainability (Medium), Scaling (High)
- Replace Nodemailer with Resend
- Implement email templates in Resend
- Add email analytics and tracking
- Improve email deliverability
**Timeline**: 1-2 weeks

### 15. 🚀 Migrate to App Router
**Impact**: Maintainability (High), Scaling (High)
- Incrementally migrate pages to app directory
- Implement React Server Components
- Update data fetching patterns
- Improve performance with streaming
**Timeline**: 4-6 weeks

### 16. 🔌 External Integrations
**Impact**: Service (High), Scaling (High)
- Add carrier tracking API integrations
- Implement barcode/QR code scanning
- Add webhook support for custom integrations
- Create public API with documentation
**Timeline**: 3-4 weeks

### 17. ♿ Accessibility Compliance
**Impact**: Service (Medium), Scaling (Medium)
- Add comprehensive ARIA labels
- Implement keyboard navigation
- Ensure WCAG compliance
- Add screen reader support
**Timeline**: 2-3 weeks

## Continuous Improvements

### Performance Monitoring
- Implement APM (Application Performance Monitoring)
- Add database query optimization
- Set up performance budgets
- Monitor Core Web Vitals

### Security Enhancements
- Add two-factor authentication
- Implement audit logging
- Add session timeout warnings
- Regular security audits

### Developer Experience
- Improve local development setup
- Add development documentation
- Create component library documentation
- Implement design system

## Success Metrics

- **Test Coverage**: >80% for critical paths
- **Page Load Time**: <3s on 3G
- **API Response Time**: <200ms p95
- **Mobile Usage**: Support 100% of core features
- **Error Rate**: <0.1% for critical operations

## Notes

- Items marked with ❌ are **BROKEN** and need immediate attention
- Items marked with ✅ are completed
- **CRITICAL BLOCKER**: Test suite must be fixed before autonomous editing
- Timeline estimates assume 1 developer
- Long-term items can be parallelized with immediate priorities
- Regular re-prioritization based on user feedback and metrics

## Current Blockers

### Priority 0 (IMMEDIATE)
1. **Fix test mocks** - supabase.mock.ts missing createAdminClient, nodemailer mock missing default export
2. **Complete test environment setup** - database isolation and cleanup between tests
3. **Validate smoke tests pass** - ensure basic functionality works before proceeding