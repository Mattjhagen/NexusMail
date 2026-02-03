
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  AppState, 
  Email, 
  Ticket, 
  Task, 
  AutomationRule, 
  Priority, 
  TicketStatus,
  AIInsight,
  EmailAccount
} from './types';
import { 
  INITIAL_EMAILS, 
  INITIAL_TICKETS, 
  INITIAL_TASKS, 
  INITIAL_AUTOMATIONS, 
  P3_LENDING_EMAILS,
  Icons 
} from './constants';
import { analyzeEmail, getDNSInstructions, draftReply, DNSInstruction } from './services/gemini';
import Landing from './Landing';
import { supabase, saveSupabaseConfig, getSupabaseConfig, clearSupabaseConfig } from './lib/supabase';

// Branded Logo Component
export const NexusLogoSVG = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={`w-full h-full drop-shadow-2xl ${className}`}>
    <defs>
      <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06b6d4" />
        <stop offset="50%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#d946ef" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <g stroke="url(#nexusGrad)" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.9" filter="url(#glow)">
      <path d="M160 250 Q100 120 140 80" />
      <path d="M160 250 Q110 180 180 140" />
      <path d="M160 250 Q80 160 90 220" />
      <circle cx="140" cy="80" r="10" fill="#06b6d4" />
      <circle cx="180" cy="140" r="10" fill="#06b6d4" />
      <circle cx="90" cy="220" r="10" fill="#06b6d4" />
      <path d="M352 250 Q412 120 372 80" />
      <path d="M352 250 Q402 180 332 140" />
      <path d="M352 250 Q432 160 422 220" />
      <circle cx="372" cy="80" r="10" fill="#d946ef" />
      <circle cx="332" cy="140" r="10" fill="#d946ef" />
      <circle cx="422" cy="220" r="10" fill="#d946ef" />
    </g>
    <path d="M80 230 L256 370 L432 230 V420 H80 Z" fill="url(#nexusGrad)" />
    <path d="M80 230 L256 370 L432 230 L256 120 Z" fill="url(#nexusGrad)" opacity="0.75" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
    <g transform="translate(256, 235)">
      <circle r="55" fill="#1e1b4b" stroke="url(#nexusGrad)" strokeWidth="4" />
      <g stroke="#06b6d4" strokeWidth="3" fill="none" transform="translate(-25, -25) scale(0.5)">
        <path d="M50 20v60M20 50h60" strokeLinecap="round" />
        <path d="M35 35l30 30M35 65l30-30" strokeLinecap="round" />
        <circle cx="50" cy="50" r="15" strokeWidth="4" />
      </g>
    </g>
  </svg>
);

const NexusLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`${className} bg-[#1e1b4b] rounded-[22%] flex items-center justify-center shadow-2xl relative border border-white/5 transition-transform hover:scale-105 duration-300`}>
    <div className="w-[85%] h-[85%]"><NexusLogoSVG /></div>
  </div>
);

// UI Components
const Badge = ({ children, color = 'blue', darkMode }: { children?: React.ReactNode, color?: string, darkMode: boolean }) => {
  const lightColors: Record<string, string> = {
    blue: 'bg-sky-100 text-sky-700', red: 'bg-rose-100 text-rose-700', 
    green: 'bg-emerald-100 text-emerald-700', amber: 'bg-fuchsia-100 text-fuchsia-700', gray: 'bg-slate-100 text-slate-600',
  };
  const darkColors: Record<string, string> = {
    blue: 'bg-sky-900/40 text-sky-300 border border-sky-800/50',
    red: 'bg-rose-900/40 text-rose-300 border border-rose-800/50',
    green: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    amber: 'bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-800/50',
    gray: 'bg-slate-800 text-slate-300 border border-slate-700',
  };
  const colors = darkMode ? darkColors : lightColors;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight uppercase ${colors[color] || colors.blue}`}>{children}</span>;
};

const PriorityBadge = ({ priority, darkMode }: { priority: Priority, darkMode: boolean }) => {
  const color = priority === 'urgent' ? 'red' : priority === 'high' ? 'amber' : priority === 'medium' ? 'blue' : 'gray';
  return <Badge color={color} darkMode={darkMode}>{priority}</Badge>;
};

const ToggleSwitch = ({ checked, onChange, darkMode }: { checked: boolean, onChange: () => void, darkMode: boolean }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
    <div className={`w-11 h-6 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:bg-sky-500 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-gray-300'}`}></div>
  </label>
);

