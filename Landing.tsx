
import React, { useState } from 'react';
import { NexusLogoSVG } from './App';
import { supabase } from './lib/supabase';

export default function Landing({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("System database not connected. Please configure keys in dashboard.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0], // Default name
            }
          }
        });
        if (error) throw error;
      }
      onLogin(); // App.tsx will pick up the session change via onAuthStateChange, but we call this to be safe
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sky-500/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[120px]"></div>

      {/* Nav */}
      <nav className="relative z-10 px-8 py-6 flex justify-between items-center border-b border-white/5 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8"><NexusLogoSVG /></div>
          <span className="font-bold tracking-tight text-xl">NexusMail AI</span>
        </div>
        <button onClick={() => setIsLogin(true)} className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all text-sm font-bold">
          Client Portal
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center relative z-10 px-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          
          {/* Hero Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest animate-fade-in-up">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              v2.6 Enterprise Live
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400">Neural Logic</span><br/>
              for Business Comms.
            </h1>
            <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
              NexusMail connects your custom domains to a Gemini 3 neural engine. We don't just host email; we extract tasks, automate support tickets, and execute business logic in real-time.
            </p>
          </div>

          {/* Login Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-fuchsia-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-[#0f172a] border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-2xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">{isLogin ? 'Welcome back' : 'Initialize Node'}</h2>
                <p className="text-slate-400 text-sm">{isLogin ? 'Authenticate to access your neural dashboard.' : 'Deploy a new business logic instance.'}</p>
              </div>
              
              {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Work Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors font-medium" 
                    placeholder="name@company.com" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors font-medium" 
                    placeholder="••••••••••••" 
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all transform active:scale-[0.98] relative overflow-hidden"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>{isLogin ? 'Authenticating...' : 'Registering...'}</span>
                    </div>
                  ) : (
                    <span>{isLogin ? 'Access Dashboard' : 'Create Account'}</span>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isLogin ? "Don't have an account? Deploy Node" : "Already verified? Sign In"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
