# TaskFlow - Real-time Project Management

A modern React-based project management application similar to Asana, now powered by Supabase for real-time collaboration and data persistence.

## Features

- **Planner & Calendar**: Day / week / month / agenda views over meetings *and* task deadlines, with drag-to-block time planning and meeting reminders
- **Project Management**: Create and manage projects with team collaboration
- **Task Management**: Kanban boards, list views, and task tracking
- **Real-time Updates**: Live collaboration using Supabase real-time subscriptions
- **User Authentication**: Secure authentication with Supabase Auth
- **Team Management**: User roles, permissions, and organization management
- **Time Tracking**: Built-in time tracking and reporting
- **Dashboard**: Comprehensive overview of tasks, projects, and team activity

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL database, real-time subscriptions, authentication)
- **Styling**: Tailwind CSS (via CDN)
- **State Management**: React hooks and context

## Setup Instructions

### Prerequisites
- Node.js (version 16 or higher)
- A Supabase account and project

### 1. Clone and Install

```bash
git clone <repository-url>
cd Taskflow
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your project URL and anon key
3. Copy the SQL schema from `supabase-schema.sql` and run it in the Supabase SQL Editor

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with your actual Supabase values.

### 4. Run the Application

For development:
```bash
npm run dev
```

For production build:
```bash
npm run build
npm run preview
```

## Deploying to GitHub Pages

The app is a static site — Supabase is the whole backend — so GitHub Pages can
host it for free, and it will be reachable from your phone without your laptop
running.

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
Three things have to be set up once, in the repository settings:

1. **Make the repository public.** Free GitHub Pages requires it. This publishes
   the *code*, not your data — that stays in Supabase behind RLS.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

The site then appears at `https://<user>.github.io/<repo>/`. The workflow passes
`VITE_BASE_PATH` so assets resolve under that subpath; locally the base stays `/`.

### About those keys

`VITE_*` variables are **inlined into the JavaScript bundle at build time**. They
are readable by anyone who opens the deployed site. This is expected: the anon
key is a public project identifier, not a credential. **Row Level Security is
what protects your data** — which is why the policies in `supabase-schema.sql`
matter so much.

Storing them as Actions secrets keeps them out of the source history and the
build logs, and lets you rotate without a commit. It does not make them private
once built, and nothing can.

**Never** put a `service_role` key in this repository, in a `VITE_*` variable, or
in an Actions secret consumed by this build. It bypasses RLS completely.

### Known limitation

Reminders fire only while a browser tab is open — hosting does not change that.
Background push would need a service worker and the Web Push API, which is not
built.

## Creating your account

Authentication is Supabase-only — there is no demo login and no local fallback.
Supabase must be configured before anyone can sign in; until it is, the login
screen says so and the button stays disabled.

1. Run `supabase-schema.sql` in the Supabase SQL Editor (creates the tables,
   including `users` and `calendar_events`, with their RLS policies).
2. Put your project URL and anon key in `.env.local` (see step 3 above) and
   restart the dev server.
3. **Turn off email confirmation** while setting up, or you will not be able to
   sign in until you click a link: Supabase → Authentication → Providers →
   Email → uncheck *Confirm email*. Leave it on for anything real.
4. Open the app, choose **Sign Up**, and register with your email and password.

That creates both the Supabase Auth user and the matching row in the `users`
table. From then on, **Sign In** with the same credentials.

If you would rather create the account without the app, add the user under
Supabase → Authentication → Users, then insert the matching profile row:

```sql
-- Replace the UUID with the id shown for the user in Authentication → Users
insert into users (uid, email, display_name, role, is_active)
values ('00000000-0000-0000-0000-000000000000', 'you@example.com', 'Your Name', 'admin', true);
```

A profile row is required: sign-in fails without one, because the app reads the
user's role and settings from `users`, not from the auth record.

> Never commit `.env.local` or a password to the repository. `.env.local` is
> already covered by `.gitignore`.

## Database Schema

The application uses the following main tables:
- `users` - User profiles and authentication
- `projects` - Project information and metadata
- `tasks` - Task details and status
- `comments` - Task comments and discussions
- `time_entries` - Time tracking data
- `milestones` - Project milestones
- `portfolios` - Project portfolios
- `goals` - OKRs and goal tracking
- `calendar_events` - meetings, focus blocks, and reminders (with recurrence rules)

