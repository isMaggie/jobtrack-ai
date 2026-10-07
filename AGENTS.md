# JobTrack AI

## Project Goal

JobTrack AI is a full-stack job application tracking platform.

The MVP helps users:
- Add job applications manually
- Store company, position, job description, and job URL
- Track application status
- View applications in a dashboard
- Update application progress

Future versions may support:
- Extracting job application information from confirmation emails
- Gmail integration
- AI-powered job description analysis
- Follow-up reminders

## Current MVP Scope

For the first version, implement only:

1. Application dashboard
2. Create application
3. View application details
4. Update application status
5. Store job descriptions
6. Persistent data storage

Do not implement Gmail integration, authentication, resume matching,
or notification systems unless explicitly requested.

## Tech Stack

Preferred stack:

- React
- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL

Keep the architecture simple and appropriate for a portfolio project.

Use React as a core part of the frontend and prefer simple,
beginner-readable React patterns.

Do not introduce complex state management libraries unless there is
a clear need for them.

## Engineering Principles

- Prefer simple and readable solutions.
- Use TypeScript.
- Avoid unnecessary dependencies.
- Keep business logic separate from UI components when practical.
- Validate user and external input.
- Handle errors explicitly.
- Never expose secrets or API keys.
- Do not over-engineer the MVP.

## Testing Requirements

Every important feature should include appropriate tests.

Testing should include:

- Unit tests for business logic and validation
- Integration tests for important application flows
- E2E tests for critical user workflows when appropriate

Before considering a development task complete:

1. Run relevant tests.
2. Run lint.
3. Run the production build when appropriate.
4. Confirm that existing tests still pass.

Never delete, disable, or weaken a test simply to make the test suite pass.

## Development Workflow

Before implementing a significant feature:

1. Understand the existing codebase.
2. Explain the proposed approach.
3. Identify the files that will be created or modified.
4. Implement the smallest working version.
5. Add or update appropriate tests.
6. Run the relevant tests.
7. Run lint.
8. Check for TypeScript/build errors.
9. Summarize what changed.

When a bug occurs, identify and explain the root cause before applying
a fix when practical.

## AI Coding Guidelines

The developer using this repository is learning full-stack software
engineering, including React, Next.js, TypeScript, databases, and testing.

When making significant architectural or technical decisions:

- Explain why the approach was chosen.
- Prefer understandable solutions over clever solutions.
- Explain unfamiliar technologies or patterns.
- Do not introduce unnecessary abstractions.
- Explain important React concepts when they appear in the implementation.