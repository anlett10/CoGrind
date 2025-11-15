# CoGrind

A collaborative task management platform built with TanStack Start, Convex, and React.

## Features

- **Project Management**: Create projects and invite collaborators
- **Task Management**: Create, assign, and share tasks with team members
- **Live Task Tracking**: Track time and manage active tasks in real-time
- **Task Refinement**: Collaborate on task improvements with notes, questions, and updates
- **Analyze Image**: AI-powered image analysis using Anthropic Claude Vision to extract insights and generate task descriptions from images
- **GitHub Integration**: Sync and review GitHub issues from your repositories
- **Real-time Collaboration**: Work together seamlessly with live updates

## Prerequisites

- [Bun](https://bun.sh/) (v1.2 or higher)
- [Node.js](https://nodejs.org/) (v20 or higher) - if not using Bun
- A [Convex](https://www.convex.dev/) account

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd ProjectName
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up Convex

1. Create a new Convex project at [convex.dev](https://www.convex.dev/)
2. Install Convex CLI globally:
   ```bash
   bun add -g convex
   ```
3. Login to Convex:
   ```bash
   npx convex login
   ```
4. Link your project:
   ```bash
   npx convex dev --once
   ```
   This will create a `.env.local` file with your Convex deployment URL.
5. Ready for local development:
   ```bash
   npx convex dev
   ```

### 4. Configure environment variables

Create a `.env.local` file in the root directory (if not already created by Convex):

```env
VITE_CONVEX_URL=your_convex_deployment_url
VITE_CONVEX_SITE_URL=http://localhost:3000

# Sentry Configuration
VITE_SENTRY_DSN=
SENTRY_DSN=
```

Replace `your_convex_deployment_url` with your actual Convex deployment URL

### 5. Run database migrations

The Convex dev server will automatically handle schema migrations. Make sure your Convex dashboard shows the schema is synced.

## Running Locally

### Development Server

Start the development server:

```bash
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Convex Dev Server

In a separate terminal, run the Convex dev server (if not already running):

```bash
npx convex dev
```

This will:
- Watch for changes in your Convex functions
- Sync your schema
- Provide a dashboard at the Convex URL

## Building for Production

```bash
bun run build
```

This will:
- Build the application
- Type-check the codebase

### Start Production Server

```bash
bun run start
```

## Project Structure

```
├── convex/              # Convex backend functions and schema
│   ├── schema.ts       # Database schema definitions
│   ├── tasks.ts        # Task-related queries and mutations
│   ├── projects.ts     # Project-related queries and mutations
│   └── ...
├── src/
│   ├── components/     # React components
│   │   ├── app/        # Application-specific components
│   │   └── ui/         # Reusable UI components
│   ├── routes/         # TanStack Router routes
│   ├── lib/            # Utility functions and configurations
│   └── styles/        # Global styles
└── public/             # Static assets
```

## Key Technologies

- **Frontend**: React 19, TanStack Start, TanStack Router
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Better Auth via Convex
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **Forms**: TanStack Form
- **State Management**: React Query (via Convex React Query)

### Convex connection issues

- Ensure your `.env.local` file has the correct `VITE_CONVEX_URL`
- Verify you're logged into Convex: `npx convex login`
- Check that the Convex dev server is running: `npx convex dev`

## License

MIT

