
import React from 'react';
import { LayoutDashboard, Package, Upload, RefreshCw, Settings, Menu, LogOut, ClipboardList, User as UserIcon, TestTube } from 'lucide-react';
import { User, UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string, filter?: string) => void;
  currentUser: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate, currentUser, onLogout }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'products', label: t('nav.products'), icon: Package },
    { id: 'import', label: t('nav.import'), icon: Upload },
    { id: 'sync', label: t('nav.sync'), icon: RefreshCw },
    { id: 'tester', label: t('nav.tester'), icon: TestTube },
    { id: 'logs', label: t('nav.logs'), icon: ClipboardList },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const getRoleBadgeColor = (role: UserRole) => {
      switch(role) {
          case 'admin': return 'bg-purple-500';
          case 'editor': return 'bg-blue-500';
          default: return 'bg-slate-500';
      }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight">PricingSync</h1>
          <p className="text-xs text-slate-400 mt-1">{t('nav.subtitle')}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
             <div className="flex items-center min-w-0">
                <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${getRoleBadgeColor(currentUser?.role || 'viewer')}`}>
                    {currentUser?.name.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="ml-3 truncate">
                    <p className="text-sm font-medium text-white truncate">{currentUser?.name || 'User'}</p>
                    <p className="text-xs text-slate-400 capitalize">{currentUser?.role || 'Viewer'}</p>
                </div>
             </div>
             <button onClick={onLogout} title={t('nav.logout')} className="text-slate-400 hover:text-white ml-2">
                 <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b border-slate-200 md:hidden flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
              <button className="text-slate-500 hover:text-slate-700">
                <Menu className="h-6 w-6" />
              </button>
              <span className="ml-4 font-bold text-lg">PricingSync</span>
          </div>
          <button onClick={onLogout}>
              <LogOut className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
