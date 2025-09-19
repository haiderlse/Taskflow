# TaskFlow - Real-time Project Management

A modern React-based project management application similar to Asana, now powered by Supabase for real-time collaboration and data persistence.

## Features

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
