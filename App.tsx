
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

// Extended type for UI state
interface DNSInstructionWithStatus extends DNSInstruction {
  status?: 'created' | 'exists' | 'failed' | 'verified';
  error?: string;
}

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
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Config Forms
  const [sbConfig, setSbConfig] = useState({ url: '', key: '' });
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', content: '' });
  const [ticketForm, setTicketForm] = useState<{ title: string; description: string; priority: Priority }>({ title: '', description: '', priority: 'low' });
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '' });
  const [automationForm, setAutomationForm] = useState({ name: '', condition: '', action: '' });

  // Domain Modal
  const [domainModalStep, setDomainModalStep] = useState<'input' | 'scanning' | 'instructions'>('input');
  const [domainVerificationMethod, setDomainVerificationMethod] = useState<'manual' | 'cloudflare'>('manual');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<string>('Initializing...');
  const [dnsInstructions, setDnsInstructions] = useState<DNSInstructionWithStatus[]>([]);
  const [connectedDomains, setConnectedDomains] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
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
  const [accountStatus, setAccountStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [accountError, setAccountError] = useState<string | null>(null);

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
          handleSyncAccount(acc.id, true);
        }
      });
    }, 120000); 

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

  // --- AI AUTOMATION ENGINE ---
  const runAIAutomation = async (accountId: string) => {
    if (!supabase || !currentUser) return;
    
    setState(prev => ({ ...prev, isAnalyzing: true }));

    try {
        // 1. Find un-analyzed emails for this account
        const { data: emails } = await supabase
            .from('emails')
            .select('*')
            .eq('account_id', accountId)
            .is('ai_summary', null)
            .limit(3); // Process in small batches

        if (!emails || emails.length === 0) {
            setState(prev => ({ ...prev, isAnalyzing: false }));
            return;
        }

        const updates = [];

        for (const email of emails) {
            // 2. AI Analysis
            const insights = await analyzeEmail(email.body_text || "(No Content)", email.subject || "(No Subject)");

            // 3. Create Tasks
            if (insights.suggestedTasks && insights.suggestedTasks.length > 0) {
                 const tasks = insights.suggestedTasks.map(t => ({
                    user_id: currentUser.id,
                    title: t,
                    status: 'pending',
                    source_email_id: email.id
                 }));
                 await supabase.from('tasks').insert(tasks);
            }

            // 4. Create Ticket (Auto-create if priority is High/Urgent or explicit suggestion)
            if (insights.suggestedTicket) {
                await supabase.from('tickets').insert({
                    user_id: currentUser.id,
                    title: insights.suggestedTicket.title,
                    description: insights.summary,
                    priority: insights.suggestedTicket.priority,
                    status: 'open',
                    source_email_id: email.id
                });
            }

            // 5. Update Email with Insights
            updates.push(
                supabase.from('emails').update({
                    ai_summary: JSON.stringify(insights),
                    ai_sentiment: insights.sentiment
                }).eq('id', email.id)
            );
        }
        
        await Promise.all(updates);
        
        // Refresh Dashboard
        await fetchData(currentUser.id);

    } catch (err) {
        console.error("AI Automation Error:", err);
    } finally {
        setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const handleSyncAccount = async (accountId: string, background = false) => {
    if (!background) {
      setIsSyncing(true);
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === accountId ? { ...a, status: 'syncing' } : a)
      }));
    }

    if (!supabase) return;

    try {
      const { data, error } = await supabase.functions.invoke('email-handler', {
        body: { action: 'sync', accountId }
      });

      if (error) throw error;
      
      const newEmailCount = data?.count || 0;

      if (newEmailCount > 0 && Notification.permission === 'granted' && background) {
         new Notification('New P3 Signal', {
            body: `${newEmailCount} new message(s) received.`,
            icon: '/vite.svg'
         });
      }
      
      // Trigger AI Automation immediately after sync
      await runAIAutomation(accountId);
      
      // Fetch final state (Automation function also fetches, but this ensures coverage)
      await fetchData(currentUser.id);

    } catch (error) {
       console.error("Sync failed:", error);
       setState(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === accountId ? { ...a, status: 'error' } : a)
      }));
      if(!background) alert("Sync failed. Check connection settings.");
    } finally {
      if(!background) setIsSyncing(false);
    }
  };

  const handleTestAndConnectAccount = async () => {
    setAccountStatus('testing');
    setAccountError(null);
    
    if (!supabase || !currentUser) return;
    
    try {
      // 1. Test Connection via Edge Function
      const { data: testData, error: testError } = await supabase.functions.invoke('email-handler', {
        body: { 
          action: 'test', 
          config: accountForm 
        }
      });

      if (testError || !testData.success) {
        throw new Error(testData?.error || testError?.message || "Connection refused by server");
      }

      // 2. Save if successful
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
      
      setAccountStatus('success');
      
      // Refresh local state
      await fetchData(currentUser.id);

      setTimeout(() => {
        setShowAccountModal(false);
        setAccountStatus('idle');
        setAccountForm({ email: '', password: '', host: '', port: 993 });
      }, 1500);

    } catch (err: any) {
      setAccountStatus('failed');
      setAccountError(err.message);
    }
  };

  const fillPreset = (provider: 'gmail' | 'outlook' | 'zoho') => {
    if (provider === 'gmail') setAccountForm(p => ({ ...p, host: 'imap.gmail.com', port: 993 }));
    if (provider === 'outlook') setAccountForm(p => ({ ...p, host: 'outlook.office365.com', port: 993 }));
    if (provider === 'zoho') setAccountForm(p => ({ ...p, host: 'imap.zoho.com', port: 993 }));
  };

  // ... (Other handlers: selectEmail, handleAnalyzeEmail, etc. remain largely the same, just keeping the structure valid)
  const selectEmail = async (id: string) => {
    setState(p => ({ 
      ...p, 
      selectedEmailId: id, 
      emails: p.emails.map(e => e.id === id ? { ...e, isRead: true } : e) 
    }));
    setInboxViewMode('detail');
    if(supabase) await supabase.from('emails').update({ is_read: true }).eq('id', id);
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
    if (!state.emails.find(e => e.id === state.selectedEmailId)) return;
    setIsDrafting(true);
    setShowDraftModal(true);
    try {
      const email = state.emails.find(e => e.id === state.selectedEmailId)!;
      const draft = await draftReply(email.content, "Polite, professional response.");
      setDraftContent(draft);
    } catch (err) {
      setDraftContent("Error generating draft.");
    } finally {
      setIsDrafting(false);
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

  const unreadCount = useMemo(() => state.emails.filter(e => !e.isRead).length, [state.emails]);
  const selectedEmail = useMemo(() => state.emails.find(e => e.id === state.selectedEmailId), [state.emails, state.selectedEmailId]);

  // UI Render
  if (!isAuthenticated && !showSupabaseConfigModal) {
    return <Landing onLogin={() => {}} />;
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

      {/* Account Modal with Presets */}
      <Modal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Link Email Node">
        {accountStatus === 'idle' || accountStatus === 'failed' ? (
          <div className="space-y-4">
             {accountError && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs font-bold">{accountError}</div>}
             
             <div className="flex gap-2 mb-4">
               <button onClick={() => fillPreset('gmail')} className="flex-1 py-2 bg-slate-800 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-700">Gmail</button>
               <button onClick={() => fillPreset('outlook')} className="flex-1 py-2 bg-slate-800 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-700">Outlook</button>
               <button onClick={() => fillPreset('zoho')} className="flex-1 py-2 bg-slate-800 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-700">Zoho</button>
             </div>

             <input type="email" placeholder="email@customdomain.com" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.email} onChange={e => setAccountForm({...accountForm, email: e.target.value})} />
             <div className="relative">
                <input type="password" placeholder="App Password" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.password} onChange={e => setAccountForm({...accountForm, password: e.target.value})} />
                <div className="absolute right-4 top-4 text-[10px] text-slate-500">For Gmail/Outlook use App Password</div>
             </div>
             
             <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                   <input type="text" placeholder="imap.host.com" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.host} onChange={e => setAccountForm({...accountForm, host: e.target.value})} />
                </div>
                <div>
                   <input type="number" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={accountForm.port} onChange={e => setAccountForm({...accountForm, port: parseInt(e.target.value)})} />
                </div>
             </div>
             <button onClick={handleTestAndConnectAccount} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest mt-4">Test & Save Connection</button>
          </div>
        ) : accountStatus === 'testing' ? (
           <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-bold animate-pulse text-emerald-400">Verifying Credentials...</p>
           </div>
        ) : (
           <div className="py-10 text-center space-y-4 text-emerald-500">
              <Icons.CheckCircle className="w-16 h-16 mx-auto" />
              <p className="font-bold text-xl">Connection Verified</p>
           </div>
        )}
      </Modal>

      {/* Main View */}
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
            { id: 'tickets', label: 'Tickets', icon: Icons.Ticket },
            { id: 'tasks', label: 'Tasks', icon: Icons.Task },
            { id: 'settings', label: 'Settings', icon: Icons.Settings },
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => { setState(p => ({ ...p, activeView: item.id as any })); if(item.id === 'inbox') setInboxViewMode('list'); }} 
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
                <button onClick={() => { if(supabase) supabase.auth.signOut(); setIsAuthenticated(false); }} className="text-[10px] text-red-500 font-bold uppercase hover:underline">Logout</button>
             </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
         {/* GRID BACKGROUND */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <header className="h-24 px-10 flex items-center justify-between relative z-10 border-b border-slate-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black text-white capitalize">{state.activeView}</h2>
             {state.isAnalyzing && (
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">AI Processing...</span>
               </div>
             )}
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setShowComposeModal(true)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest">New Transmission</button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative z-10 p-8">
          
          {state.activeView === 'inbox' && (
             <div className="grid grid-cols-12 gap-8 h-full">
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
                      </Card>
                   ))}
                </div>

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
                               <button onClick={() => handleAnalyzeEmail(selectedEmail.id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500">{state.isAnalyzing ? 'Processing...' : 'Re-Analyze'}</button>
                            </div>
                         </div>
                         <div className="p-6 bg-black rounded-2xl border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono overflow-y-auto max-h-[400px]" dangerouslySetInnerHTML={{ __html: selectedEmail.content.replace(/\n/g, '<br/>') }} />
                      </div>
                      
                      {selectedEmail.aiInsights && (
                         <div className="flex-1 overflow-y-auto p-8 bg-[#111]">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-slate-800">
                                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Sentiment Analysis</h4>
                                  <div className="text-sm font-medium text-white mb-2 capitalize">{selectedEmail.aiInsights.sentiment}</div>
                                  <p className="text-xs text-slate-500">{selectedEmail.aiInsights.summary}</p>
                               </div>
                               {selectedEmail.aiInsights.suggestedTasks?.length > 0 && (
                                   <div className="p-6 rounded-2xl bg-[#0a0a0a] border border-slate-800">
                                      <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Extracted Tasks</h4>
                                      <ul className="space-y-2">
                                        {selectedEmail.aiInsights.suggestedTasks.map((t, i) => (
                                          <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            {t}
                                          </li>
                                        ))}
                                      </ul>
                                   </div>
                               )}
                            </div>
                         </div>
                      )}
                   </Card>
                )}
             </div>
          )}

          {state.activeView === 'tickets' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full overflow-y-auto custom-scrollbar pb-12">
               {state.tickets.map(ticket => (
                 <Card key={ticket.id} className="p-6 border-l-4 border-l-emerald-500">
                   <div className="flex justify-between items-start mb-4">
                     <span className="text-[10px] font-mono text-slate-500 uppercase">#{ticket.id.slice(0, 8)}</span>
                     <PriorityBadge priority={ticket.priority} />
                   </div>
                   <h3 className="font-bold text-white mb-2">{ticket.title}</h3>
                   <p className="text-xs text-slate-500 mb-6">{ticket.description}</p>
                   <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{ticket.status}</span>
                      <button className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400">View Details</button>
                   </div>
                 </Card>
               ))}
               {state.tickets.length === 0 && (
                 <div className="col-span-3 text-center py-20 text-slate-500 text-sm">No active tickets found.</div>
               )}
             </div>
          )}

          {state.activeView === 'tasks' && (
             <div className="max-w-3xl mx-auto h-full overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  {state.tasks.map(task => (
                    <Card key={task.id} className="p-4 flex items-center gap-4 group hover:border-emerald-500/30 transition-colors">
                      <button className="w-6 h-6 rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-emerald-500 transition-colors">
                         {task.status === 'completed' && <div className="w-3 h-3 rounded-full bg-emerald-500"></div>}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</p>
                      </div>
                      {task.dueDate && (
                        <span className="text-xs font-mono text-slate-500">{new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                    </Card>
                  ))}
                  {state.tasks.length === 0 && (
                     <div className="text-center py-20 text-slate-500 text-sm">All tasks completed.</div>
                   )}
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
                               <button onClick={() => handleSyncAccount(acc.id)} disabled={isSyncing} className={`p-2 hover:bg-slate-800 rounded-lg ${isSyncing ? 'text-slate-500 animate-spin' : 'text-emerald-500'}`}>
                                  <Icons.Refresh className="w-5 h-5" />
                               </button>
                            </div>
                         </Card>
                      ))}
                      <button onClick={() => setShowAccountModal(true)} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 font-bold uppercase hover:border-emerald-500 hover:text-emerald-500 transition-all">Connect New Node</button>
                   </div>
                </section>
             </div>
          )}

        </div>
      </main>
      
      {/* Draft Modal */}
      <Modal isOpen={showDraftModal} onClose={() => setShowDraftModal(false)} title="Neural Draft">
        {isDrafting ? <div className="p-10 text-center font-bold animate-pulse text-emerald-400">Synthesizing...</div> : (
          <div className="space-y-6">
            <textarea className="w-full p-6 rounded-2xl bg-[#1a1a1a] border border-slate-800 text-white h-48" value={draftContent} onChange={e => setDraftContent(e.target.value)} />
            <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest" onClick={() => setShowDraftModal(false)}>Copy to Clipboard</button>
          </div>
        )}
      </Modal>

      {/* Compose Modal */}
      <Modal isOpen={showComposeModal} onClose={() => setShowComposeModal(false)} title="New Transmission">
        <div className="space-y-6">
          <input type="text" placeholder="Recipient" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} />
          <input type="text" placeholder="Subject" className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} />
          <textarea placeholder="Message content..." rows={6} className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-slate-800 text-white" value={composeForm.content} onChange={e => setComposeForm({...composeForm, content: e.target.value})} />
          <button className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest" disabled={isSending} onClick={() => { setIsSending(true); setTimeout(() => { setIsSending(false); setShowComposeModal(false); }, 1000); }}>
             {isSending ? 'Sending...' : 'Send Transmission'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
