
import React, { useState, useEffect } from 'react';
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  isDbConfigured: boolean;
  onOpenSettings: () => void;
  initialError?: string | null;
}

export default function Login({ onLogin, isDbConfigured, onOpenSettings, initialError }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);

  useEffect(() => {
      if (initialError) setError(initialError);
  }, [initialError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDbConfigured) {
        setError("Please configure the database in the Settings first.");
        return;
    }
    
    setLoading(true);
    setError(null);

    try {
        const user = await api.login(email, password);
        if (user) {
            onLogin(user);
        } else {
            setError("Invalid email or password.");
        }
    } catch (err: any) {
        console.error(err);
        let msg = err.message || "Connection failed.";
        
        // Detect specific Supabase schema error
        if (msg.includes("Database error querying schema")) {
            msg = "DB Schema Error: Missing Identities. Go to Settings > Copy Repair Script & run in Supabase SQL Editor.";
        }
        // Detect the specific NULL scan error
        else if (msg.includes("Scan error") || msg.includes("converting NULL to string")) {
             msg = "DB Error: Users have NULL tokens. Go to Settings > Copy Repair Script & run in Supabase SQL Editor.";
        }
        
        setError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative">
      <button 
        onClick={onOpenSettings}
        className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-md text-slate-500 hover:text-blue-600 transition-colors"
        title="Open Settings"
      >
        <SettingsIcon className="w-5 h-5" />
      </button>

      <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">PricingSync</h1>
            <p className="text-slate-400 mt-2">Teamleader Product Management</p>
        </div>
        
        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="font-medium break-words">{error}</span>
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 shadow-sm rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900"
                            placeholder="admin@company.com"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 shadow-sm rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                </button>
            </form>

            {!isDbConfigured && (
                 <div className="mt-6 text-center bg-amber-50 p-3 rounded-lg border border-amber-100">
                     <p className="text-xs text-amber-800 font-medium mb-2">Database not configured.</p>
                     <button 
                        type="button"
                        onClick={onOpenSettings}
                        className="text-xs text-amber-700 underline hover:text-amber-900 font-bold"
                     >
                         Click here to configure via Settings
                     </button>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
}
