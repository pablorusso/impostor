# Project: Impostor Game

This document provides an overview of the Impostor Game project, its technical stack, and development conventions, serving as instructional context for future interactions.

## Project Overview

The Impostor Game is a web-based social deduction game designed for in-person play. The web application's primary role is to manage game rounds, player assignments, and real-time state synchronization, reducing the need for manual orchestration during gameplay. It aims to provide a robust and seamless experience, particularly on mobile devices.

**Key Technologies:**

*   **Framework:** Next.js
*   **Language:** TypeScript
*   **UI Library:** React with Material UI components
*   **State Management:** React Hooks (`useState`, `useEffect`, `useCallback`, `useContext` for connection status).
*   **Real-time Communication:** Pusher for efficient real-time event updates (contradicting older `README` mentions of polling/SSE, Pusher is the current implementation).
*   **Persistence:** Hybrid store utilizing an in-memory solution for core game logic (`lib/store.ts`) with Redis integration (as indicated by `package.json` and `README.md`) likely handled at the API level for scalable persistence.
*   **Utility:** `nanoid` for unique ID generation.
*   **Analytics:** Vercel Analytics.
*   **Deployment:** Vercel.

**Architecture Highlights:**

*   **Client-Side Next.js Application:** Renders the game interface and handles user interactions.
*   **API Routes:** Utilizes Next.js API routes (`app/api/...`) for server-side logic, managing game state, and interacting with the persistence layer.
*   **PWA Enabled:** Configured as a Progressive Web App (PWA) with a manifest, apple-touch-icons, theme color, and service worker registration for an enhanced mobile experience.
*   **Robust Session Handling:** Employs `localStorage` for client-side player ID and name persistence, including specific recovery logic for Safari browsers to mitigate session loss.
*   **Optimistic UI Updates:** Key actions like `nextTurn` and `kickPlayer` incorporate optimistic updates, providing immediate visual feedback to the user while awaiting server confirmation.

## Building and Running

The project uses standard `npm` scripts for development and production workflows.

**Prerequisites:**

*   Node.js (version >=18.17)
*   npm

**Commands:**

*   **Install Dependencies:**
    ```bash
    npm install
    ```
*   **Run in Development Mode:**
    Starts the development server with hot-reloading.
    ```bash
    npm run dev
    ```
*   **Build for Production:**
    Creates an optimized production build of the application.
    ```bash
    npm run build
    ```
*   **Start Production Server:**
    Starts the Next.js production server.
    ```bash
    npm start
    ```

## Development Conventions

*   **TypeScript First:** All new code should be written in TypeScript, leveraging its type safety features.
*   **Material UI:** Utilize Material UI components for building the user interface to maintain a consistent look and feel.
*   **Functional Components and Hooks:** Prefer functional React components and hooks for state management and side effects.
*   **API Route Structure:** API endpoints are organized under `app/api/`, following Next.js conventions for route handlers.
*   **Client-Side Persistence:** `localStorage` is used for non-sensitive, client-specific data such as `playerId` and `playerName`.
*   **PWA Best Practices:** Adhere to PWA guidelines for manifest, service worker caching, and offline capabilities.
*   **Error Handling:** Implement robust error handling for API calls and network requests, including retry mechanisms and user-friendly feedback.
*   **User Experience:** Prioritize a smooth user experience through features like optimistic updates, haptic feedback (vibration) for key events on mobile, and clear connection status indicators.
*   **Code Structure:** Keep utility functions and types organized within the `lib/` directory.
