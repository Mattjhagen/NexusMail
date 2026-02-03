
import React from 'react';

export const INITIAL_EMAILS = [
  {
    id: 'e1',
    from: 'sarah.jones@client-corp.com',
    subject: 'Urgent: Billing issue with last invoice #8822',
    content: "Hi Team, I'm reaching out because we were double-charged for our enterprise subscription this month. Can you please look into this and issue a refund? Also, we need to update our billing address for future invoices. Thanks, Sarah.",
    date: '2023-10-24T10:30:00Z',
    isRead: false,
    isAnalyzed: false
  },
  {
    id: 'e2',
    from: 'tech-support@partner-api.io',
    subject: 'API Documentation Feedback',
    content: "The new v3 documentation looks great! Just noticed a typo in the authentication section. The 'Bearer' prefix is missing from the example. Keep up the good work.",
    date: '2023-10-24T09:15:00Z',
    isRead: true,
    isAnalyzed: false
  },
  {
    id: 'e3',
    from: 'mark.v@salesforce.com',
    subject: 'Partnership Opportunity Q4',
    content: "Hey, I saw your recent launch on Product Hunt. We'd love to chat about integrating NexusMail with our CRM ecosystem. Are you available for a 15-min call next Tuesday at 11 AM EST?",
    date: '2023-10-23T16:45:00Z',
    isRead: true,
    isAnalyzed: false
  }
];

export const P3_LENDING_EMAILS = [
  {
    id: 'p3-1',
    from: 'underwriting@p3lending.space',
    subject: 'Loan Application #LN-8892 Review Complete',
    content: "The underwriting team has reviewed the application for Smith Construction LLC. We need the following documents to proceed to final approval: 1. Updated P&L Statement for Q3 2024. 2. Proof of Insurance for the new equipment. Please upload these to the portal by EOD.",
    date: new Date().toISOString(),
    isRead: false,
    isAnalyzed: false
  },
  {
    id: 'p3-2',
    from: 'newapps@broker-network.com',
    subject: 'New Lead: $2.5M Commercial Refinance',
    content: "Client Name: Green Valley Estates. Property Type: Multi-Family. Requested Amount: $2,500,000. LTV: 65%. Credit Score: 780. Please assign a loan officer to reach out within 24 hours.",
    date: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
    isAnalyzed: false
  },
  {
    id: 'p3-3',
    from: 'compliance@p3lending.space',
    subject: 'Action Required: Rate Sheet Update Q4',
    content: "Team, the Federal Reserve's recent announcement has impacted our base rates. The new rate sheet (v4.2) is attached and effective immediately. Ensure all new quotes reflect the +25bps adjustment.",
    date: new Date(Date.now() - 7200000).toISOString(),
    isRead: true,
    isAnalyzed: false
  }
];

export const INITIAL_TICKETS = [
  {
    id: 't1',
    title: 'Server downtime - US East 1',
    description: 'Multiple users reporting latency in US East region.',
    status: 'in-progress',
    priority: 'high',
    assignedTo: 'Alex Rivers',
    createdAt: '2023-10-22T08:00:00Z'
  }
];

export const INITIAL_TASKS = [
  { id: 'tk1', title: 'Review quarterly goals', status: 'pending', dueDate: '2023-10-30' },
  { id: 'tk2', title: 'Update domain SPF records', status: 'completed' }
];

export const INITIAL_AUTOMATIONS = [
  {
    id: 'a1',
    name: 'Auto-Ticket: Billing',
    condition: "Subject contains 'Billing' or 'Invoice'",
    action: 'Create High Priority Ticket',
    isActive: true
  },
  {
    id: 'a2',
    name: 'Auto-Task: Partnership',
    condition: "Content mentions 'Partnership' or 'Meeting'",
    action: 'Add to Task List',
    isActive: false
  }
];

export const Icons = {
  Inbox: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h4.418a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
    </svg>
  ),
  Ticket: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  ),
  Task: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  Zap: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  ),
  Settings: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.127c-.332.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  Sparkles: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.456-2.454L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  ),
  Sun: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  ),
  Moon: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  ),
  Server: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 0 0-3 3m16.5-6a3 3 0 0 0-3-3m0 0a3 3 0 0 0-3 3m3 3h3m-3 3a3 3 0 0 1-3 3m0 0a3 3 0 0 1-3-3m3 3v-5.25m0-5.25V3.75m0 0a3 3 0 0 1 3 3m-3-3a3 3 0 0 0-3 3" />
    </svg>
  )
};
