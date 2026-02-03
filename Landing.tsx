
import React, { useState } from 'react';
import { P3LogoSVG } from './App';
import { supabase } from './lib/supabase';

export default function Landing({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Database not connected.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: email.split('@')[0] }
          }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage("Check your email to verify account.");
          setIsLogin(true);
          setIsLoading(false);
          return;
        }
        onLogin(); 
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]"></div>

      <div className="relative z-10 w-full max-w-md p-8">
         <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 mb-6"><P3LogoSVG /></div>
            <h1 className="text-3xl font-black text-white text-center">P3 Lending</h1>
            <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest mt-2">Internal Staff Portal</p>
         </div>

         <div className="bg-[#111] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            {message && <div className="mb-6 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold text-center">{message}</div>}
            {error && <div className="mb-6 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold text-center">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Staff Email</label>
                  <input 
                     type="email" required 
                     value={email} onChange={e => setEmail(e.target.value)}
                     className="w-full p-4 rounded-xl bg-[#0a0a0a] border border-slate-800 text-white focus:border-emerald-500 outline-none transition-colors"
                     placeholder="name@p3lending.space"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">Secure Key</label>
                  <input 
                     type="password" required 
                     value={password} onChange={e => setPassword(e.target.value)}
                     className="w-full p-4 rounded-xl bg-[#0a0a0a] border border-slate-800 text-white focus:border-emerald-500 outline-none transition-colors"
                     placeholder="••••••••••••"
                  />
               </div>
               <button type="submit" disabled={isLoading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all">
                  {isLoading ? 'Verifying...' : (isLogin ? 'Access System' : 'Register Node')}
               </button>
            </form>

            <div className="mt-6 text-center">
               <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-xs text-slate-500 hover:text-emerald-400 font-bold uppercase tracking-wide">
                  {isLogin ? "New Staff? Register" : "Have Access? Login"}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
