import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BOMPart, ConfigRule, AppScreen } from './types';
import BOMTable from './components/BOMTable';
import ConfigScreen from './components/ConfigScreen';
import SelectionScreen from './components/SelectionScreen';
import BOMGenerated from './components/BOMGenerated';
import MOProvision from './components/MOProvision';
import { LayoutDashboard, Settings2, CheckSquare, FileText, Database, FileStack } from 'lucide-react';

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.BOM_TABLE);
  const [parts, setParts] = useState<BOMPart[]>([]);
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const saveTimeoutRef = useRef<number | null>(null);

  // Load initial data
  useEffect(() => {
    try {
      const savedParts = localStorage.getItem('bom_parts');
      const savedRules = localStorage.getItem('bom_rules');
      const savedSelections = localStorage.getItem('bom_selections');
      if (savedParts) setParts(JSON.parse(savedParts));
      if (savedRules) setRules(JSON.parse(savedRules));
      if (savedSelections) setSelectedPartIds(new Set(JSON.parse(savedSelections)));
    } catch (e) {
      console.error("Storage loading error:", e);
    }
  }, []);

  // Debounced persistence layer
  const persist = useCallback((key: string, data: any) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      } catch (e) {
        console.warn("Storage write failure:", e);
      }
    }, 800);
  }, []);

  const onPartsUpdate = (newParts: BOMPart[]) => {
    setParts(newParts);
    persist('bom_parts', newParts);
  };

  const onRulesUpdate = (newRules: ConfigRule[]) => {
    setRules(newRules);
    persist('bom_rules', newRules);
  };

  const onSelectionChange = (newSelections: Set<string>) => {
    setSelectedPartIds(newSelections);
    persist('bom_selections', Array.from(newSelections));
  };

  const clearAllData = () => {
    if (window.confirm("Permanently wipe local engineering database?")) {
      setParts([]);
      setRules([]);
      setSelectedPartIds(new Set());
      localStorage.clear();
      setActiveScreen(AppScreen.BOM_TABLE);
    }
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case AppScreen.BOM_TABLE:
        return (
          <BOMTable 
            parts={parts} 
            onPartsUpdate={onPartsUpdate} 
            onRulesUpdate={onRulesUpdate}
            existingRules={rules}
            onNavigate={() => setActiveScreen(AppScreen.CONFIG)} 
            onClearAll={clearAllData} 
          />
        );
      case AppScreen.CONFIG:
        return <ConfigScreen rules={rules} onRulesUpdate={onRulesUpdate} parts={parts} />;
      case AppScreen.MO_PROVISION:
        return (
          <MOProvision 
            parts={parts} 
            onAutoSelect={(newIds) => {
              const updated = new Set([...selectedPartIds, ...Array.from(newIds)]);
              onSelectionChange(updated);
            }} 
            onNavigateToSelection={() => setActiveScreen(AppScreen.SELECTION)}
          />
        );
      case AppScreen.SELECTION:
        return (
          <SelectionScreen 
            parts={parts} 
            rules={rules} 
            selectedIds={selectedPartIds} 
            onSelectionChange={onSelectionChange}
            onGenerate={() => setActiveScreen(AppScreen.BOM_GENERATED)}
          />
        );
      case AppScreen.BOM_GENERATED:
        return <BOMGenerated parts={parts} selectedIds={selectedPartIds} rules={rules} />;
      default:
        return null;
    }
  };

  const navItems = [
    { id: AppScreen.BOM_TABLE, label: 'Table', icon: LayoutDashboard },
    { id: AppScreen.CONFIG, label: 'Logic', icon: Settings2 },
    { id: AppScreen.MO_PROVISION, label: 'MO Intel', icon: FileStack },
    { id: AppScreen.SELECTION, label: 'Configure', icon: CheckSquare },
    { id: AppScreen.BOM_GENERATED, label: 'Output', icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-indigo-700 text-white p-4 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform" 
            onClick={() => setActiveScreen(AppScreen.BOM_TABLE)}
          >
            <div className="p-2 bg-white/10 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase">BOM Configurator <span className="text-indigo-300">Pro</span></h1>
          </div>
          <nav className="flex bg-indigo-900/40 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${
                    isActive 
                    ? 'bg-white text-indigo-700 shadow-lg scale-105' 
                    : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-900/5 border border-slate-200 min-h-[650px] overflow-hidden transition-all duration-300">
          {renderScreen()}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-6">
        <div className="container mx-auto flex justify-between items-center px-4">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
             High Stability Build List Generator
           </p>
           <div className="flex gap-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Stable"></div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;