const Modal = ({ isOpen, onClose, title, subtitle, children, isDarkMode }: { isOpen: boolean, onClose: () => void, title: string, subtitle?: string, children?: React.ReactNode, isDarkMode: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl" onClick={onClose}></div>
      <div className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border ${isDarkMode ? 'bg-[#1e1b4b]/50 border-sky-500/30' : 'bg-white border-slate-200'}`}>
        <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-sky-500/10' : 'border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400"><Icons.Zap className="w-6 h-6" /></div>
            <div>
              <h3 className="font-black text-xl uppercase tracking-tighter">{title}</h3>
              {subtitle && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-sky-400 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-10 custom-scrollbar max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inboxViewMode, setInboxViewMode] = useState<'list' | 'detail'>('list');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Modals & States
  const [showSupabaseConfigModal, setShowSupabaseConfigModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Config Forms
  const [sbConfig, setSbConfig] = useState({ url: '', key: '' });

  // Domain Modal
  const [domainModalStep, setDomainModalStep] = useState<'input' | 'scanning' | 'instructions'>('input');
  const [domainVerificationMethod, setDomainVerificationMethod] = useState<'manual' | 'cloudflare'>('manual');
  const [cloudflareToken, setCloudflareToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [dnsInstructions, setDnsInstructions] = useState<DNSInstruction[]>([]);
  const [connectedDomains, setConnectedDomains] = useState<any[]>([]);
  
  const [state, setState] = useState<AppState>({
    activeView: 'inbox',
    accounts: [],
    emails: [],
    tickets: INITIAL_TICKETS,
    tasks: INITIAL_TASKS,
    automations: INITIAL_AUTOMATIONS,
    selectedEmailId: null,
    isAnalyzing: false,
  });

  const [draftContent, setDraftContent] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  // Account Form
  const [accountForm, setAccountForm] = useState({ email: '', password: '', host: '', port: 993 });
  const [accountStatus, setAccountStatus] = useState<'idle' | 'auth' | 'success'>('idle');

  // Initialization & Auth Listener
  useEffect(() => {
    // 1. Check if Supabase is configured
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      setShowSupabaseConfigModal(true);
      return;
    }

    if (!supabase) return;

    // 2. Request Notification Permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // 3. Check Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (session) {
        setCurrentUser(session.user);
        fetchData(session.user.id);
      }
    });

    // 4. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        setCurrentUser(session.user);
        fetchData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-Sync Effect
  useEffect(() => {
    if (!isAuthenticated || state.accounts.length === 0) return;
    
    const interval = setInterval(() => {
      state.accounts.forEach(acc => {
        if (acc.status === 'connected') {
          handleSyncAccount(acc.id, true); // True for silent background sync
        }
      });
    }, 120000); // Sync every 2 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated, state.accounts]);

  const fetchData = async (userId: string) => {
    if (!supabase) return;

    const [
      { data: emails },
      { data: domains },
      { data: tickets },
      { data: tasks },
      { data: automations },
      { data: accounts }
    ] = await Promise.all([
      supabase.from('emails').select('*').order('received_at', { ascending: false }),
      supabase.from('domains').select('*'),
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('automations').select('*').order('created_at', { ascending: false }),
      supabase.from('email_accounts').select('*')
    ]);

    setState(prev => ({
      ...prev,
      emails: emails && emails.length > 0 ? emails.map(e => ({
        id: e.id,
        accountId: e.account_id,
        from: e.from_address,
        subject: e.subject,
        content: e.body_text,
        date: e.received_at,
        isRead: e.is_read,
        isAnalyzed: !!e.ai_summary,
        aiInsights: e.ai_summary ? JSON.parse(e.ai_summary) : undefined
      })) : INITIAL_EMAILS,
      tickets: tickets && tickets.length > 0 ? tickets.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at,
        emailId: t.source_email_id
      })) : INITIAL_TICKETS,
      tasks: tasks && tasks.length > 0 ? tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date
      })) : INITIAL_TASKS,
      automations: automations && automations.length > 0 ? automations.map(a => ({
        id: a.id,
        name: a.name,
        condition: a.condition,
        action: a.action,
        isActive: a.is_active
      })) : INITIAL_AUTOMATIONS,
      accounts: accounts && accounts.length > 0 ? accounts.map(a => ({
        id: a.id,
        email: a.email_address,
        host: a.host,
        port: a.port,
        type: a.protocol,
        lastSync: a.last_sync_at,
        status: a.status
      })) : [],
      activeView: prev.activeView,
      isAnalyzing: false,
      selectedEmailId: null
    }));
    
    if (domains) {
      setConnectedDomains(domains.map(d => ({
        id: d.id,
        name: d.domain_name,
        type: d.provider === 'cloudflare' ? 'Cloudflare Sync' : 'Manual',
        verified: d.status === 'verified'
      })));
    }
  };

  const handleSaveSupabaseConfig = () => {
    saveSupabaseConfig(sbConfig.url, sbConfig.key);
    window.location.reload();
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const selectedEmail = useMemo(() => 
    state.emails.find(e => e.id === state.selectedEmailId)
  , [state.emails, state.selectedEmailId]);

  const unreadCount = useMemo(() => 
    state.emails.filter(e => !e.isRead).length
  , [state.emails]);

  const selectEmail = async (id: string) => {
    setState(p => ({ 
      ...p, 
      selectedEmailId: id, 
      emails: p.emails.map(e => e.id === id ? { ...e, isRead: true } : e) 
    }));
    setInboxViewMode('detail');
    
    if(supabase) {
       await supabase.from('emails').update({ is_read: true }).eq('id', id);
    }
  };

  const handleAnalyzeEmail = async (emailId: string) => {
    const email = state.emails.find(e => e.id === emailId);
    if (!email) return;
    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
      const insights = await analyzeEmail(email.content, email.subject);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        emails: prev.emails.map(e => e.id === emailId ? { ...e, isAnalyzed: true, aiInsights: insights } : e)
      }));
      if (supabase) {
        await supabase.from('emails').update({
           ai_summary: JSON.stringify(insights),
           ai_sentiment: insights.sentiment
        }).eq('id', emailId);
      }
    } catch (err) {
      setState(prev => ({ ...prev, isAnalyzing: false }));
      console.error(err);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedEmail) return;
    setIsDrafting(true);
    setShowDraftModal(true);
    try {
      const draft = await draftReply(selectedEmail.content, "Polite, helpful, enterprise tone.");
      setDraftContent(draft);
    } catch (err) {
      setDraftContent("Error generating draft.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleConnectDomain = async () => {
    if (!newDomainInput.includes('.')) return;
    setDomainModalStep('scanning');
    
    if (domainVerificationMethod === 'cloudflare') {
      setTimeout(() => {
         handleVerifyDNS(true);
      }, 3000);
      return;
    }

    try {
      const instructions = await getDNSInstructions(newDomainInput);
      setDnsInstructions(instructions);
      setTimeout(() => setDomainModalStep('instructions'), 1500);
    } catch (err) {
      setDomainModalStep('input');
    }
  };

  const handleVerifyDNS = async (isCloudflare = false) => {
    setIsVerifying(true);
    
    if (supabase && currentUser) {
      await supabase.from('domains').insert({
        user_id: currentUser.id,
        domain_name: newDomainInput,
        provider: isCloudflare ? 'cloudflare' : 'manual',
        status: 'verified'
      });
    }

    await new Promise(r => setTimeout(r, 2000));
    setIsVerifying(false);
    
    if (supabase && currentUser) {
      fetchData(currentUser.id);
    } else {
      setConnectedDomains(prev => [
        ...prev,
        { 
          id: `d-${Date.now()}`, 
          name: newDomainInput, 
          type: isCloudflare ? 'Cloudflare Sync' : 'Secondary Node', 
          verified: true 
        }
      ]);
    }
    setShowDomainModal(false);
    setDomainModalStep('input');
    setNewDomainInput('');
    setCloudflareToken('');
    setDomainVerificationMethod('manual');
  };

  const handleSyncAccount = async (accountId: string, background = false) => {
    if (!background) {
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === accountId ? { ...a, status: 'syncing' } : a)
      }));
    }

    if (!supabase) return;

    try {
      // 1. Invoke Edge Function to perform actual IMAP sync
      const { data, error } = await supabase.functions.invoke('email-handler', {
        body: { action: 'sync', accountId }
      });

      if (error) throw error;
      
      const newEmailCount = data?.count || 0;

      // Notify User
      if (newEmailCount > 0 && Notification.permission === 'granted') {
         new Notification('New Signal Detected', {
            body: `Received ${newEmailCount} new transmission(s).`,
            icon: '/vite.svg'
         });
      }

      // 2. Fetch updated data from DB
      await fetchData(currentUser.id);

    } catch (error) {
       console.error("Sync failed:", error);
       setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === accountId ? { ...a, status: 'error' } : a)
      }));
    }
  };

  const handleConnectAccount = async () => {
    setAccountStatus('auth');
    if (!supabase || !currentUser) return;
    
    // In a real production app, we should verify creds via backend first
    // For now, we save and try to sync
    
    try {
      await supabase.from('email_accounts').insert({
        user_id: currentUser.id,
        email_address: accountForm.email,
        auth_token: accountForm.password, // Storing encrypted in real world, raw here for demo
        host: accountForm.host || `imap.${accountForm.email.split('@')[1]}`,
        port: accountForm.port,
        protocol: 'imap',
        status: 'connected',
        last_sync_at: new Date().toISOString()
      });
      await fetchData(currentUser.id);
      
      setAccountStatus('success');
      setTimeout(() => {
        setShowAccountModal(false);
        setAccountStatus('idle');
        setAccountForm({ email: '', password: '', host: '', port: 993 });
      }, 1000);
    } catch (err) {
      setAccountStatus('idle');
      alert("Failed to connect account.");
    }
  };

  const handleSendEmail = async () => {
    if (!supabase || !currentUser) return;
    if (state.accounts.length === 0) {
      alert("Please connect an email account first.");
      return;
    }

    setIsSending(true);
    try {
      // Use the first account to send
      const accountId = state.accounts[0].id;
      
      const { error } = await supabase.functions.invoke('email-handler', {
        body: { 
          action: 'send', 
          accountId,
          to: composeForm.to,
          subject: composeForm.subject,
          content: composeForm.content
        }
      });

      if (error) throw error;
      
      // Optimistic update
      addEmail(composeForm.to, composeForm.subject, composeForm.content);
      setShowComposeModal(false);
      setComposeForm({ to: '', subject: '', content: '' });
      
    } catch (err) {
      console.error(err);
      alert("Failed to send transmission. Check backend logs.");
    } finally {
      setIsSending(false);
    }
  };

  const removeAccount = async (id: string) => {
    if (supabase) {
      await supabase.from('email_accounts').delete().eq('id', id);
      fetchData(currentUser.id);
    } else {
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.filter(a => a.id !== id),
        emails: prev.emails.filter(e => e.accountId !== id)
      }));
    }
  };

  const removeDomain = async (id: string) => {
    if (supabase) {
      await supabase.from('domains').delete().eq('id', id);
      fetchData(currentUser.id);
    } else {
      setConnectedDomains(prev => prev.filter(d => d.id !== id));
    }
  };

  const removeEmail = async (id: string) => {
    if (supabase) {
      await supabase.from('emails').delete().eq('id', id);
      setState(p => ({ ...p, emails: p.emails.filter(e => e.id !== id), selectedEmailId: p.selectedEmailId === id ? null : p.selectedEmailId }));
    } else {
      setState(p => ({ ...p, emails: p.emails.filter(e => e.id !== id), selectedEmailId: p.selectedEmailId === id ? null : p.selectedEmailId }));
    }
  };

  const removeTicket = async (id: string) => {
    if (supabase) {
      await supabase.from('tickets').delete().eq('id', id);
      fetchData(currentUser.id);
    } else {
      setState(p => ({ ...p, tickets: p.tickets.filter(t => t.id !== id) }));
    }
  };

  const removeTask = async (id: string) => {
    if (supabase) {
      await supabase.from('tasks').delete().eq('id', id);
      fetchData(currentUser.id);
    } else {
      setState(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));
    }
  };

  const removeAutomation = async (id: string) => {
    if (supabase) {
      await supabase.from('automations').delete().eq('id', id);
      fetchData(currentUser.id);
    } else {
      setState(p => ({ ...p, automations: p.automations.filter(a => a.id !== id) }));
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    const newStatus = task?.status === 'completed' ? 'pending' : 'completed';
    
    if (supabase) {
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      setState(p => ({
        ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      }));
    } else {
      setState(p => ({
        ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      }));
    }
  };

  const addTask = async (title: string, dueDate?: string) => {
    if (supabase && currentUser) {
       await supabase.from('tasks').insert({
         user_id: currentUser.id,
         title,
         status: 'pending',
         due_date: dueDate
       });
       fetchData(currentUser.id);
    } else {
      const newTask: Task = { id: `tk-${Date.now()}`, title, status: 'pending', dueDate };
      setState(p => ({ ...p, tasks: [newTask, ...p.tasks] }));
    }
  };

  const addTicket = async (title: string, description: string, priority: Priority) => {
    if (supabase && currentUser) {
      await supabase.from('tickets').insert({
        user_id: currentUser.id,
        title,
        description,
        priority,
        status: 'open'
      });
      fetchData(currentUser.id);
    } else {
      const newTicket: Ticket = { id: `t-${Date.now()}`, title, description, status: 'open', priority, createdAt: new Date().toISOString() };
      setState(p => ({ ...p, tickets: [newTicket, ...p.tickets] }));
    }
  };

  const addEmail = (to: string, subject: string, content: string) => {
    const newEmail: Email = { id: `e-${Date.now()}`, from: to, subject, content, date: new Date().toISOString(), isRead: true, isAnalyzed: false };
    setState(p => ({ ...p, emails: [newEmail, ...p.emails] }));
  };

  const addAutomation = async (name: string, condition: string, action: string) => {
    if (supabase && currentUser) {
       await supabase.from('automations').insert({
         user_id: currentUser.id,
         name,
         condition,
         action,
         is_active: true
       });
       fetchData(currentUser.id);
    } else {
      const newRule: AutomationRule = { id: `a-${Date.now()}`, name, condition, action, isActive: true };
      setState(p => ({ ...p, automations: [newRule, ...p.automations] }));
    }
  };

  const toggleAutomation = async (ruleId: string) => {
     const rule = state.automations.find(a => a.id === ruleId);
     const newState = !rule?.isActive;

     if (supabase) {
       await supabase.from('automations').update({ is_active: newState }).eq('id', ruleId);
       setState(p => ({
         ...p, automations: p.automations.map(a => a.id === ruleId ? { ...a, isActive: newState } : a)
       }));
     } else {
       setState(p => ({
         ...p, automations: p.automations.map(a => a.id === ruleId ? { ...a, isActive: newState } : a)
       }));
     }
  };

  const switchView = (view: AppState['activeView']) => {
    setState(p => ({ ...p, activeView: view }));
    setIsSidebarOpen(false);
    if (view === 'inbox') setInboxViewMode('list');
  };

  // Forms
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '' });
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'medium' as Priority });
  const [automationForm, setAutomationForm] = useState({ name: '', condition: '', action: '' });
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', content: '' });

  const handleLogin = () => {
    // Handled by supabase auth state change listener
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setIsAuthenticated(false);
    setState(prev => ({ ...prev, emails: [], tickets: [], tasks: [], automations: [], accounts: [] }));
  };

  if (!isAuthenticated && !showSupabaseConfigModal) {
    return <Landing onLogin={handleLogin} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Supabase Config Modal */}
      <Modal isOpen={showSupabaseConfigModal} onClose={() => {}} title="Database Configuration" isDarkMode={isDarkMode} subtitle="Connect your Supabase Project">
        <div className="space-y-6">
           <p className="text-sm opacity-70">To activate NexusMail AI, enter your Supabase Project credentials. These are saved locally.</p>
           <div>
             <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Project URL</label>
             <input type="text" placeholder="https://xyz.supabase.co" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={sbConfig.url} onChange={e => setSbConfig({...sbConfig, url: e.target.value})} />
           </div>
           <div>
             <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Anon Public Key</label>
             <input type="password" placeholder="eyJh..." className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={sbConfig.key} onChange={e => setSbConfig({...sbConfig, key: e.target.value})} />
           </div>
           <button onClick={handleSaveSupabaseConfig} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest mt-4">Connect Database</button>
        </div>
      </Modal>

      {/* Dynamic Modals */}
      <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Add Email Node" isDarkMode={isDarkMode}>
        {accountStatus === 'idle' && (
          <div className="space-y-4">
             <div>
               <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Email Address</label>
               <input type="email" placeholder="admin@company.com" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={accountForm.email} onChange={e => setAccountForm({...accountForm, email: e.target.value})} />
             </div>
             <div>
               <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">App Password / Key</label>
               <input type="password" placeholder="••••••••••••" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={accountForm.password} onChange={e => setAccountForm({...accountForm, password: e.target.value})} />
             </div>
             <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                   <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">IMAP Host</label>
                   <input type="text" placeholder={accountForm.email ? `imap.${accountForm.email.split('@')[1]}` : 'imap.server.com'} className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={accountForm.host} onChange={e => setAccountForm({...accountForm, host: e.target.value})} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase opacity-60 mb-2 block">Port</label>
                   <input type="number" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={accountForm.port} onChange={e => setAccountForm({...accountForm, port: parseInt(e.target.value)})} />
                </div>
             </div>
             <button onClick={handleConnectAccount} className="w-full py-4 bg-sky-500 text-white rounded-xl font-black uppercase tracking-widest mt-4">Connect Account</button>
          </div>
        )}
        {accountStatus === 'auth' && (
           <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-black animate-pulse text-sky-400">Authenticating with Server...</p>
           </div>
        )}
        {accountStatus === 'success' && (
           <div className="py-10 text-center space-y-4 text-emerald-500">
              <Icons.Zap className="w-16 h-16 mx-auto" />
              <p className="font-black text-xl">Account Connected Successfully</p>
           </div>
        )}
      </Modal>

      <Modal isOpen={showDraftModal} onClose={() => setShowDraftModal(false)} title="Neural Draft" isDarkMode={isDarkMode}>
        {isDrafting ? <div className="p-10 text-center font-black animate-pulse text-sky-400">Synthesizing Reply...</div> : (
          <div className="space-y-6">
            <textarea className={`w-full p-6 rounded-2xl border font-medium h-48 ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={draftContent} onChange={e => setDraftContent(e.target.value)} />
            <button className="w-full py-4 bg-sky-500 text-white rounded-xl font-black uppercase tracking-widest" onClick={() => setShowDraftModal(false)}>Copy to Clipboard</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showComposeModal} onClose={() => setShowComposeModal(false)} title="Compose Transmission" isDarkMode={isDarkMode}>
        <div className="space-y-6">
          <input type="text" placeholder="Recipient" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} />
          <input type="text" placeholder="Subject" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} />
          <textarea placeholder="Message content..." rows={6} className={`w-full p-4 rounded-xl border font-medium ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={composeForm.content} onChange={e => setComposeForm({...composeForm, content: e.target.value})} />
          <button className="w-full py-4 bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest" disabled={isSending} onClick={handleSendEmail}>
             {isSending ? 'Transmitting...' : 'Send Transmission'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showDomainModal} onClose={() => setShowDomainModal(false)} title="Domain Integration" isDarkMode={isDarkMode}>
        {domainModalStep === 'input' && (
          <div className="space-y-6">
             {/* Verification Method Toggle */}
             <div className="flex p-1 bg-slate-900/50 rounded-xl border border-slate-800">
                <button onClick={() => setDomainVerificationMethod('manual')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${domainVerificationMethod === 'manual' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Manual DNS</button>
                <button onClick={() => setDomainVerificationMethod('cloudflare')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${domainVerificationMethod === 'cloudflare' ? 'bg-[#F38020] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Cloudflare Sync</button>
             </div>

            <input type="text" placeholder="your-company.com" value={newDomainInput} onChange={(e) => setNewDomainInput(e.target.value)} className={`w-full px-5 py-4 rounded-2xl border text-lg font-bold ${isDarkMode ? 'bg-slate-900 border-slate-700' : ''}`} />
            
            {domainVerificationMethod === 'cloudflare' && (
               <input type="password" placeholder="Cloudflare API Token" value={cloudflareToken} onChange={(e) => setCloudflareToken(e.target.value)} className={`w-full px-5 py-4 rounded-2xl border text-lg font-bold ${isDarkMode ? 'bg-slate-900 border-slate-700' : ''}`} />
            )}

            <button onClick={handleConnectDomain} className={`w-full text-white py-5 rounded-2xl font-black uppercase tracking-widest ${domainVerificationMethod === 'cloudflare' ? 'bg-[#F38020]' : 'bg-gradient-to-r from-sky-500 to-indigo-600'}`}>
               {domainVerificationMethod === 'cloudflare' ? 'Auto-Sync DNS' : 'Synchronize Node'}
            </button>
          </div>
        )}
        {domainModalStep === 'scanning' && (
           <div className="py-16 text-center space-y-4">
              <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto ${domainVerificationMethod === 'cloudflare' ? 'border-[#F38020]' : 'border-sky-500'}`}></div>
              <p className="font-black animate-pulse text-sky-400">
                 {domainVerificationMethod === 'cloudflare' ? 'Authenticating with Cloudflare...' : 'Mapping DNS Logic...'}
              </p>
           </div>
        )}
        {domainModalStep === 'instructions' && (
          <div className="space-y-6">
            {dnsInstructions.map((dns, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : ''}`}>
                <Badge darkMode={isDarkMode}>{dns.type}</Badge>
                <div className="mt-2 text-[10px] font-mono opacity-60">NAME: {dns.name}</div>
                <div className="text-[10px] font-mono opacity-60 truncate">VALUE: {dns.content}</div>
              </div>
            ))}
            <button onClick={() => handleVerifyDNS(false)} disabled={isVerifying} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black">{isVerifying ? 'Verifying...' : 'Verify Logic'}</button>
          </div>
        )}
      </Modal>

      {/* Manual Creation Modals */}
      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="New Support Node" isDarkMode={isDarkMode}>
        <div className="space-y-4">
          <input type="text" placeholder="Title" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={ticketForm.title} onChange={e => setTicketForm({...ticketForm, title: e.target.value})} />
          <textarea placeholder="Description" className={`w-full p-4 rounded-xl border font-medium ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} rows={3} value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} />
          <select className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value as Priority})}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
          <button className="w-full py-4 bg-sky-500 text-white rounded-xl font-black" onClick={() => { addTicket(ticketForm.title, ticketForm.description, ticketForm.priority); setShowTicketModal(false); }}>Deploy Node</button>
        </div>
      </Modal>

      <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="New Logic Task" isDarkMode={isDarkMode}>
         <div className="space-y-4">
            <input type="text" placeholder="Task Title" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
            <input type="date" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} />
            <button className="w-full py-4 bg-indigo-500 text-white rounded-xl font-black" onClick={() => { addTask(taskForm.title, taskForm.dueDate); setShowTaskModal(false); }}>Deploy Task</button>
         </div>
      </Modal>

      <Modal isOpen={showAutomationModal} onClose={() => setShowAutomationModal(false)} title="New Flow Rule" isDarkMode={isDarkMode}>
         <div className="space-y-4">
            <input type="text" placeholder="Rule Name (e.g., Auto-Label Billing)" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={automationForm.name} onChange={e => setAutomationForm({...automationForm, name: e.target.value})} />
            <input type="text" placeholder="Condition (e.g., Subject contains 'Invoice')" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={automationForm.condition} onChange={e => setAutomationForm({...automationForm, condition: e.target.value})} />
            <input type="text" placeholder="Action (e.g., Create Urgent Ticket)" className={`w-full p-4 rounded-xl border font-bold ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`} value={automationForm.action} onChange={e => setAutomationForm({...automationForm, action: e.target.value})} />
            <button className="w-full py-4 bg-fuchsia-600 text-white rounded-xl font-black" onClick={() => { addAutomation(automationForm.name, automationForm.condition, automationForm.action); setShowAutomationModal(false); }}>Init Flow</button>
         </div>
      </Modal>

      {/* Sidebar */}
      <nav className={`fixed inset-y-0 left-0 w-80 z-50 transform transition-transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r flex flex-col ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-10 border-b flex items-center gap-5">
          <NexusLogo /><span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-sky-400 to-fuchsia-500 bg-clip-text text-transparent">NexusMail</span>
        </div>
        <div className="flex-1 py-10 px-5 space-y-3">
          {[
            { id: 'inbox', label: 'Signal Hub', icon: Icons.Inbox },
            { id: 'tickets', label: 'Support Nodes', icon: Icons.Ticket },
            { id: 'tasks', label: 'Logic Tasks', icon: Icons.Task },
            { id: 'automations', label: 'Flow Matrix', icon: Icons.Zap },
            { id: 'settings', label: 'System Config', icon: Icons.Settings },
          ].map(item => (
            <button key={item.id} onClick={() => switchView(item.id as any)} className={`w-full flex items-center gap-5 px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest ${state.activeView === item.id ? 'bg-sky-500/10 text-sky-400' : 'text-slate-500 hover:text-slate-200'}`}>
              <item.icon className="w-6 h-6" />{item.label}{item.id === 'inbox' && unreadCount > 0 && <span className="ml-auto px-2 py-1 bg-fuchsia-500/20 text-fuchsia-400 rounded-full text-[10px]">{unreadCount}</span>}
            </button>
          ))}
        </div>
        <div className="p-5 border-t border-slate-800">
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 text-xs font-bold uppercase text-slate-500 hover:text-white transition-colors">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             Terminate Session
           </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className={`h-24 border-b flex items-center justify-between px-10 transition-all ${isDarkMode ? 'bg-[#020617]/90 backdrop-blur-xl border-slate-800' : 'bg-white'}`}>
          <h2 className="text-2xl font-black uppercase tracking-tighter">{state.activeView} Matrix</h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowComposeModal(true)} className="p-3 bg-sky-500 text-white rounded-xl shadow-lg"><Icons.Sparkles className="w-5 h-5" /></button>
            <button onClick={toggleDarkMode} className="p-3 bg-slate-800 text-amber-400 rounded-xl">{isDarkMode ? <Icons.Sun className="w-5 h-5" /> : <Icons.Moon className="w-5 h-5" />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {state.activeView === 'inbox' && (
            <div className="flex h-full">
              <div className={`${inboxViewMode === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-[460px] border-r flex flex-col overflow-y-auto ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white'}`}>
                {state.emails.length === 0 ? (
                  <div className="p-8 text-center opacity-40 mt-10">No signals detected.</div>
                ) : (
                  state.emails.map(email => (
                    <div key={email.id} onClick={() => selectEmail(email.id)} className={`p-8 border-b cursor-pointer relative ${state.selectedEmailId === email.id ? 'bg-sky-500/5 border-l-4 border-l-sky-500' : 'hover:bg-slate-800/20'}`}>
                      {!email.isRead && <div className="absolute top-9 right-8 w-3 h-3 bg-sky-500 rounded-full shadow-lg"></div>}
                      <h4 className="text-base font-black truncate">{email.subject}</h4>
                      <p className="text-xs opacity-60 line-clamp-2">{email.content}</p>
                      <button onClick={(e) => { e.stopPropagation(); removeEmail(email.id); }} className="absolute bottom-4 right-4 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><Icons.Settings className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-10 md:p-20">
                {selectedEmail ? (
                  <div className="max-w-4xl space-y-10">
                    <div className="p-10 rounded-[3rem] border border-slate-800 bg-slate-900/20 shadow-2xl">
                      <div className="flex justify-between items-start mb-8">
                        <div><h3 className="text-3xl font-black mb-2">{selectedEmail.subject}</h3><p className="text-xs opacity-40 uppercase">{selectedEmail.from}</p></div>
                        <div className="flex gap-4">
                          <button onClick={handleDraftReply} className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-black uppercase text-xs">Reply Draft</button>
                          <button onClick={() => handleAnalyzeEmail(selectedEmail.id)} disabled={state.isAnalyzing} className="px-6 py-3 bg-sky-500 text-white rounded-xl font-black uppercase text-xs">{state.isAnalyzing ? 'Analyzing...' : 'Analyze'}</button>
                        </div>
                      </div>
                      <p className="text-lg leading-relaxed opacity-80 whitespace-pre-wrap">{selectedEmail.content}</p>
                    </div>
                    {selectedEmail.isAnalyzed && selectedEmail.aiInsights && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="p-8 rounded-[2rem] border border-sky-500/20 bg-[#0f172a]"><h4 className="font-black text-xs text-sky-400 mb-4 uppercase">AI Insights</h4><p className="font-bold">{selectedEmail.aiInsights.summary}</p></div>
                        <div className="p-8 rounded-[2rem] border border-slate-800 bg-[#0f172a]"><h4 className="font-black text-xs mb-4 uppercase">Logic extraction</h4>{selectedEmail.aiInsights.suggestedTasks.map((t, i) => <div key={i} className="flex justify-between items-center mt-2 p-3 bg-black/20 rounded-lg"><span className="text-sm font-bold">{t}</span><button onClick={() => addTask(t)} className="text-sky-500"><Icons.Zap className="w-4 h-4" /></button></div>)}</div>
                      </div>
                    )}
                  </div>
                ) : <div className="h-full flex items-center justify-center opacity-20 font-black uppercase tracking-[0.5em]">Awaiting Selection</div>}
              </div>
            </div>
          )}

          {state.activeView === 'tickets' && (
            <div className="p-10 md:p-20 overflow-y-auto h-full">
              <div className="max-w-5xl mx-auto"><div className="flex justify-between mb-10"><h3 className="text-3xl font-black uppercase">Support Nodes</h3><button onClick={() => setShowTicketModal(true)} className="px-6 py-3 bg-sky-500 rounded-xl font-black uppercase text-xs">New Node</button></div>
              <div className="space-y-4">{state.tickets.map(t => <div key={t.id} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 flex justify-between items-center border-l-4 border-l-sky-500"><div><PriorityBadge priority={t.priority} darkMode={isDarkMode} /><h4 className="text-xl font-black mt-2">{t.title}</h4></div><button onClick={() => removeTicket(t.id)} className="text-rose-500"><Icons.Settings className="w-5 h-5" /></button></div>)}</div></div>
            </div>
          )}

          {state.activeView === 'tasks' && (
            <div className="p-10 md:p-20 overflow-y-auto h-full">
              <div className="max-w-4xl mx-auto"><div className="flex justify-between mb-10"><h3 className="text-3xl font-black uppercase">Logic Tasks</h3><button onClick={() => setShowTaskModal(true)} className="px-6 py-3 bg-indigo-500 rounded-xl font-black uppercase text-xs">Add Task</button></div>
              <div className="space-y-2">{state.tasks.map(t => <div key={t.id} onClick={() => toggleTask(t.id)} className={`p-5 rounded-xl border flex justify-between items-center cursor-pointer ${t.status === 'completed' ? 'opacity-40 border-emerald-500/20' : 'bg-slate-900/40 border-slate-800'}`}><span className={t.status === 'completed' ? 'line-through' : 'font-bold'}>{t.title}</span><button onClick={(e) => { e.stopPropagation(); removeTask(t.id); }} className="text-red-400 opacity-0 group-hover:opacity-100">Delete</button></div>)}</div></div>
            </div>
          )}

          {state.activeView === 'automations' && (
            <div className="p-10 md:p-20 overflow-y-auto h-full">
              <div className="max-w-6xl mx-auto"><div className="flex justify-between mb-10"><h3 className="text-3xl font-black uppercase">Flow Matrix</h3><button onClick={() => setShowAutomationModal(true)} className="px-6 py-3 bg-fuchsia-600 rounded-xl font-black uppercase text-xs">Add Flow</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{state.automations.map(a => <div key={a.id} className="p-8 rounded-[2rem] border border-slate-800 bg-slate-900/40 flex flex-col"><div className="flex justify-between mb-4"><h4 className="text-xl font-black">{a.name}</h4><ToggleSwitch checked={a.isActive} onChange={() => toggleAutomation(a.id)} darkMode={isDarkMode} /></div><div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-sky-400 mb-2">IF: {a.condition}</div><div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-fuchsia-400">THEN: {a.action}</div><button onClick={() => removeAutomation(a.id)} className="mt-4 text-xs font-black uppercase text-rose-500 self-end">Prune Node</button></div>)}</div></div>
            </div>
          )}

          {state.activeView === 'settings' && (
            <div className="p-10 md:p-20 overflow-y-auto h-full">
              <div className="max-w-3xl mx-auto space-y-12">
                <section>
                   <h3 className="text-2xl font-black uppercase mb-8">Connected Accounts</h3>
                   <div className="space-y-4">
                     {state.accounts.map(acc => (
                        <div key={acc.id} className={`p-6 rounded-2xl border transition-all flex justify-between items-center group ${acc.status === 'error' ? 'border-rose-500/50 bg-rose-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                           <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl transition-all ${acc.status === 'syncing' ? 'animate-spin text-sky-500 bg-sky-500/10' : (acc.status === 'error' ? 'text-rose-500 bg-rose-500/10' : 'text-emerald-500 bg-emerald-500/10')}`}>
                                 {acc.status === 'syncing' ? <Icons.Refresh className="w-6 h-6" /> : <Icons.Server className="w-6 h-6" />}
                              </div>
                              <div>
                                 <p className="font-black text-lg">{acc.email}</p>
                                 <div className="flex items-center gap-2">
                                   <p className="text-[10px] uppercase opacity-40">
                                      {acc.status === 'syncing' ? 'Syncing...' : (acc.status === 'error' ? 'Connection Error' : 'IMAP Connected')}
                                   </p>
                                   {acc.status === 'connected' && <span className="text-[10px] opacity-30">• Last Sync: {new Date(acc.lastSync).toLocaleTimeString()}</span>}
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                             <button onClick={() => handleSyncAccount(acc.id)} className="p-2 text-sky-500 hover:bg-sky-500/10 rounded-lg transition-all" title="Sync Now">
                                <Icons.Refresh className={`w-5 h-5 ${acc.status === 'syncing' ? 'animate-spin' : ''}`} />
                             </button>
                             <button onClick={() => removeAccount(acc.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" title="Disconnect">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                           </div>
                        </div>
                     ))}
                     <button onClick={() => setShowAccountModal(true)} className="w-full p-8 border-2 border-dashed border-slate-800 rounded-[2rem] opacity-40 hover:opacity-100 font-black uppercase text-xs hover:border-sky-500 hover:bg-sky-500/5 transition-all">Connect New Email Account</button>
                   </div>
                </section>
                <section><h3 className="text-2xl font-black uppercase mb-8">Node Connections</h3><div className="space-y-4">{connectedDomains.map(d => <div key={d.id} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 flex justify-between items-center"><div><p className="font-black text-lg">{d.name}</p><p className="text-[10px] uppercase opacity-40">{d.type}</p></div><button onClick={() => removeDomain(d.id)} className="text-rose-500">Delete</button></div>)}<button onClick={() => { setDomainModalStep('input'); setShowDomainModal(true); }} className="w-full p-8 border-2 border-dashed border-slate-800 rounded-[2rem] opacity-40 hover:opacity-100 font-black uppercase text-xs">Sync New Node</button></div></section>
                <section><h3 className="text-2xl font-black uppercase mb-8">System Protocols</h3><div className="p-8 border border-slate-800 rounded-[2rem] bg-slate-900/20 flex justify-between items-center"><div><p className="font-black text-lg">Neural Auto-Index</p><p className="text-xs opacity-50">Auto-summarize incoming transmissions.</p></div><ToggleSwitch checked={true} onChange={() => {}} darkMode={isDarkMode} /></div></section>
                <div className="pt-20 border-t border-slate-800 opacity-40 text-[10px] font-black uppercase flex justify-between"><span>NexusMail v2.6.0 Enterprise</span><span>© 2024 Global Nexus Systems</span></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
