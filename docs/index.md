# Timetable Tracker Documentation

<div style="text-align: center;">
  <video src="https://media.frhn.me/socialtime.mp4" controls autoplay loop muted width="600"></video>
</div>

## Overview

A modern and scalable Timetable Tracker designed for students and educators. This application allows users to manage class schedules, track attendance, and analyze performance with an intuitive, classroom-inspired interface. Built with a focus on clean code, domain-driven design, and modern DevOps practices, it features independent frontend and backend services containerized with Docker.

## Core Features

-   **User & Stream Management**: Secure user sign-up and sign-in via Google OAuth. Users can create streams or join existing ones using a unique generated code. The creator of a stream automatically becomes its administrator.
-   **Timetable Creation**: Admins can create immutable, versioned timetables with specific start and end validity dates. New timetables supersede older ones, ensuring the schedule is always up-to-date.
-   **Weekly Attendance View**: A clear, week-by-week card-based view of the schedule. Students can mark their attendance for each class.
-   **Admin Controls**: Admins have special privileges to globally cancel a class for all students or replace a scheduled class with another from the existing timetable for a specific day.
-   **Analytics & Calculator**:
    -   View detailed, subject-wise attendance statistics.
    -   A "Manual Override" mode allows users to input attended classes directly to see hypothetical stats.
    -   The projection calculator helps users determine how many classes they need to attend (or can skip) to reach a target percentage by a future date.
-   **Stream Archiving**: Admins can archive streams, hiding them from the main dashboard and sidebar for all members to declutter the workspace, with an option to view them later. Members can leave streams they are a part of.

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

## System Design & Architectural Pattern

The backend is built following a **Domain-Driven Design (DDD)** approach combined with a **Layered (or Clean) Architecture**. This creates a system that is robust, maintainable, and scalable.

### What are Domains?

A **domain** represents a major area of functionality or a core business concept. We group code by domain to keep related logic together (**high cohesion**) and separate it from unrelated logic (**low coupling**). If you need to change how streams work, you know to look primarily in the `domains/stream` folder. This is far more scalable than having one giant folder for all controllers, one for all services, etc.

The primary domains in this application are `User`, `Stream`, `Timetable`, `Attendance`, and `Analytics`.

### The Layers of a Domain

Each domain is organized into distinct layers, each with a single responsibility. This is the **separation of concerns** principle. An HTTP request flows inward through these layers, and the response flows outward.

1.  **Controller (`*.controller.ts`) - The Entry Gate**
    -   **Job**: Handles raw HTTP requests and responses.
    -   **Responsibilities**: Extracts data from the request (`req.params`, `req.body`, `req.user`), calls the appropriate Service function, and formats the result from the service into a JSON response with the correct status code. It contains no business logic.

2.  **DTO (`*.dto.ts`) - The Data Contract**
    -   **Job**: Defines the shape and validation rules for data moving in and out of the application.
    -   **Responsibilities**: Uses Zod to create schemas for request bodies, params, and queries. Our `validateRequest` middleware uses these schemas to ensure all incoming data is valid *before* it reaches the controller, preventing invalid data from entering our business logic.

3.  **Service (`*.service.ts`) - The Brain / Business Logic**
    -   **Job**: Orchestrates the application's core business rules.
    -   **Responsibilities**: Receives validated data from the controller, performs permission checks (e.g., "Is this user an admin?"), executes business logic (e.g., "An owner cannot leave a stream"), calls Repository methods to fetch/save data, and throws specific application errors (`NotFoundError`, `ForbiddenError`). This is where the main work happens.

4.  **Repository (`*.repository.ts`) - The Database Worker**
    -   **Job**: Handles all direct communication with the database.
    -   **Responsibilities**: This is the *only* layer that should directly import and use the `prisma` client. It contains all database queries (`prisma.stream.findUnique`, etc.), abstracting the data access logic away from the service layer.

5.  **Prisma Model (`schema.prisma`) - The Blueprint**
    -   **Job**: Defines the fundamental data structures and relationships of our domains.
    -   **Responsibilities**: Acts as the single source of truth for our database schema. Prisma generates TypeScript types from this file, which are used throughout the application for type safety.

> #### The "Vertical Slice" Workflow
> When you add a new feature, you touch multiple files because you are implementing a complete **"vertical slice"** of functionality that cuts through all layers of the application. For example, adding an "Archive Stream" feature requires:
>
> 1.  A **schema** change (`isArchived` field).
> 2.  A new **repository** method (`setArchiveStatus`).
> 3.  New **service** logic (`archiveStream` with permission checks).
> 4.  A new **controller** handler (`handleArchiveStream`).
> 5.  A new **route** (`POST /streams/:streamId/archive`).
>
> This process ensures that every new feature is robust, secure, and well-integrated.

---

## Development & Deployment

### Local Development

The project is configured for a seamless local development experience using Docker Compose.

1.  **Prerequisites**: Docker, Docker Compose, Node.js (for local IDE support).
2.  **Setup**:
    -   Create `.env.development` files in `frontend/` and `backend/` based on the `.env.example` templates.
3.  **Run**:

    - Database
    ```bash
    docker compose -f docker-compose-dev.yml up -d
    ```

    - Frontend
    ```bash
    cd frontend && npm run dev
    ```

    - Backend
    ```bash
    cd backend && npm run dev
    ```

4.  **Access**:
    -   Frontend: `http://localhost:5173`
    -   Backend API: `http://localhost:3001`

### Deployment (Staging & Production on Google Cloud VMs)

The workflow distinguishes between staging and production environments using Docker Compose on dedicated virtual machines.

-   **Git Branches**:
    -   `develop`: Pushing to this branch triggers a deployment to the **Staging** environment.
    -   `main`: Pushing to this branch triggers a deployment to the **Production** environment.

-   **CI/CD Pipelines (GitHub Actions)**:
    1.  **Change Detection**: The pipeline analyzes file changes to determine what needs to be rebuilt (backend, frontend, or docker-compose configurations).

    2.  **Build Check**: Validates that the code compiles successfully by running npm run build for changed components.
    3.  **Security Scan**: Runs Trivy vulnerability scanner on the codebase and uploads results to GitHub Security tab.
    4.  **Build & Push**: If deployable changes are detected, it builds production-optimized Docker images for the frontend and backend. Images are tagged with the Git branch name and pushed to Google Artifact Registry.
    5.  **Deploy**: The pipeline connects to the target VM (staging or production) via SSH, pulls the latest images using Docker Compose, and performs a rolling restart of the containers.
    6.  **Health Verification**: After deployment, the pipeline verifies that all containers are running and healthy by checking the backend health endpoint and container status.
    7. **Environment Configuration**: Each environment uses its own Docker Compose file (docker-compose.staging.yml or docker-compose.production.yml) with environment-specific configurations including database URLs, OAuth credentials, and domain settings.

This automated workflow ensures that deployments are consistent, reliable, and require minimal manual intervention while supporting different configurations for staging and production environments.

## Infrastructure

- **Virtual Machines**: Separate VMs for staging and production environments on Google Cloud Platform
- **Docker Compose**: Container orchestration using environment-specific compose files
- **Nginx Reverse Proxy**: Environment-specific nginx configurations for SSL termination and routing
- **Container Registry**: Google Artifact Registry for storing Docker images
- **Database**: Environment-specific database instances with URLs stored as GitHub secrets
