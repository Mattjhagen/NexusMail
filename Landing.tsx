
import React, { useState } from 'react';
import { NexusLogoSVG } from './App';

export default function Landing({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate Auth Latency
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1500);
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
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Platform</a>
          <a href="#" className="hover:text-white transition-colors">Solutions</a>
          <a href="#" className="hover:text-white transition-colors">Enterprise</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
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
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
               <div className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10">
                 <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 <span className="font-bold text-sm">Gemini 3 Native</span>
               </div>
               <div className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10">
                 <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span className="font-bold text-sm">Enterprise Security</span>
               </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-fuchsia-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-[#0f172a] border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-2xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">{isLogin ? 'Welcome back' : 'Initialize Node'}</h2>
                <p className="text-slate-400 text-sm">{isLogin ? 'Authenticate to access your neural dashboard.' : 'Deploy a new business logic instance.'}</p>
              </div>

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
                       <span>Authenticating...</span>
                    </div>
                  ) : (
                    <span>{isLogin ? 'Access Dashboard' : 'Create Account'}</span>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-slate-400 hover:text-white transition-colors">
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
