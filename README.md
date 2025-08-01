## Attendance Tracking & Scheduling

Manage your academic life seamlessly. Create timetables, track attendance percentage, calculate future needs, and stay organized – all in one place.

<p align="center">
  <img src="https://media.frhn.me/timetable.gif" alt="Project Demo" width="500" />
</p>

## Tech Stack & Architecture

This project is architected as a **monorepo** containing two independent services: a frontend single-page application (SPA) and a backend API. This separation allows for independent development, deployment, and scaling of each part.

### Frontend

-   **Framework**: Vite + React with TypeScript
-   **Styling**: Tailwind CSS with shadcn/ui for a modern, component-based UI.
-   **State Management**: React Query (`@tanstack/react-query`) for server state (caching, fetching, mutations) and Zustand for global UI state (e.g., modal visibility).
-   **Form Handling**: React Hook Form with Zod for robust, type-safe form validation.
-   **Containerization**: Dockerized using a multi-stage build, served by Nginx for production efficiency.

### Backend

-   **Framework**: Express.js with TypeScript
-   **Database**: PostgreSQL (designed for managed services like Aiven or Google Cloud SQL).
-   **ORM**: Prisma for type-safe database access and schema management.
-   **Authentication**: Passport.js with `passport-google-oauth20` strategy for secure Google OAuth 2.0 sign-in. JWTs are issued and managed via HttpOnly cookies.
-   **Validation**: Zod for validating all incoming API requests (body, params, query).
-   **Containerization**: Dockerized using a multi-stage build to create a lightweight, optimized production image.

---