
# NexusMail AI - Enterprise Logic Hub

NexusMail AI is a high-fidelity, AI-integrated email and business automation suite. It connects custom business domains to a neural processing engine (Gemini 3) to automate the extraction of tasks, management of support tickets, and execution of business logic flows.

## 🚀 Fully Functional Features
- **Real-Time Data Persistence**: Complete Supabase integration for Emails, Tickets, Tasks, Automations, and Domains.
- **Desktop Notifications**: PWA-enabled system notifications when new emails are detected via auto-sync.
- **Auto-Sync Loop**: Background process checks connected accounts every 2 minutes.
- **Neural Drafting**: AI-powered reply generation.
- **Domain DNS Simulation**: Realistic verification flow for custom domains.

## 🛠 Setup & Installation

### 1. Environment Variables
You must configure your Gemini API key for the AI features to work.
Create a `.env` file in the root directory:
```
API_KEY=your_gemini_api_key_here
```

### 2. Database Setup (Supabase)
1. Create a new project at [Supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `supabase_schema.sql` from this repository.
4. Run the SQL script to create all required tables and security policies.

### 3. Application Configuration
1. Run the application locally:
   ```bash
   npm install
   npm run dev
   ```
2. Open the app in your browser.
3. On the Landing Page, click **Deploy Node**.
4. Create an account (this registers you in Supabase Auth).
5. Upon first login, a **Database Configuration** modal will appear.
   - Enter your Supabase Project URL (found in Project Settings > API).
   - Enter your Supabase Anon Public Key.
6. These credentials are saved locally to `localStorage` to connect the frontend to your database.

### 4