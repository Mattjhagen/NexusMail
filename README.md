# NexusMail AI - Enterprise Logic Hub

NexusMail AI is a high-fidelity, AI-integrated email and business automation suite. It connects custom business domains to a neural processing engine (Gemini 3) to automate the extraction of tasks, management of support tickets, and execution of business logic flows.

## 🚀 Current Features
- **Neural Signal Hub**: Intelligent email inbox with automated AI summarization and sentiment analysis.
- **Support Node Matrix**: Integrated ticketing system for tracking high-priority issues.
- **Logic Task Queue**: Actionable task management extracted directly from communications.
- **Automation Flow Matrix**: Conditional logic engine for auto-routing and processing signals.
- **Domain Integration**: Realistic DNS verification flow for custom business nodes.
- **Neural Drafting**: AI-powered reply generation and task extraction.

## 🛠 Fully Functional TODOs
### Phase 1: Core Reliability (Current Focus)
- [x] **Local Persistence**: Integrated `localStorage` to ensure your configuration and signals persist across sessions.
- [x] **DNS Logic Synchronization**: Full implementation of DNS record mapping and verification simulation.
- [x] **Ticket & Task Creation**: Fully functional modals for manual and AI-assisted item creation.
- [x] **State Deletion**: Ability to prune stale nodes and records from the system.

### Phase 2: Advanced Interaction
- [ ] **Neural Drafts**: Implementation of `gemini-3-flash` for drafting replies based on email context.
- [ ] **Live Audio Hub**: Integration of Gemini Live API for voice-controlled email management.
- [ ] **Real-time Synchronization**: Webhook simulation for incoming emails from connected domains.

### Phase 3: Infrastructure
- [ ] **SMTP/IMAP Bridging**: True backend integration for sending and receiving real emails.
- [ ] **OAuth2 Integration**: Secure connection to Google/Microsoft business accounts.
- [ ] **Team Collaboration**: Shared support nodes and task assignments.

## ⚙️ Setup
1. Deploy to a static hosting provider (Netlify/Vercel).
2. Ensure `process.env.API_KEY` is configured for Gemini 3 access.
3. Use the "System Config" view to sync your first business domain.
