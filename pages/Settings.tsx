
import React, { useState, useEffect, useRef } from 'react';
import { Save, Lock, CheckCircle, Database, ExternalLink, Check, Loader2, Calculator, Info, GripHorizontal, ArrowDownCircle, Bug, Globe, UserPlus, Trash2, Key, X, Users, Terminal, Copy, ShieldAlert } from 'lucide-react';
import { getSupabaseConfig } from '../services/supabaseClient';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { calculatePriceFromFormula, DEFAULT_FORMULA_B2B, DEFAULT_FORMULA_CONSUMER } from '../utils/pricing';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../services/translations';
import { MIGRATION_SCRIPT } from '../services/schema';

interface SettingsProps {
    currentUser?: User | null;
    onConnectSuccess?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onConnectSuccess }) => {
  const { t, language, setLanguage } = useLanguage();

  // Teamleader State
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectedUser, setConnectedUser] = useState<any>(null);
  const [isLoadingTl, setIsLoadingTl] = useState(false);
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // Supabase State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isGlobalDb, setIsGlobalDb] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // App Settings
  const [priceFormulaB2B, setPriceFormulaB2B] = useState(DEFAULT_FORMULA_B2B);
  const [priceFormulaConsumer, setPriceFormulaConsumer] = useState(DEFAULT_FORMULA_CONSUMER);
  const [testCost, setTestCost] = useState(100);
  const [testDiscount, setTestDiscount] = useState(25);
  
  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'viewer', password: '' });
  const [resetPasswordData, setResetPasswordData] = useState({ email: '', password: '' });

  // Emergency User State
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyEmail, setEmergencyEmail] = useState('emergency@admin.com');
  const [emergencyPassword, setEmergencyPassword] = useState('secret123');
  const [emergencyScript, setEmergencyScript] = useState('');
  const [copiedEmergency, setCopiedEmergency] = useState(false);
  
  // Refs for insertion
  const b2bRef = useRef<HTMLTextAreaElement>(null);
  const consumerRef = useRef<HTMLTextAreaElement>(null);

  // Prevention of double-fire in Strict Mode
  const processingCode = useRef(false);

  // User Mgmt State
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    init();
  }, [currentUser]);

  const addDebugLog = (msg: string) => {
      console.log(`[Settings] ${msg}`);
      setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Helper to normalize URI (STRICT: always strip trailing slash)
  const getNormalizedCurrentUri = () => {
      const url = window.location.origin + window.location.pathname;
      return url.endsWith('/') ? url.slice(0, -1) : url;
  };

  const init = async () => {
    const { url, key, isGlobal } = getSupabaseConfig();
    if (url) setSupabaseUrl(url);
    if (key) setSupabaseKey(key);
    setIsGlobalDb(isGlobal);

    // Default Redirect URI
    const detectedUri = getNormalizedCurrentUri();
    
    // Only set if empty to allow user override
    if (!redirectUri) {
        setRedirectUri(detectedUri);
    }

    if (url && key) {
        // Load Settings
        try {
            const tlSettings = await api.getIntegrationSettings('teamleader');
            if (tlSettings) {
                setClientId(tlSettings.client_id || '');
                setClientSecret(tlSettings.client_secret || '');
                if (tlSettings.redirect_uri) {
                    setRedirectUri(tlSettings.redirect_uri);
                }
                
                if (tlSettings.access_token) {
                    setIsAuthenticated(true);
                    checkUserConnection(tlSettings.access_token);
                }
            }
            
            const appSettings = await api.getAppSettings();
            setPriceFormulaB2B(appSettings.priceFormulaB2B || DEFAULT_FORMULA_B2B);
            setPriceFormulaConsumer(appSettings.priceFormulaConsumer || DEFAULT_FORMULA_CONSUMER);
        } catch (e) {
            console.error("Failed to load settings", e);
        }

        // Allow fetching users for all roles, though backend might still restrict modification
        fetchUsers();
    }

    // Handle OAuth Callback
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('code');
    const error = params.get('error');

    if (authCode && !processingCode.current) {
        handleOAuthCode(authCode);
    } else if (error) {
        addDebugLog(`OAuth Error Callback: ${error}`);
        alert(`Teamleader Auth Error: ${error}`);
    }
  };

  const handleOAuthCode = async (code: string) => {
    if (processingCode.current) return;
    processingCode.current = true;
    setIsLoadingTl(true);
    setShowDebug(true); // Auto-show debug on auth flow

    // Use the exact current URL (normalized) as we expect this to be what was sent
    const uriToUse = getNormalizedCurrentUri();
    
    addDebugLog(`Starting Exchange. Code: ${code.substring(0, 5)}...`);
    addDebugLog(`Using Redirect URI: ${uriToUse}`);
    addDebugLog(`(If this URI differs from what is in Teamleader, it will fail)`);

    try {
        // 1. Exchange
        const tokens = await api.exchangeAuthCode(code, uriToUse);
        addDebugLog("Exchange successful. Tokens received.");
        
        // 2. Save
        const currentSettings = await api.getIntegrationSettings('teamleader');
        await api.saveIntegrationSettings('teamleader', {
            ...currentSettings,
            redirect_uri: uriToUse,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_updated_at: new Date().toISOString()
        });
        addDebugLog("Settings saved to DB.");

        // 3. Verify
        await checkUserConnection(tokens.access_token);
        setIsAuthenticated(true);
        addDebugLog("User verified.");
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        if(onConnectSuccess) onConnectSuccess();
        else alert("Connected successfully!");

    } catch (e: any) {
        console.error(e);
        addDebugLog(`ERROR: ${e.message}`);
        if (e.message.includes('redirect_uri_mismatch')) {
            addDebugLog("HINT: The URI registered in Teamleader does not match the one sent.");
        }
        alert("Failed to connect. See Debug Log below.");
        // Clean URL to prevent loop
        window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
        setIsLoadingTl(false);
        processingCode.current = false;
    }
  };

  const checkUserConnection = async (token?: string) => {
      try {
          const user = await api.getTeamleaderUser(token);
          setConnectedUser(user);
          addDebugLog(`Connected as ${user.email}`);
      } catch (e: any) {
          setConnectedUser(null);
          addDebugLog(`User check failed: ${e.message}`);
      }
  };

  const fetchUsers = async () => {
      try {
          const userList = await api.fetchUsers();
          setUsers(userList);
      } catch (e) { console.error(e); }
  };

  const handleAddUser = async () => {
      if(!newUser.email || !newUser.password) return alert("Email and Password required");
      try {
          await api.addUser({ 
              id: '', 
              email: newUser.email, 
              name: newUser.name, 
              role: newUser.role as UserRole, 
              password: newUser.password 
          });
          setShowUserModal(false);
          setNewUser({ name: '', email: '', role: 'viewer', password: '' });
          fetchUsers();
          alert("User added!");
      } catch(e: any) {
          alert("Failed: " + e.message);
      }
  };

  const handleDeleteUser = async (id: string) => {
      if(!confirm(t('prod.delete.confirm') + "?")) return;
      try {
          await api.deleteUser(id);
          fetchUsers();
      } catch(e: any) { alert("Error: " + e.message); }
  };

  const handleResetPassword = async () => {
      if(!resetPasswordData.password) return;
      try {
          await api.resetUserPassword(resetPasswordData.email, resetPasswordData.password);
          setShowPasswordModal(false);
          setResetPasswordData({ email: '', password: '' });
          alert("Password updated!");
      } catch(e: any) {
          alert("Error: " + e.message);
      }
  };

  const handleSave = async () => {
    localStorage.setItem('sb_url', supabaseUrl);
    localStorage.setItem('sb_key', supabaseKey);

    const cleanUri = redirectUri.trim().replace(/\/$/, ''); // Normalize save

    try {
        const existing = await api.getIntegrationSettings('teamleader') || {};
        await api.saveIntegrationSettings('teamleader', {
            ...existing,
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            redirect_uri: cleanUri
        });
        setRedirectUri(cleanUri); // Update UI to match saved
        
        await api.saveAppSettings({ 
            priceFormulaB2B, 
            priceFormulaConsumer,
            language
        });
        
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 1500);

    } catch (e: any) {
        if (e.code === '42P01') setShowSqlModal(true);
        else alert("Failed to save: " + e.message);
    }
  };

  const handleConnectTL = async () => {
    if (!clientId || !clientSecret) {
        alert("Enter Client ID and Secret first.");
        return;
    }

    setIsLoadingTl(true);
    // Explicitly normalize the URI we are about to use
    const cleanUri = redirectUri.trim().replace(/\/$/, ''); 
    
    addDebugLog(`Initiating Auth.`);
    addDebugLog(`Client ID: ${clientId}`);
    addDebugLog(`Redirect URI: ${cleanUri}`);

    try {
        // Save first to ensure state is consistent
        await api.saveIntegrationSettings('teamleader', {
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            redirect_uri: cleanUri
        });
        
        // IMPORTANT: The redirect_uri here MUST match what we send in exchangeAuthCode later
        const authUrl = `https://focus.teamleader.eu/oauth2/authorize?client_id=${clientId.trim()}&response_type=code&redirect_uri=${encodeURIComponent(cleanUri)}`;
        
        addDebugLog(`Redirecting to: ${authUrl}`);
        window.location.href = authUrl;
    } catch (e: any) {
        alert("Error: " + e.message);
        setIsLoadingTl(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseCurrentUrl = () => {
      setRedirectUri(getNormalizedCurrentUri());
  };

  const handleCopySql = () => {
      navigator.clipboard.writeText(MIGRATION_SCRIPT);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
  };

  const generateEmergencyScript = () => {
      const script = `-- EMERGENCY ADMIN USER CREATION (V4 - Anti-NULL Fix)
-- Run this in Supabase SQL Editor if you are completely locked out.
-- It creates a new admin user guaranteed to work.

create extension if not exists pgcrypto;

DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
  user_email text := '${emergencyEmail}';
  user_password text := '${emergencyPassword}';
  target_instance_id uuid;
BEGIN
  -- 1. Fetch correct instance ID
  SELECT instance_id INTO target_instance_id FROM auth.users LIMIT 1;
  IF target_instance_id IS NULL THEN target_instance_id := '00000000-0000-0000-0000-000000000000'; END IF;

  -- 2. Create Auth User (With EMPTY string tokens to prevent scan errors)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current, phone_change_token
  )
  VALUES (
    new_uid, target_instance_id, 'authenticated', 'authenticated', user_email, crypt(user_password, gen_salt('bf')), now(), 
    '{"provider":"email","providers":["email"]}', '{"name":"Emergency Admin","role":"admin"}', now(), now(),
    '', '', '', '', ''
  );

  -- 3. Create Identity (The critical link)
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), new_uid, jsonb_build_object('sub', new_uid, 'email', user_email), 'email', new_uid::text, now(), now(), now());

  -- 4. Create Public Profile
  INSERT INTO public.users (id, email, name, role)
  VALUES (new_uid::text, user_email, 'Emergency Admin', 'admin');
END $$;`;
      setEmergencyScript(script);
      setShowEmergencyModal(true);
  };

  const handleCopyEmergency = () => {
      navigator.clipboard.writeText(emergencyScript);
      setCopiedEmergency(true);
      setTimeout(() => setCopiedEmergency(false), 2000);
  };

  // --- FORMULA HELPERS ---
  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const insertVariable = (ref: React.RefObject<HTMLTextAreaElement>, text: string, setter: React.Dispatch<React.SetStateAction<string>>, current: string) => {
      if (ref.current) {
          const start = ref.current.selectionStart;
          const end = ref.current.selectionEnd;
          const newValue = current.substring(0, start) + text + current.substring(end);
          setter(newValue);
          // Defer focus to ensure state update has processed
          setTimeout(() => {
              if (ref.current) {
                  ref.current.focus();
                  ref.current.setSelectionRange(start + text.length, start + text.length);
              }
          }, 0);
      } else {
          setter(current + text);
      }
  };

  const VariableChip = ({ label, value, desc, targetRef, setter, currentVal }: any) => (
      <div 
        draggable
        onDragStart={(e) => handleDragStart(e, value)}
        onClick={() => insertVariable(targetRef, value, setter, currentVal)}
        className="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 border border-slate-300 hover:border-blue-300 rounded text-xs text-slate-700 font-mono cursor-grab active:cursor-grabbing flex items-center gap-1 transition-colors select-none shadow-sm"
        title={desc}
      >
        <GripHorizontal className="w-3 h-3 text-slate-400" />
        {label}
      </div>
  );

  const calculatedB2B = calculatePriceFromFormula(testCost, testDiscount, priceFormulaB2B);
  const calculatedConsumer = calculatePriceFromFormula(testCost, testDiscount, priceFormulaConsumer);

  const variables = [
      { label: 'cost', value: 'cost', desc: 'Base Cost' },
      { label: 'margin', value: 'discount', desc: 'Margin % (e.g. 25)' },
      { label: 'markup', value: 'markup', desc: '1 + Margin% (e.g. 1.25)' },
      { label: 'disc. factor', value: 'discount_factor', desc: '1 - Margin% (e.g. 0.75)' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h2>
          <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowDebug(!showDebug)}
                className={`px-3 py-2 rounded-md font-medium flex items-center transition-all ${showDebug ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                title={t('settings.debug_log')}
            >
                <Bug className="w-4 h-4" />
            </button>
            <button 
                onClick={handleSave}
                className={`px-6 py-2 rounded-md font-bold shadow-sm flex items-center transition-all ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
                {isSaved ? <CheckCircle className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaved ? t('settings.saved') : t('settings.save')}
            </button>
        </div>
      </div>

      {showDebug && (
          <div className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-xs overflow-y-auto max-h-60 border border-slate-700">
              <div className="flex justify-between mb-2 pb-2 border-b border-slate-700">
                  <span className="font-bold text-yellow-400">DEBUG LOG</span>
                  <button onClick={() => setDebugLogs([])} className="text-slate-400 hover:text-white">Clear</button>
              </div>
              {debugLogs.length === 0 ? <span className="text-slate-500">No logs yet...</span> : debugLogs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
      )}

      {/* General Settings (Language) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-slate-500" /> {t('settings.general')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.language')}</label>
                    <select 
                        value={language} 
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="w-full rounded-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900"
                    >
                        <option value="en">English</option>
                        <option value="nl">Nederlands</option>
                    </select>
                </div>
            </div>
      </div>

      {/* Connection Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
             <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                <Database className="w-5 h-5 mr-2 text-slate-500" /> {t('settings.database')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project URL</label>
                    <input type="text" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} disabled={isGlobalDb} className="w-full rounded-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900 disabled:bg-slate-100" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anon Key</label>
                    <div className="relative">
                        <input type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} disabled={isGlobalDb} className="w-full rounded-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900 disabled:bg-slate-100" />
                        <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                    </div>
                </div>
                {isGlobalDb && <p className="text-xs text-slate-500 italic md:col-span-2">Using globally configured credentials.</p>}
            </div>
            
            {/* Maintenance Section */}
            <div className="mt-6 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center"><Terminal className="w-4 h-4 mr-2" /> Database Maintenance</h4>
                <div className="bg-slate-50 p-4 rounded-md flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                        Run this script to fix "Missing Tables", "Schema Errors", or to <strong>Enforce Unique SKUs</strong>.
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={generateEmergencyScript}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-2 rounded-md text-sm font-medium flex items-center transition-all whitespace-nowrap"
                            title="Generate a SQL script to create a guaranteed admin user"
                        >
                            <ShieldAlert className="w-4 h-4 mr-2" />
                            Locked Out?
                        </button>
                        <button 
                            onClick={handleCopySql}
                            className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all"
                        >
                            {copiedSql ? <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copiedSql ? "Copied!" : "Copy Repair Script"}
                        </button>
                    </div>
                </div>
            </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-slate-500" /> {t('settings.users_title')}
              </h3>
              {currentUser?.role === 'admin' && (
                  <button 
                      onClick={() => setShowUserModal(true)}
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium flex items-center"
                  >
                      <UserPlus className="w-4 h-4 mr-1" /> {t('settings.users_add')}
                  </button>
              )}
          </div>
          
          {currentUser?.role !== 'admin' && (
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-2 rounded border border-slate-100 italic">
                  Only administrators can modify users.
              </p>
          )}
          
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                      <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">{t('common.name')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">{t('settings.users_role')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">{t('common.actions')}</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                      {users.map(u => (
                          <tr key={u.id}>
                              <td className="px-4 py-2">
                                  <div className="text-sm font-medium text-slate-900">{u.name}</div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                              </td>
                              <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                      {u.role}
                                  </span>
                              </td>
                              <td className="px-4 py-2 text-right space-x-2">
                                  {currentUser?.role === 'admin' && (
                                      <>
                                          <button 
                                              onClick={() => { setResetPasswordData({ email: u.email, password: '' }); setShowPasswordModal(true); }}
                                              className="text-slate-400 hover:text-slate-600"
                                              title={t('settings.users_reset_pwd')}
                                          >
                                              <Key className="w-4 h-4" />
                                          </button>
                                          {u.id !== currentUser.id && (
                                              <button 
                                                  onClick={() => handleDeleteUser(u.id)}
                                                  className="text-red-400 hover:text-red-600"
                                                  title={t('common.delete')}
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          )}
                                      </>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-slate-500" /> {t('settings.pricing')}
        </h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6 text-xs text-blue-800 flex items-start">
            <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <div>{t('settings.formula_help')}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-slate-700">{t('settings.b2b_formula')}</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                    {variables.map(v => (
                        <VariableChip 
                            key={v.value} 
                            {...v} 
                            targetRef={b2bRef} 
                            setter={setPriceFormulaB2B} 
                            currentVal={priceFormulaB2B} 
                        />
                    ))}
                </div>
                <textarea 
                    ref={b2bRef}
                    value={priceFormulaB2B} 
                    onChange={(e) => setPriceFormulaB2B(e.target.value)} 
                    className="w-full rounded-md border border-slate-300 shadow-sm p-2 font-mono h-24 bg-white text-slate-900 leading-relaxed" 
                />
            </div>
            <div>
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-slate-700">{t('settings.consumer_formula')}</label>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                    {variables.map(v => (
                        <VariableChip 
                            key={v.value} 
                            {...v} 
                            targetRef={consumerRef} 
                            setter={setPriceFormulaConsumer} 
                            currentVal={priceFormulaConsumer} 
                        />
                    ))}
                </div>
                <textarea 
                    ref={consumerRef}
                    value={priceFormulaConsumer} 
                    onChange={(e) => setPriceFormulaConsumer(e.target.value)} 
                    className="w-full rounded-md border border-slate-300 shadow-sm p-2 font-mono h-24 bg-white text-slate-900 leading-relaxed" 
                />
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 p-3 rounded-lg flex flex-wrap gap-4 items-center">
            <div className="text-sm font-bold text-slate-700">{t('settings.test_calc')}:</div>
            <input type="number" value={testCost} onChange={(e) => setTestCost(Number(e.target.value))} className="w-20 p-1 border border-slate-300 shadow-sm rounded text-sm bg-white" placeholder="Cost" />
            <input type="number" value={testDiscount} onChange={(e) => setTestDiscount(Number(e.target.value))} className="w-20 p-1 border border-slate-300 shadow-sm rounded text-sm bg-white" placeholder="Margin" />
            <div className="text-sm text-slate-500">B2B: <span className="font-bold text-blue-700">€{calculatedB2B.toFixed(2)}</span></div>
            <div className="text-sm text-slate-500">Cons: <span className="font-bold text-purple-700">€{calculatedConsumer.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Teamleader Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <ExternalLink className="w-5 h-5 mr-2 text-slate-500" /> {t('settings.teamleader_integ')}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                {isAuthenticated ? t('settings.connected') : t('settings.not_connected')}
            </span>
        </div>
        
        {isAuthenticated && connectedUser && (
             <div className="mb-6 border border-blue-200 bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-bold text-blue-900">Connected: {connectedUser.first_name} {connectedUser.last_name}</p>
                    <p className="text-xs text-blue-700">{connectedUser.email}</p>
                 </div>
                 <button onClick={() => { setIsAuthenticated(false); setConnectedUser(null); }} className="text-xs text-red-600 hover:underline">Disconnect</button>
             </div>
        )}

        <div className="grid grid-cols-1 gap-4 mb-6">
            <input type="text" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900" />
            <div className="relative">
                <input type="password" placeholder="Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full rounded-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900" />
                <Lock className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>
            
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Redirect URI (Must match Teamleader App Settings)</label>
                <div className="flex">
                    <input type="text" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} className="flex-1 rounded-l-md border border-slate-300 shadow-sm p-2 bg-white text-slate-900" />
                    <button onClick={handleCopy} className="bg-slate-100 border border-slate-300 shadow-sm border-l-0 px-3 hover:bg-slate-200" title="Copy"><Check className={`w-4 h-4 ${copied ? "text-green-600" : "text-slate-500"}`} /></button>
                    <button onClick={handleUseCurrentUrl} className="bg-slate-100 border border-slate-300 shadow-sm border-l-0 rounded-r-md px-3 hover:bg-slate-200" title="Use Current Browser URL"><ArrowDownCircle className="w-4 h-4 text-blue-600" /></button>
                </div>
            </div>
            
            <p className="text-xs text-slate-500">
                Enter your Teamleader App credentials above and click "Connect Teamleader".
            </p>
        </div>

        <div className="flex gap-4">
             <button 
                onClick={handleConnectTL}
                disabled={!clientId || !clientSecret || isLoadingTl}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-md font-medium flex justify-center items-center disabled:opacity-50"
             >
                {isLoadingTl ? <Loader2 className="w-5 h-5 animate-spin" /> : t('settings.connect_btn')}
             </button>
             
             {!isAuthenticated && (
                 <button 
                    onClick={() => {
                         if(confirm("Clear local settings?")) {
                             setClientId(''); setClientSecret(''); setRedirectUri('');
                         }
                    }}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-md font-medium flex items-center shadow-sm"
                 >
                    {t('settings.reset')}
                 </button>
             )}
        </div>
      </div>

      {/* Add User Modal */}
      {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">{t('settings.users_add')}</h3>
                      <button onClick={() => setShowUserModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <input 
                        type="text" placeholder={t('common.name')} 
                        value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} 
                        className="w-full border rounded p-2" 
                      />
                      <input 
                        type="email" placeholder="Email" 
                        value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} 
                        className="w-full border rounded p-2" 
                      />
                      <select 
                        value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
                        className="w-full border rounded p-2"
                      >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                      </select>
                      <input 
                        type="password" placeholder={t('settings.users_password')}
                        value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} 
                        className="w-full border rounded p-2" 
                      />
                      <button onClick={handleAddUser} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{t('settings.users_add')}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">{t('settings.users_reset_pwd')}</h3>
                      <button onClick={() => setShowPasswordModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <p className="text-sm text-slate-500">For: <strong>{resetPasswordData.email}</strong></p>
                      <input 
                        type="text" placeholder={t('settings.users_new_pwd')}
                        value={resetPasswordData.password} onChange={e => setResetPasswordData({...resetPasswordData, password: e.target.value})} 
                        className="w-full border rounded p-2" 
                      />
                      <button onClick={handleResetPassword} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{t('settings.save')}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Emergency Admin Modal */}
      {showEmergencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-red-50 rounded-t-xl">
                      <h3 className="font-bold text-red-900 flex items-center"><ShieldAlert className="w-5 h-5 mr-2" /> Emergency Admin Generator</h3>
                      <button onClick={() => setShowEmergencyModal(false)}><X className="w-5 h-5 text-red-400 hover:text-red-600" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <p className="text-sm text-slate-600">
                          If you are completely locked out of the app (e.g. database error), use this tool to generate a SQL script. 
                          Running this script in Supabase will create a <strong>new admin user</strong> guaranteed to work.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">New Email</label>
                              <input 
                                type="email" 
                                value={emergencyEmail}
                                onChange={(e) => setEmergencyEmail(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">New Password</label>
                              <input 
                                type="text" 
                                value={emergencyPassword}
                                onChange={(e) => setEmergencyPassword(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                              />
                          </div>
                      </div>

                      <button 
                        onClick={generateEmergencyScript}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded font-medium text-sm border border-slate-300"
                      >
                          Generate Script
                      </button>

                      {emergencyScript && (
                          <div className="mt-4">
                              <div className="relative">
                                <textarea 
                                    readOnly
                                    value={emergencyScript}
                                    className="w-full h-40 font-mono text-xs p-3 bg-slate-900 text-green-400 rounded-md"
                                />
                                <button 
                                    onClick={handleCopyEmergency}
                                    className="absolute top-2 right-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-1.5 rounded"
                                    title="Copy to Clipboard"
                                >
                                    {copiedEmergency ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                              <p className="text-xs text-slate-500 mt-2">
                                  Copy this and run it in the <strong>Supabase SQL Editor</strong>. Then login with these credentials.
                              </p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
