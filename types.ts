
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export interface EmailAccount {
  id: string;
  email: string;
  host: string;
  port: number;
  type: 'imap' | 'pop3' | 'sendgrid';
  lastSync: string;
  status: 'connected' | 'error' | 'syncing';
}

export interface Email {
  id: string;
  accountId?: string; // Link email to specific account
  from: string;
  subject: string;
  content: string;
  date: string;
  isRead: boolean;
  isAnalyzed: boolean;
  aiInsights?: AIInsight;
}

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  dueDate?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  assignedTo?: string;
  createdAt: string;
  emailId?: string;
}

export interface AIInsight {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  suggestedTasks: string[];
  suggestedTicket?: {
    title: string;
    priority: Priority;
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  isActive: boolean;
}

export interface AppState {
  activeView: 'inbox' | 'tickets' | 'tasks' | 'automations' | 'settings';
  accounts: EmailAccount[];
  emails: Email[];
  tickets: Ticket[];
  tasks: Task[];
  automations: AutomationRule[];
  selectedEmailId: string | null;
  isAnalyzing: boolean;
}
