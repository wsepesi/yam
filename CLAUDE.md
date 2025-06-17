# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
pnpm i              # Install dependencies
pnpm run build      # Build the application
pnpm run dev        # Start development server at http://localhost:3000
```

### Testing Commands
```bash
# Unit/Integration Tests (Vitest)
pnpm test              # Run all unit tests
pnpm test:ui           # Run tests with interactive UI
pnpm test:coverage     # Generate coverage report

# E2E Tests (Cypress)
pnpm test:e2e          # Run E2E tests headlessly (requires .env.test)
pnpm test:e2e:open     # Open Cypress interactive mode

# Combined Testing
pnpm test:ci           # Start dev server and run unit tests
pnpm test:ci:full      # Start dev server and run all tests (unit + E2E)
```

### Running Single Tests
```bash
# Run specific test file
pnpm test path/to/test.test.ts

# Run tests matching pattern
pnpm test -t "pattern"

# Debug mode
pnpm test:debug
```

## Memory Entries

- `pnpm test` does not need a --run suffix

## Architecture Overview

### Multi-Tenant Structure
The application follows a hierarchical multi-tenant architecture:
- **Super Admin** → manages entire system
- **Organizations** → contain multiple mailrooms
- **Mailrooms** → contain users and packages
- **Users** → have roles: user, manager, admin

### Authentication & Authorization
- **NextAuth.js** handles authentication with JWT strategy
- **Supabase** provides database and auth adapter
- **Role-based access control** via `profiles` table
- **Protected routes** using `withAuth` HOC that validates:
  - User authentication status
  - Role permissions
  - Organization/mailroom assignment matches URL slugs

### Dynamic Routing Pattern
```
/[org]/[mailroom]/[[...tab]]
```
- Organization and mailroom use URL slugs (not IDs)
- Tab navigation persists in URL for state management
- Non-admins restricted to their assigned org/mailroom

### Package Management Flow
1. Staff registers package → assigns recycled ID (1-999)
2. System sends email notification to resident
3. Resident views package in their portal
4. Staff completes pickup process
5. Package ID returns to queue for reuse

### Database Architecture (Supabase)
- **Row Level Security (RLS)** enforces data isolation
- **Package ID queue** system (1-999) with recycling
- **Key tables**: organizations, mailrooms, profiles, residents, packages
- **Helper functions** for auth checks and package number management

### API Pattern
All API routes follow consistent patterns:
- Located in `pages/api/`
- Use `handleSession` for auth validation
- Return consistent response shapes
- Include proper error handling

### Testing Strategy
Follow the test philosophy in `plans/test_philosophy.md`:
1. **Smoke tests** - 5-minute essentials
2. **API contracts** - Response validation
3. **Critical business logic** - Auth, packages, data processing
4. **E2E critical paths** - User journeys
5. **Integration tests** - System boundaries

### Key Utilities
- `lib/supabase.ts` - Database client with RLS
- `lib/handleSession.ts` - Auth validation for API routes
- `lib/utils.ts` - Helper functions (getOrgId, getUserRole, etc.)
- `context/AuthContext.tsx` - React auth context

### UI Components
- Uses Radix UI primitives with custom styling
- Components in `components/ui/` are base primitives
- Tab-specific components organized by user type:
  - `adminTabs/` - System administration
  - `orgTabs/` - Organization management
  - `mailroomTabs/` - Daily operations

### State Management
- React Context for auth state
- URL parameters for navigation state
- Session storage for tab persistence
- Server-side data fetching in pages

### Email System
- Nodemailer for sending notifications
- Email templates configured per mailroom
- Queue system for failed deliveries

## Important Patterns

### Adding New API Endpoints
1. Create route in `pages/api/`
2. Use `handleSession` for auth
3. Validate role permissions
4. Follow existing response patterns

### Adding New Tabs
1. Add tab configuration to respective component
2. Update role-based visibility logic
3. Create tab component in appropriate directory
4. Handle URL routing in `[[...tab]].tsx`

### Working with Packages
- Always use `get_next_package_number()` for new IDs
- Release package numbers with `release_package_number()`
- Check package status before operations
- Log failed packages for resolution

### Database Queries
- Use Supabase client from `lib/supabase.ts`
- RLS automatically filters by user's org/mailroom
- Use proper error handling with typed responses
- Prefer RPC functions for complex operations

## Environment Setup

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GITHUB_ID` / `GITHUB_SECRET` (for github actions)

## Common Gotchas

1. **Package IDs** are recycled - never assume sequential ordering
2. **Slugs not IDs** - URLs use organization/mailroom slugs
3. **Role checks** - Always validate both in HOCs and API routes
4. **Email failures** - System continues but logs for manual resolution
5. **Tab state** - Persisted in URL and session storage
6. **Supabase RLS** - Queries automatically filtered by user context

## useEffect Guidelines

Follow the guidelines in `claude/useeffect-guidelines.md`:
- DON'T use Effects for: derived state, user events, state chains
- DO use Effects for: external systems, data fetching, subscriptions
- Prefer: calculate during render, event handlers, useMemo for expensive calculations

## Workflow Guidelines

- Always update plan files after doing work
- After you make code changes, if we are working towards a plan.md file, ALWAYS write your work back and make sure the plan is up to date!

## Tools and Libraries

- To use Supabase, you must run commands with `pnpx supabase ...`