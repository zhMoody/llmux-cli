import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Box, 
  Activity, 
  Settings, 
  Info,
  Menu,
  ChevronRight,
  Languages,
  Zap
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import Accounts from './routes/accounts';
import Models from './routes/models';
import Dashboard from './routes/dashboard';
import Usage from './routes/usage';
import SettingsPage from './routes/settings';
import About from './routes/about';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'zh', label: 'ZH' }
  ];
  const currentLang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <div className="flex bg-secondary/50 rounded-full p-1 border border-border/50">
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black transition-all",
            currentLang === lang.code ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};

const NavItem = ({ to, icon: Icon, labelKey }: { to: string; icon: any; labelKey: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  const { t } = useTranslation();

  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative",
        isActive 
          ? "bg-primary/10 text-primary" 
          : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground hover:translate-x-1"
      )}
    >
      {isActive && (
        <div className="absolute left-0 w-1 h-6 bg-primary rounded-full -translate-x-1" />
      )}
      <Icon size={20} className={cn("transition-transform duration-300", isActive && "scale-110")} />
      <span className="font-bold text-sm tracking-tight">{t(labelKey)}</span>
      {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </Link>
  );
};

function App() {
  const { t } = useTranslation();

  return (
    <Router>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border/40 bg-card/30 backdrop-blur-3xl flex flex-col z-50">
          <div className="p-8 pb-10 flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-2xl shadow-2xl shadow-primary/20 rotate-3">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
               <h1 className="text-2xl font-black tracking-tighter leading-none">LLMux</h1>
               <span className="text-[10px] font-black uppercase text-primary/50 tracking-widest leading-none mt-1 inline-block">Gateways</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <div className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest px-4 mb-4">{t('common.menuCore')}</div>
            <NavItem to="/" icon={LayoutDashboard} labelKey="common.dashboard" />
            <NavItem to="/accounts" icon={Users} labelKey="common.accounts" />
            <NavItem to="/models" icon={Box} labelKey="common.models" />
            <NavItem to="/usage" icon={Activity} labelKey="common.usage" />
            
            <div className="pt-8 text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest px-4 mb-4">{t('common.menuPref')}</div>
            <NavItem to="/settings" icon={Settings} labelKey="common.settings" />
            <NavItem to="/about" icon={Info} labelKey="common.about" />
          </nav>

          <div className="p-6">
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-[2rem] relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full -mt-8 -mr-8 blur-2xl group-hover:scale-150 transition-transform duration-700" />
               <div className="text-[10px] font-black text-primary uppercase mb-1">{t('common.status')}</div>
               <div className="text-xs font-bold truncate">{t('common.systemNormal')}</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <header className="h-20 border-b border-border/40 flex items-center px-10 glass z-40 sticky top-0">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">
                   Multi-Account Management System
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <LanguageSwitcher />
               <div className="h-6 w-px bg-border/50" />
               <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                     <div className="text-xs font-black">{t('common.adminMode')}</div>
                     <div className="text-[10px] text-green-500 font-bold tracking-tighter">● {t('common.online')}</div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-secondary to-secondary/30 border border-white/5 flex items-center justify-center font-black shadow-lg">
                    A
                  </div>
               </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="p-10 min-h-full">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/models" element={<Models />} />
                <Route path="/usage" element={<Usage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
