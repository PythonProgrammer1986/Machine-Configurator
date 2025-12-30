
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BOMPart, ConfigRule, AppScreen, MachineKnowledge, LearningEntry } from './types';
import BOMTable from './components/BOMTable';
import ConfigScreen from './components/ConfigScreen';
import SelectionScreen from './components/SelectionScreen';
import BOMGenerated from './components/BOMGenerated';
import MOProvision from './components/MOProvision';
import { LayoutDashboard, Settings2, CheckSquare, FileText, Database, FileStack, BrainCircuit } from 'lucide-react';

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.BOM_TABLE);
  const [parts, setParts] = useState<BOMPart[]>([]);
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [knowledgeBase, setKnowledgeBase] = useState<MachineKnowledge>({});
  const [currentMOModel, setCurrentMOModel] = useState<string>('Generic');
  
  const saveTimeoutRef = useRef<number | null>(null);

  // Load initial data
  useEffect(() => {
    try {
      const savedParts = localStorage.getItem('bom_parts');
      const savedRules = localStorage.getItem('bom_rules');
      const savedSelections = localStorage.getItem('bom_selections');
      const savedKB = localStorage.getItem('bom_knowledge_base');
      
      if (savedParts) setParts(JSON.parse(savedParts));
      if (savedRules) setRules(JSON.parse(savedRules));
      if (savedSelections) setSelectedPartIds(new Set(JSON.parse(savedSelections)));
      if (savedKB) setKnowledgeBase(JSON.parse(savedKB));
    } catch (e) {
      console.error("Storage loading error:", e);
    }
  }, []);

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

  const onFinalizeAndLearn = (mappings: {category: string, selection: string, partNumber: string}[]) => {
    if (!currentMOModel || currentMOModel === 'Generic') return;

    setKnowledgeBase(prev => {
      const newKB = { ...prev };
      const modelEntries = [...(newKB[currentMOModel] || [])];

      mappings.forEach(map => {
        const existing = modelEntries.find(e => e.category === map.category && e.selection === map.selection);
        if (existing) {
          if (existing.partNumber === map.partNumber) {
            existing.confirmedCount += 1;
          } else {
            // If user corrected to a different part, update it
            existing.partNumber = map.partNumber;
            existing.confirmedCount = 1;
          }
        } else {
          modelEntries.push({ ...map, confirmedCount: 1 });
        }
      });

      newKB[currentMOModel] = modelEntries;
      persist('bom_knowledge_base', newKB);
      return newKB;
    });
    
    alert(`Intelligence Base Updated for Model: ${currentMOModel}`);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case AppScreen.BOM_TABLE:
        return <BOMTable parts={parts} onPartsUpdate={p => { setParts(p); persist('bom_parts', p); }} onRulesUpdate={r => { setRules(r); persist('bom_rules', r); }} existingRules={rules} onNavigate={() => setActiveScreen(AppScreen.CONFIG)} onClearAll={() => { localStorage.clear(); window.location.reload(); }} />;
      case AppScreen.CONFIG:
        return <ConfigScreen rules={rules} onRulesUpdate={r => { setRules(r); persist('bom_rules', r); }} parts={parts} />;
      case AppScreen.MO_PROVISION:
        return (
          <MOProvision 
            parts={parts} 
            knowledgeBase={knowledgeBase}
            onModelDetected={setCurrentMOModel}
            onAutoSelect={(newIds) => {
              const updated = new Set([...selectedPartIds, ...Array.from(newIds)]);
              setSelectedPartIds(updated);
              persist('bom_selections', Array.from(updated));
            }} 
            onNavigateToSelection={() => setActiveScreen(AppScreen.SELECTION)}
          />
        );
      case AppScreen.SELECTION:
        return <SelectionScreen parts={parts} rules={rules} selectedIds={selectedPartIds} onSelectionChange={ids => { setSelectedPartIds(ids); persist('bom_selections', Array.from(ids)); }} onGenerate={() => setActiveScreen(AppScreen.BOM_GENERATED)} />;
      case AppScreen.BOM_GENERATED:
        return (
          <BOMGenerated 
            parts={parts} 
            selectedIds={selectedPartIds} 
            modelName={currentMOModel}
            onFinalizeKnowledge={onFinalizeAndLearn}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-indigo-700 text-white p-4 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveScreen(AppScreen.BOM_TABLE)}>
            <div className="p-2 bg-white/10 rounded-xl"><Database className="w-6 h-6" /></div>
            <h1 className="text-xl font-black uppercase tracking-tighter">BOM Pro <span className="text-indigo-300">Intel</span></h1>
          </div>
          <nav className="flex bg-indigo-900/40 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
            {[
              { id: AppScreen.BOM_TABLE, label: 'Table', icon: LayoutDashboard },
              { id: AppScreen.CONFIG, label: 'Logic', icon: Settings2 },
              { id: AppScreen.MO_PROVISION, label: 'MO Intel', icon: FileStack },
              { id: AppScreen.SELECTION, label: 'Configure', icon: CheckSquare },
              { id: AppScreen.BOM_GENERATED, label: 'Output', icon: FileText },
            ].map((item) => (
              <button key={item.id} onClick={() => setActiveScreen(item.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeScreen === item.id ? 'bg-white text-indigo-700 shadow-lg' : 'text-indigo-100 hover:text-white'}`}>
                <item.icon size={14} /> <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 min-h-[650px] overflow-hidden">{renderScreen()}</div>
      </main>
      <footer className="bg-white border-t p-6">
        <div className="container mx-auto flex justify-between items-center px-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Memory Engine: {Object.keys(knowledgeBase).length} Models Learned</p>
          <BrainCircuit className="text-indigo-300 animate-pulse" size={20} />
        </div>
      </footer>
    </div>
  );
};

export default App;
