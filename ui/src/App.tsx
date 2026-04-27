import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Box, 
  Activity, 
  Settings, 
  Info,
  ChevronRight,
  Zap,
  Key as KeyIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Accounts from './routes/accounts';
import Models from './routes/models';
import Dashboard from './routes/dashboard';
import Usage from './routes/usage';
import SettingsPage from './routes/settings';
import About from './routes/about';
import KeysPage from './routes/keys';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <div className="flex border border-border rounded-lg overflow-hidden">
      {['zh', 'en'].map(lang => (
        <button
          key={lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={cn(
            "px-2 py-1 text-[10px] font-semibold transition-colors",
            currentLang === lang ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          {lang.toUpperCase()}
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
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon size={18} />
      <span>{t(labelKey)}</span>
      {isActive && <ChevronRight size={14} className="ml-auto opacity-40" />}
    </Link>
  );
};

function App() {
  const { t } = useTranslation();

  return (
    <Router>
      <div className="flex h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
          <div className="px-6 py-8 flex items-center gap-3">
             <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
                <Zap size={20} fill="currentColor" />
             </div>
             <h1 className="text-xl font-bold tracking-tight">LLMux</h1>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 mb-2">{t('common.menuCore')}</div>
            <NavItem to="/" icon={LayoutDashboard} labelKey="common.dashboard" />
            <NavItem to="/accounts" icon={Users} labelKey="common.accounts" />
            <NavItem to="/models" icon={Box} labelKey="common.models" />
            <NavItem to="/keys" icon={KeyIcon} labelKey="common.keys" />
            <NavItem to="/usage" icon={Activity} labelKey="common.usage" />
            
            <div className="pt-6 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 mb-2">{t('common.menuPref')}</div>
            <NavItem to="/settings" icon={Settings} labelKey="common.settings" />
            <NavItem to="/about" icon={Info} labelKey="common.about" />
          </nav>

          <div className="p-4 border-t border-border mt-auto">
             <div className="flex items-center gap-2 p-2 px-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t('common.systemNormal')}
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 border-b border-border flex items-center px-8 bg-card/50 backdrop-blur-md sticky top-0 z-40">
            <div className="flex-1">
               <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                  Gateway Management Portal
               </span>
            </div>
            <div className="flex items-center gap-4">
               <LanguageSwitcher />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-7xl mx-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/models" element={<Models />} />
                <Route path="/keys" element={<KeysPage />} />
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
