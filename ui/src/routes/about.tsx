import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, 
  Github, 
  Globe, 
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  ExternalLink,
  Code2,
  Terminal,
  Box
} from 'lucide-react';

const FeatureItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex gap-5 p-6 rounded-3xl bg-secondary/10 border border-white/5 hover:bg-secondary/20 transition-all group">
     <div className="p-3 bg-primary/10 text-primary rounded-2xl h-fit ring-1 ring-primary/20 group-hover:scale-110 transition-transform">
        <Icon size={24} />
     </div>
     <div className="space-y-1">
        <h4 className="text-lg font-black tracking-tight">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed opacity-70 font-medium">{desc}</p>
     </div>
  </div>
);

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="max-w-[1000px] mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center space-y-6 pt-10 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10" />
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest text-primary mb-4 shadow-2xl">
           <Sparkles size={14} className="animate-pulse" /> {t('about.established')}
        </div>
        <h1 className="text-7xl font-black tracking-[calc(-0.06em)] italic leading-none">
          Unified AI <br /> Gateway <span className="text-primary/10">Engine</span>
        </h1>
        <p className="text-xl text-muted-foreground font-bold max-w-xl mx-auto opacity-70">
           {t('about.desc')}
        </p>
      </div>

      {/* Donation & Main Action */}
      <div className="flex flex-col items-center gap-6">
         <a 
           href="https://ifdian.net/a/llmux" 
           target="_blank" 
           rel="noopener noreferrer"
           className="group relative px-10 py-6 bg-gradient-to-br from-[#946ce6] to-[#7b51db] rounded-[2.5rem] shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all hover:-translate-y-1 active:scale-95"
         >
            <div className="flex items-center gap-4 relative z-10">
               <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                 <Heart size={24} fill="currentColor" className="text-white animate-pulse" />
               </div>
               <div className="text-left">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">{t('about.support')}</div>
                  <div className="text-lg font-black text-white italic tracking-tight">{t('about.sponsor')}</div>
               </div>
               <ExternalLink size={20} className="text-white/40 group-hover:text-white transition-colors ml-4" />
            </div>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />
         </a>

         <a 
           href="https://github.com/zhMoody/llmux-cli" 
           target="_blank" 
           rel="noopener noreferrer"
           className="flex items-center gap-2 px-6 py-3 bg-secondary/50 hover:bg-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group border border-white/5"
         >
           <Github size={16} className="group-hover:scale-110 transition-transform" />
           Star on GitHub
         </a>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <FeatureItem 
           icon={Zap} 
           title={t('about.features.speed')} 
           desc={t('about.features.speedDesc')} 
         />
         <FeatureItem 
           icon={ShieldCheck} 
           title={t('about.features.privacy')} 
           desc={t('about.features.privacyDesc')} 
         />
         <FeatureItem 
           icon={Cpu} 
           title={t('about.features.agnostic')} 
           desc={t('about.features.agnosticDesc')} 
         />
         <FeatureItem 
           icon={Globe} 
           title={t('about.features.multi')} 
           desc={t('about.features.multiDesc')} 
         />
      </div>

      {/* Tech Stack */}
      <div className="premium-card text-center space-y-8 bg-gradient-to-br from-primary/5 to-transparent">
         <div className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-50">{t('about.tech')}</div>
         <div className="flex flex-wrap justify-center gap-8">
            {[
              { name: 'React', icon: Code2 },
              { name: 'Vite', icon: Terminal },
              { name: 'TypeScript', icon: Box },
              { name: 'Tailwind', icon: Sparkles },
              { name: 'Bun', icon: Zap },
              { name: 'Lucide', icon: Cpu }
            ].map(tech => (
              <div key={tech.name} className="flex items-center gap-2 text-sm font-black tracking-tighter opacity-60 hover:opacity-100 hover:text-primary transition-all cursor-default">
                <tech.icon size={16} />
                {tech.name}
              </div>
            ))}
         </div>
      </div>

      {/* Footer Links */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/5 pt-10">
         <div className="flex items-center gap-2 text-sm font-bold opacity-60 italic">
            LLMux Engine v0.1.0-alpha · Open Source under AGPL-3.0
         </div>
         <div className="flex items-center gap-6">
            <a href="https://github.com/zhMoody/llmux-cli" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:text-primary transition-all">
               <Github size={18} /> {t('about.source')}
            </a>
            <a href="#" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:text-primary transition-all">
               <Globe size={18} /> {t('about.docs')}
            </a>
         </div>
      </div>
    </div>
  );
}