Row Level Security (RLS) is enabled for all tables to ensure data privacy and proper access control.

## Features Overview

### Authentication
- Supabase Auth sign-up and sign-in; no demo or local-account fallback
- Sessions owned and refreshed by the Supabase client
- Password reset by email, and password change re-verified against the current password

### Project Management
- Create and organize projects
- Project templates and color coding
- Member management and permissions
- Project status tracking

### Task Management
- Kanban board view with drag-and-drop
- List view with sorting and filtering
- Task dependencies and subtasks
- Custom fields and tags
- File attachments
- Due dates and priority levels

### Planner & Calendar

A single workspace-wide view of everything with a time on it — reachable from
**Planner & Calendar** in the sidebar.

**Four ranges**

| Range | What it is for |
|---|---|
| **Day** | Plot one day hour by hour; shows remaining open slots between 9am and 6pm |
| **Week** | The default. Seven day-columns with per-day "booked" totals |
| **Month** | Spot crunch weeks; click any date to drop into its Day view |
| **Agenda** | Everything in the next 30 days as one scannable list |

**Meetings.** `New event` creates a meeting, focus block, reminder, deadline,
out-of-office, or personal entry, with a location, a join link, attendees, a
linked project, and an agenda. Events repeat daily / weekly (on chosen weekdays)
/ monthly / yearly, with an optional end date; deleting a repeating event removes
either the single occurrence or the whole series.

**Tasks on the calendar.** Every task you are assigned shows up automatically:
one with a *Due Time* lands on the time grid, one with a date-only deadline lands
in the all-day **Due** row. The **Needs a slot** rail lists tasks whose deadline
falls in view but which have no work block yet — drag one onto the grid to block
time for it (snapped to 15 minutes, sized from the task's estimate).

**Not forgetting meetings.** Three layers, so a reminder has to get through:

1. A **Up next** chip in the toolbar with a live countdown and a one-click *Join*.
2. An **in-app notification** in the Activity Inbox, which persists whether or not
   you were looking at the screen.
3. A **browser notification** that reaches you in another tab or window — click
   *Turn on meeting alerts* once to grant permission.

Meeting reminders are configurable per event (at start, 5/10/15/30 min, 1 hour,
1 day). Task deadlines get an automatic ladder: a day ahead, an hour ahead (when
a due time is set), and at the deadline. Reminders missed while the tab was
closed still fire on the next load if they are less than 10 minutes stale, and
each one fires only once — the fired set is remembered in `localStorage`.

#### Where calendar events are stored

The planner picks a backend automatically and shows which one is live as a badge
in the toolbar — **Synced** (green) or **This browser only** (grey).

| Condition | Backend | Behaviour |
|---|---|---|
| Supabase configured **and** signed in through Supabase Auth | `calendar_events` table | Events sync across devices; a realtime subscription pushes changes from other sessions into the open tab |
| Anything else — no Supabase keys, or a demo-mode login | `localStorage` | Events persist in that one browser only |

Demo logins always stay local, by design: `calendar_events.owner_id` is a
`UUID REFERENCES users(uid)` and the RLS policies compare it against
`auth.uid()`, so an id like `user-1` can satisfy neither. The service checks for
a UUID before attempting any remote write.

Reads are served synchronously from an in-memory cache so the grid renders
without waiting on the network. Writes apply to the cache first and persist
afterwards; if a remote write fails, the cache rolls back, the calendar returns
to its previous state, and the event modal stays open with your input intact and
the error shown. If Supabase is configured but unreachable, the planner falls
back to local storage rather than failing — the badge turns red and names the
reason.

To enable syncing: run `supabase-schema.sql` in the Supabase SQL Editor (it
creates `calendar_events` with its RLS policies), then set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` in `.env.local` and sign in with a real account
rather than a demo persona.

### Real-time Collaboration
- Live task updates across users
- Real-time notifications
- Collaborative editing

### Reporting and Analytics
- Time tracking and utilization
- Project progress reports
- Team performance metrics
- Goal tracking (OKRs)

## Migration from MongoDB

This version has been migrated from MongoDB to Supabase for better real-time capabilities and easier deployment. The application maintains backward compatibility and will work with mock data if Supabase is not configured.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
