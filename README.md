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

## Running locally

    npm install
    npm run server   # API on http://127.0.0.1:4100 (override with TASKFLOW_API_PORT)
    npm run dev      # UI on http://127.0.0.1:3000 (local machine only)

Data is stored in `data/taskflow.db` (SQLite). To reset, delete that file —
it is re-seeded with demo data on next start. There is no authentication;
the app runs as a single user.

## Demo Mode

If Supabase is not configured, the application will automatically fall back to demo mode with mock data. You can still test all features using the demo users:

- Ali (ali@example.com) - Admin
- Bob (bob@example.com) - Manager  
- Charlie (charlie@example.com) - Member

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
- User registration and login
- Demo mode for testing
- Secure session management

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

Events are stored in `localStorage` in demo mode and in the `calendar_events`
table when Supabase is configured.

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
