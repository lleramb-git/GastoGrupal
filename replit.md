# Gastos Compartidos (Shared Expenses)

## Overview

This is a full-stack expense tracking and splitting application built with React, Express, and PostgreSQL. The application allows users to track shared expenses, manage participants, and automatically calculate debt settlements between users. It features a calendar-based interface for viewing expenses by date and provides real-time summaries of who owes whom.

The application uses a modern tech stack with Vite for frontend bundling, Drizzle ORM for database management, and shadcn/ui components for a polished user interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling:**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server
- **Wouter** for lightweight client-side routing (single-page application with Dashboard and NotFound routes)
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**UI Component System:**
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with CSS variables for theming
- Custom design system with light/dark mode support using CSS custom properties
- Component path aliases configured (`@/components`, `@/lib`, etc.)

**State Management Strategy:**
- Server state managed via React Query with queries for users, expenses, debts, and statistics
- Form state handled by React Hook Form with Zod schema validation
- UI state (date selection, calendar navigation) managed with local React state
- No global state management library - relies on React Query's cache and local state

**Key Frontend Components:**
- **Calendar**: Interactive month view showing expense indicators
- **ExpenseForm**: Multi-step form with participant selection and flexible split options (equal, percentage, exact amounts)
- **DailyExpenses**: List view of expenses for selected date
- **DebtSummary**: Real-time calculation and display of settlements between users

### Backend Architecture

**Server Framework:**
- **Express.js** with TypeScript running on Node.js
- ESM module system throughout the codebase
- Custom Vite middleware integration for development HMR

**API Design:**
- RESTful API endpoints under `/api` prefix
- Request/response logging middleware with duration tracking
- JSON body parsing with raw body preservation for potential webhook integrations
- Error handling with appropriate HTTP status codes

**Database Layer:**
- **Drizzle ORM** for type-safe database interactions
- **Neon Serverless PostgreSQL** as the database provider
- Connection pooling via Neon's HTTP interface
- Database schema defined in shared TypeScript files for frontend/backend consistency

**Storage Pattern:**
- Interface-based storage abstraction (`IStorage`) for potential future provider swapping
- `DatabaseStorage` class implementing all data access logic
- Business logic methods for debt calculations and statistics aggregation

### Data Model

**Core Entities:**

1. **Users Table:**
   - `id` (UUID, auto-generated)
   - `name` (text)
   - `initials` (text) - for avatar display
   - `color` (text) - for UI differentiation
   - `createdAt` (timestamp)

2. **Expenses Table:**
   - `id` (UUID, auto-generated)
   - `description` (text)
   - `amount` (decimal 10,2)
   - `payerId` (UUID, foreign key to users)
   - `date` (timestamp)
   - `createdAt` (timestamp)

3. **Expense Participants Table:**
   - `id` (UUID, auto-generated)
   - `expenseId` (UUID, foreign key to expenses)
   - `userId` (UUID, foreign key to users)
   - `amount` (decimal 10,2) - individual share amount

**Relationships:**
- One-to-many: User to Expenses (as payer)
- Many-to-many: Users to Expenses through ExpenseParticipants
- Joined queries return denormalized `ExpenseWithDetails` objects with nested user and participant data

**Validation:**
- Zod schemas generated from Drizzle table definitions using `drizzle-zod`
- Schema validation on both frontend forms and backend API endpoints
- Type safety enforced across shared schema definitions

### External Dependencies

**Database:**
- **Neon Serverless PostgreSQL** - Cloud-native PostgreSQL with HTTP API
  - Accessed via `@neondatabase/serverless` package
  - Connection string provided through `DATABASE_URL` environment variable
  - Development mode disables SSL certificate validation

**ORM & Migrations:**
- **Drizzle ORM** (`drizzle-orm`) for database queries and type generation
- **Drizzle Kit** for schema migrations and database push operations
- Migration files stored in `/migrations` directory

**UI Components & Styling:**
- **Radix UI** primitives for accessible component foundation
- **Tailwind CSS** with PostCSS for build-time processing
- **date-fns** for date manipulation and formatting with Spanish locale support
- **Lucide React** for icon components

**Form Management:**
- **React Hook Form** for performant form state management
- **@hookform/resolvers** for Zod schema integration
- **Zod** for runtime validation and type inference

**Development Tools:**
- **Replit-specific plugins** for cartographer and dev banner (conditional on REPL_ID)
- **tsx** for TypeScript execution in development
- **esbuild** for server-side production bundling

**Build & Deployment:**
- Frontend built to `dist/public` via Vite
- Backend bundled to `dist/index.js` via esbuild with external package references
- Static asset serving in production mode via Express

**Session Management:**
- **connect-pg-simple** included for PostgreSQL-backed session storage (though authentication not currently implemented)