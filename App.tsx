
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
import { analyzeEmail, getDNSInstructions, draftReply, DNSInstruction, verifyDNSRecord } from './services/gemini';
import Landing from './Landing';
import { supabase, saveSupabaseConfig, getSupabaseConfig, clearSupabaseConfig } from './lib/supabase';

// P3 Logo Component
export const P3LogoSVG = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={`${className}`}>
    <circle cx="50" cy="50" r="45" fill="#111" stroke="#10b981" strokeWidth="4" />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="40" fontWeight="900" fontFamily="Inter, sans-serif">
      P<tspan fontSize="24" dy="-15">3</tspan>
    </text>
  </svg>
);

// UI Components
const Badge = ({ children, color = 'emerald' }: { children?: React.ReactNode, color?: string }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    blue: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    red: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    gray: 'bg-slate-800 text-slate-400 border border-slate-700',
  };
  return <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${colors[color] || colors.emerald}`}>{children}</span>;
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const color = priority === 'urgent' ? 'red' : priority === 'high' ? 'amber' : priority === 'medium' ? 'blue' : 'gray';
  return <Badge color={color}>{priority}</Badge>;
};

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
    <div className={`w-11 h-6 rounded-full peer transition-all border border-slate-700 bg-slate-800 peer-checked:bg-emerald-500 peer-checked:border-emerald-400 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full`}></div>
  </label>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-800 bg-[#0a0a0a]">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-8 custom-scrollbar max-h-[70vh] overflow-y-auto text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
};

// Reusable Card Component
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-[#111] border border-slate-800 rounded-3xl overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', content: '' });
  const [ticketForm, setTicketForm] = useState<{ title: string; description: string; priority: Priority }>({ title: '', description: '', priority: 'low' });
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '' });
  const [automationForm, setAutomationForm] = useState({ name: '', condition: '', action: '' });

  // Domain Modal
  const [domainModalStep, setDomainModalStep] = useState<'input' | 'scanning' | 'instructions'>('input');
  const [domainVerificationMethod, setDomainVerificationMethod] = useState<'manual' | 'cloudflare'>('manual');
  const [cloudflareToken, setCloudflareToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('Initializing...');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [dnsInstructions, setDnsInstructions] = useState<DNSInstruction[]>([]);
  const [connectedDomains, setConnectedDomains] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
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
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      setShowSupabaseConfigModal(true);
      return;
    }

    if (!supabase) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (session) {
        setCurrentUser(session.user);
        fetchData(session.user.id);
      }
    });

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

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveSupabaseConfig = () => {
    saveSupabaseConfig(sbConfig.url, sbConfig.key);
    window.location.reload();
  };

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
    if (!newDomainInput.includes('.')) {
      alert('Please enter a valid domain (e.g., example.com)');
      return;
    }
    
    // Generate a unique token for real verification
    const token = `p3-verification=${Math.random().toString(36).substring(2, 12)}`;
    setVerificationToken(token);
    
    // 1. Get Config Instructions (using AI)
    setDomainModalStep('scanning');
    setVerificationStatus('Calculating Configuration...');

    try {
      const instructions = await getDNSInstructions(newDomainInput, token);
      setDnsInstructions(instructions);
      
      // If Cloudflare is selected, perform automated sync immediately
      if (domainVerificationMethod === 'cloudflare') {
         handleCloudflareSync(newDomainInput, instructions);
      } else {
         setDomainModalStep('instructions');
      }
    } catch (err: any) {
      console.error("Domain connection error:", err);
      // Give feedback but don't get stuck in scanning
      setVerificationStatus("Error: " + (err.message || "Unknown error"));
      setTimeout(() => {
        setDomainModalStep('input');
        alert("Failed to connect domain. " + (err.message || "Please check your input and try again."));
      }, 1500);
    }
  };

  const handleCloudflareSync = async (domain: string, records: DNSInstruction[]) => {
     setVerificationStatus('Syncing with Cloudflare API...');
     if (!supabase) return;

     try {
       const { data, error } = await supabase.functions.invoke('domain-handler', {
          body: {
             action: 'sync-dns',
             domain: domain,
             records: records
          }
       });

       if (error) throw error;
       
       setVerificationStatus('Cloudflare Sync Complete.');
       
       if (currentUser) {
         await supabase.from('domains').insert({
            user_id: currentUser.id,
            domain_name: domain,
            provider: 'cloudflare',
            status: 'verified',
            verification_record: verificationToken
         });
         await fetchData(currentUser.id);
       }
       
       setTimeout(() => {
          setShowDomainModal(false);
          setDomainModalStep('input');
          setNewDomainInput('');
          // Switch to settings view to see the new domain
          setState(prev => ({ ...prev, activeView: 'settings' }));
       }, 1500);

     } catch (err: any) {
       console.error(err);
       setVerificationStatus('Sync Failed: ' + (err.message || 'Check Server Logs'));
       setTimeout(() => setDomainModalStep('input'), 3000);
       alert("Cloudflare Sync Failed: " + err.message);
     }
  };

  const handleVerifyDNS = async () => {
    // Manual Verification Path (Strict)
    setIsVerifying(true);
    setVerificationStatus('Querying Global DNS...');
    
    // Real DNS Check
    const isVerified = await verifyDNSRecord(newDomainInput, verificationToken);
    
    if (!isVerified) {
       setVerificationStatus('Record Not Found');
       setIsVerifying(false);
       alert(`Verification Failed. Could not find TXT record: ${verificationToken} on ${newDomainInput}. Please allow propagation time.`);
       return;
    }

    setVerificationStatus('Securing Connection...');

    await saveDomainToDb('verified');
  };

  const handleCompleteSetup = async () => {
    // Permissive Verification Path
    setIsVerifying(true);
    setVerificationStatus('Verifying configuration...');
    
    let isVerified = await verifyDNSRecord(newDomainInput, verificationToken);
    
    if (!isVerified) {
       const confirmForce = window.confirm(
         "DNS records could not be verified yet. Propagation can take up to 24 hours.\n\nDo you want to add this domain to your dashboard anyway?"
       );
       
       if (!confirmForce) {
         setVerificationStatus('Verification Failed');
         setIsVerifying(false);
         return;
       }
       // If forced, we proceed with 'verified' status for the dashboard
    }

    setVerificationStatus('Finalizing...');
    await saveDomainToDb('verified');
  };

  const saveDomainToDb = async (status: string) => {
    if (supabase && currentUser) {
      await supabase.from('domains').insert({
        user_id: currentUser.id,
        domain_name: newDomainInput,
        provider: 'manual',
        status: status,
        verification_record: verificationToken
      });
      await fetchData(currentUser.id);
    } else {
      setConnectedDomains(prev => [
        ...prev,
        { 
          id: `d-${Date.now()}`, 
          name: newDomainInput, 
          type: 'Manual',
          verified: true 
        }
      ]);
    }

    setIsVerifying(false);
    setShowDomainModal(false);
    setDomainModalStep('input');
    setNewDomainInput('');
    setCloudflareToken('');
    setDomainVerificationMethod('manual');
    
    // Auto-navigate to settings to see the result
    setState(prev => ({ ...prev, activeView: 'settings' }));
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
         new Notification('New P3 Signal', {
            body: `${newEmailCount} new message(s) received.`,
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
    
    try {
      const newAccount = {
        user_id: currentUser.id,
        email_address: accountForm.email,
        auth_token: accountForm.password,
        host: accountForm.host || `imap.${accountForm.email.split('@')[1]}`,
        port: accountForm.port,
        protocol: 'imap',
        status: 'connected',
        last_sync_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('email_accounts').insert(newAccount).select().single();
      
      if (error) throw error;
      
      // Update local state immediately to reflect the change
      setState(prev => ({
         ...prev,
         accounts: [...prev.accounts, {
            id: data.id,
            email: data.email_address,
            host: data.host,
            port: data.port,
            type: data.protocol,
            lastSync: data.last_sync_at,
            status: data.status
         }]
      }));

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

  const handleLogin = () => {};

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setIsAuthenticated(false);
    setState(prev => ({ ...prev, emails: [], tickets: [], tasks: [], automations: [], accounts: [] }));
  };

  if (!isAuthenticated && !showSupabaseConfigModal) {
    return <Landing onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617] text-white font-sans selection:bg-emerald-500/30">
      
      {/* Supabase Config Modal */}
      <Modal isOpen={showSupabaseConfigModal} onClose={() => {}} title="Database Configuration">
        <div className="space-y-6">
           <p className="text-sm text-slate-400">Enter Supabase credentials to activate P3 internal tools.</p>
           <div>
             <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Project URL</label>
             <input type="text" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white font-mono text-sm focus:border-emerald-500 outline-none" value={sbConfig.url} onChange={e => setSbConfig({...sbConfig, url: e.target.value})} />
           </div>
           <div>
             <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Anon Public Key</label>
             <input type="password" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white font-mono text-sm focus:border-emerald-500 outline-none" value={sbConfig.key} onChange={e => setSbConfig({...sbConfig, key: e.target.value})} />
           </div>
           <button onClick={handleSaveSupabaseConfig} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest mt-4 transition-colors">Connect Database</button>
        </div>
      </Modal>

      {/* Dynamic Modals */}
      <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Add Email Node">
        {accountStatus === 'idle' && (
          <div className="space-y-4">
             <input type="email" placeholder="admin@p3lending.space" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.email} onChange={e => setAccountForm({...accountForm, email: e.target.value})} />
             <input type="password" placeholder="App Password" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.password} onChange={e => setAccountForm({...accountForm, password: e.target.value})} />
             <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                   <input type="text" placeholder="imap.host.com" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.host} onChange={e => setAccountForm({...accountForm, host: e.target.value})} />
                </div>
                <div>
                   <input type="number" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.port} onChange={e => setAccountForm({...accountForm, port: parseInt(e.target.value)})} />
                </div>
             </div>
             <button onClick={handleConnectAccount} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest mt-4">Connect Node</button>
          </div>
        )}
        {accountStatus === 'auth' && (
           <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-bold animate-pulse text-emerald-400">Authenticating...</p>
           </div>
        )}
        {accountStatus === 'success' && (
           <div className="py-10 text-center space-y-4 text-emerald-500">
              <Icons.Zap className="w-16 h-16 mx-auto" />
              <p className="font-bold text-xl">Node Active</p>
           </div>
        )}
      </Modal>

      <Modal isOpen={showDraftModal} onClose={() => setShowDraftModal(false)} title="Neural Draft">
        {isDrafting ? <div className="p-10 text-center font-bold animate-pulse text-emerald-400">Synthesizing...</div> : (
          <div className="space-y-6">
            <textarea className="w-full p-6 rounded-2xl bg-[#1a1a1a] border border-slate-800 text-white h-48" value={draftContent} onChange={e => setDraftContent(e.target.value)} />
            <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest" onClick={() => setShowDraftModal(false)}>Copy to Clipboard</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showComposeModal} onClose={() => setShowComposeModal(false)} title="New Transmission">
        <div className="space-y-6">
          <input type="text" placeholder="Recipient" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} />
          <input type="text" placeholder="Subject" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} />
          <textarea placeholder="Message content..." rows={6} className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.content} onChange={e => setComposeForm({...composeForm, content: e.target.value})} />
          <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest" disabled={isSending} onClick={handleSendEmail}>
             {isSending ? 'Sending...' : 'Send Transmission'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showDomainModal} onClose={() => setShowDomainModal(false)} title="Domain Integration">
        {domainModalStep === 'input' && (
          <div className="space-y-6">
             <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
                <button onClick={() => setDomainVerificationMethod('manual')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${domainVerificationMethod === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Manual</button>
                <button onClick={() => setDomainVerificationMethod('cloudflare')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${domainVerificationMethod === 'cloudflare' ? 'bg-[#F38020] text-white' : 'text-slate-500'}`}>Cloudflare</button>
             </div>
            <input type="text" placeholder="p3-lending.com" value={newDomainInput} onChange={(e) => setNewDomainInput(e.target.value)} className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" />
            <button onClick={handleConnectDomain} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest">Connect</button>
          </div>
        )}
        {domainModalStep === 'scanning' && (
           <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="font-bold animate-pulse text-emerald-400">{verificationStatus}</p>
           </div>
        )}
        {domainModalStep === 'instructions' && (
          <div className="space-y-6">
            {dnsInstructions.map((dns, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 flex justify-between items-start group">
                <div className="flex-1 min-w-0 pr-4">
                  <Badge color="blue">{dns.type}</Badge>
                  <div className="mt-2 text-[10px] font-mono text-slate-400">NAME: {dns.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 break-all">VALUE: {dns.content}</div>
                </div>
                <button 
                  onClick={() => handleCopy(dns.content, idx)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedIndex === idx ? <Icons.CheckCircle className="w-4 h-4 text-emerald-500" /> : <Icons.Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleVerifyDNS} 
                disabled={isVerifying} 
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
              >
                {isVerifying ? 'Checking...' : 'Re-check Status'}
              </button>
              <button 
                onClick={handleCompleteSetup} 
                disabled={isVerifying} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="New Support Ticket">
        <div className="space-y-4">
          <input type="text" placeholder="Title" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={ticketForm.title} onChange={e => setTicketForm({...ticketForm, title: e.target.value})} />
          <textarea placeholder="Description" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" rows={3} value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} />
          <select className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value as Priority})}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
          <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold" onClick={() => { addTicket(ticketForm.title, ticketForm.description, ticketForm.priority); setShowTicketModal(false); }}>Create Ticket</button>
        </div>
      </Modal>

      <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="New Task">
         <div className="space-y-4">
            <input type="text" placeholder="Title" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
            <input type="date" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} />
            <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold" onClick={() => { addTask(taskForm.title, taskForm.dueDate); setShowTaskModal(false); }}>Add Task</button>
         </div>
      </Modal>

      <Modal isOpen={showAutomationModal} onClose={() => setShowAutomationModal(false)} title="New Automation Rule">
         <div className="space-y-4">
            <input type="text" placeholder="Name" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={automationForm.name} onChange={e => setAutomationForm({...automationForm, name: e.target.value})} />
            <input type="text" placeholder="Condition" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={automationForm.condition} onChange={e => setAutomationForm({...automationForm, condition: e.target.value})} />
            <input type="text" placeholder="Action" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={automationForm.action} onChange={e => setAutomationForm({...automationForm, action: e.target.value})} />
            <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold" onClick={() => { addAutomation(automationForm.name, automationForm.condition, automationForm.action); setShowAutomationModal(false); }}>Save Rule</button>
         </div>
      </Modal>

      {/* SIDEBAR */}
      <nav className="w-80 bg-black border-r border-slate-800 flex flex-col relative z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10"><P3LogoSVG /></div>
          <div>
             <h1 className="text-xl font-black text-white leading-none">Lending</h1>
             <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Internal Tools</span>
          </div>
        </div>
        
        <div className="flex-1 py-8 px-4 space-y-2">
          {[
            { id: 'inbox', label: 'Inbox', icon: Icons.Inbox },
            { id: 'tickets', label: 'Support', icon: Icons.Ticket },
            { id: 'tasks', label: 'Tasks', icon: Icons.Task },
            { id: 'automations', label: 'Automations', icon: Icons.Zap },
            { id: 'settings', label: 'Settings', icon: Icons.Settings },
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => switchView(item.id as any)} 
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-sm font-bold transition-all duration-200 group
              ${state.activeView === item.id 
                ? 'bg-[#111] text-emerald-400 border-l-4 border-emerald-500 shadow-lg' 
                : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon className={`w-5 h-5 ${state.activeView === item.id ? 'text-emerald-400' : 'text-slate-600 group-hover:text-white'}`} />
              {item.label}
              {item.id === 'inbox' && unreadCount > 0 && (
                <span className="ml-auto w-5 h-5 flex items-center justify-center bg-emerald-500 text-black text-[10px] font-black rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-slate-800">
          <div className="bg-[#111] p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-black">
                {currentUser?.email?.[0].toUpperCase() || 'U'}
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate">{currentUser?.email || 'User'}</p>
                <p className="text-[10px] text-emerald-500 font-mono truncate">ID: {currentUser?.id.slice(0,8)}...</p>
             </div>
             <button onClick={handleLogout} className="text-slate-500 hover:text-red-400">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
         {/* GRID BACKGROUND */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        {/* HEADER */}
        <header className="h-24 px-10 flex items-center justify-between relative z-10 border-b border-slate-800/50 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-black text-white">My Dashboard</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">System Online</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="px-5 py-2.5 bg-[#111] border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition-all flex items-center gap-2">
               <Icons.Sparkles className="w-4 h-4" />
               Risk Profile
            </button>
            <button onClick={() => setShowComposeModal(true)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all">
               New Transmission
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden relative z-10 p-8">
          
          {state.activeView === 'inbox' && (
             <div className="grid grid-cols-12 gap-8 h-full">
                {/* Email List - Styled as Cards */}
                <div className={`col-span-12 ${inboxViewMode === 'detail' ? 'md:col-span-5' : 'md:col-span-12'} flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar`}>
                   {state.emails.map(email => (
                      <Card key={email.id} className={`p-6 cursor-pointer transition-all hover:border-emerald-500/50 group ${state.selectedEmailId === email.id ? 'border-emerald-500 bg-[#161616]' : ''}`}>
                         <div onClick={() => selectEmail(email.id)}>
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-3">
                                  {!email.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{email.from.split('@')[0]}</span>
                               </div>
                               <span className="text-[10px] text-slate-600 font-mono">{new Date(email.date).toLocaleDateString()}</span>
                            </div>
                            <h4 className="text-sm font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{email.subject}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{email.content}</p>
                         </div>
                         <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                            <Badge color={email.isAnalyzed ? 'emerald' : 'gray'}>{email.isAnalyzed ? 'AI Processed' : 'Raw Signal'}</Badge>
                            <button onClick={(e) => { e.stopPropagation(); removeEmail(email.id); }} className="text-slate-600 hover:text-red-500"><Icons.Settings className="w-4 h-4" /></button>
                         </div>
                      </Card>
                   ))}
                </div>

                {/* Email Detail View */}
                {inboxViewMode === 'detail' && selectedEmail && (
                   <Card className="col-span-12 md:col-span-7 flex flex-col h-full overflow-hidden animate-in slide-in-from-right-10 duration-300">
                      <div className="p-8 border-b border-slate-800 bg-[#151515]">
                         <div className="flex justify-between items-start mb-6">
                            <div>
                               <h2 className="text-xl font-bold text-white mb-2">{selectedEmail.subject}</h2>
                               <p className="text-xs text-emerald-500 font-mono">{selectedEmail.from}</p>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={handleDraftReply} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700">Reply</button>
                               <button onClick={() => handleAnalyzeEmail(selectedEmail.id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500">{state.isAnalyzing ? 'Processing...' : 'Analyze'}</button>
                            </div>
                         </div>
                         <div className="p-6 bg-black rounded-2xl border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                            {selectedEmail.content}
                         </div>
                      </div>
                      
                      {selectedEmail.aiInsights && (
                         <div className="flex-1 overflow-y-auto p-8 bg-[#111]">
                            <div className="grid grid-cols-2 gap-6">
                               <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-slate-800">
                                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Sentiment Analysis</h4>
                                  <div className="text-sm font-medium text-white mb-2 capitalize">{selectedEmail.aiInsights.sentiment}</div>
                                  <p className="text-xs text-slate-500">{selectedEmail.aiInsights.summary}</p>
                               </div>
                               <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-slate-800">
                                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Extracted Tasks</h4>
                                  <div className="space-y-2">
                                     {selectedEmail.aiInsights.suggestedTasks.map((task, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#111] border border-slate-800">
                                           <span className="text-xs text-slate-300">{task}</span>
                                           <button onClick={() => addTask(task)} className="text-emerald-500 hover:text-white"><Icons.Zap className="w-4 h-4" /></button>
                                        </div>
                                     ))}
                                  </div>
                               </div>
                            </div>
                         </div>
                      )}
                   </Card>
                )}
             </div>
          )}

          {state.activeView === 'tickets' && (
             <div className="h-full overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-white">Active Tickets</h3>
                   <button onClick={() => setShowTicketModal(true)} className="px-6 py-3 bg-emerald-600 rounded-xl text-xs font-bold uppercase">New Ticket</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {state.tickets.map(ticket => (
                      <Card key={ticket.id} className="p-6 hover:border-slate-600 transition-colors">
                         <div className="flex justify-between items-start mb-4">
                            <PriorityBadge priority={ticket.priority} />
                            <span className="text-[10px] font-mono text-slate-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                         </div>
                         <h4 className="font-bold text-white mb-2">{ticket.title}</h4>
                         <p className="text-xs text-slate-400 line-clamp-3 mb-6">{ticket.description}</p>
                         <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-500">{ticket.status}</span>
                            <button onClick={() => removeTicket(ticket.id)} className="text-slate-600 hover:text-red-500"><Icons.Settings className="w-4 h-4" /></button>
                         </div>
                      </Card>
                   ))}
                </div>
             </div>
          )}
          
          {/* Implement other views similarly with Card components... */}
          {state.activeView === 'tasks' && (
            <div className="h-full overflow-y-auto custom-scrollbar">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-white">Tasks & Logic</h3>
                  <button onClick={() => setShowTaskModal(true)} className="px-6 py-3 bg-blue-600 rounded-xl text-xs font-bold uppercase">New Task</button>
               </div>
               <div className="space-y-3">
                  {state.tasks.map(task => (
                     <Card key={task.id} className={`p-4 flex justify-between items-center cursor-pointer hover:bg-[#1a1a1a] ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-4" onClick={() => toggleTask(task.id)}>
                           <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${task.status === 'completed' ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600'}`}>
                              {task.status === 'completed' && <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>}
                           </div>
                           <span className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</span>
                        </div>
                        <button onClick={() => removeTask(task.id)} className="text-slate-600 hover:text-red-500">Delete</button>
                     </Card>
                  ))}
               </div>
            </div>
          )}

          {state.activeView === 'settings' && (
             <div className="max-w-4xl mx-auto h-full overflow-y-auto custom-scrollbar">
                <h3 className="text-xl font-black text-white mb-8">System Configuration</h3>
                
                <section className="mb-12">
                   <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Email Nodes</h4>
                   <div className="space-y-4">
                      {state.accounts.map(acc => (
                         <Card key={acc.id} className="p-6 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                               <div className={`p-3 rounded-xl ${acc.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                  <Icons.Server className="w-6 h-6" />
                               </div>
                               <div>
                                  <p className="font-bold text-white">{acc.email}</p>
                                  <p className="text-xs text-slate-500 uppercase">{acc.host} • {acc.status}</p>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => handleSyncAccount(acc.id)} className="p-2 hover:bg-slate-800 rounded-lg text-emerald-500"><Icons.Refresh className="w-5 h-5" /></button>
                               <button onClick={() => removeAccount(acc.id)} className="p-2 hover:bg-slate-800 rounded-lg text-red-500"><Icons.Settings className="w-5 h-5" /></button>
                            </div>
                         </Card>
                      ))}
                      <button onClick={() => setShowAccountModal(true)} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold uppercase hover:border-emerald-500 hover:text-emerald-500 transition-all">Connect New Node</button>
                   </div>
                </section>

                <section>
                   <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Domains</h4>
                   <div className="space-y-4">
                      {connectedDomains.map(d => (
                         <Card key={d.id} className="p-6 flex justify-between items-center">
                            <div><p className="font-bold text-white">{d.name}</p><p className="text-xs text-slate-500 uppercase">{d.type}</p></div>
                            <button onClick={() => removeDomain(d.id)} className="text-red-500 text-xs font-bold uppercase">Unlink</button>
                         </Card>
                      ))}
                      <button onClick={() => setShowDomainModal(true)} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold uppercase hover:border-emerald-500 hover:text-emerald-500 transition-all">Sync Domain</button>
                   </div>
                </section>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
