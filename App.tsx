
import React, { useState, useEffect } from 'react';
import { BOMPart, ConfigRule, AppScreen } from './types';
import BOMTable from './components/BOMTable';
import ConfigScreen from './components/ConfigScreen';
import SelectionScreen from './components/SelectionScreen';
import BOMGenerated from './components/BOMGenerated';
import { LayoutDashboard, Settings2, CheckSquare, FileText, Database } from 'lucide-react';

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.BOM_TABLE);
  const [parts, setParts] = useState<BOMPart[]>([]);
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());

  // Load persistence
  useEffect(() => {
    const savedParts = localStorage.getItem('bom_parts');
    const savedRules = localStorage.getItem('bom_rules');
    const savedSelections = localStorage.getItem('bom_selections');
    if (savedParts) setParts(JSON.parse(savedParts));
    if (savedRules) setRules(JSON.parse(savedRules));
    if (savedSelections) setSelectedPartIds(new Set(JSON.parse(savedSelections)));
  }, []);

  const saveParts = (newParts: BOMPart[]) => {
    setParts(newParts);
    localStorage.setItem('bom_parts', JSON.stringify(newParts));
  };

  const saveRules = (newRules: ConfigRule[]) => {
    setRules(newRules);
    localStorage.setItem('bom_rules', JSON.stringify(newRules));
  };

  const saveSelections = (newSelections: Set<string>) => {
    setSelectedPartIds(newSelections);
    localStorage.setItem('bom_selections', JSON.stringify(Array.from(newSelections)));
  };

  const clearAllData = () => {
    setParts([]);
    setRules([]);
    setSelectedPartIds(new Set());
    localStorage.removeItem('bom_parts');
    localStorage.removeItem('bom_rules');
    localStorage.removeItem('bom_selections');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case AppScreen.BOM_TABLE:
        return <BOMTable parts={parts} onPartsUpdate={saveParts} onNavigate={() => setActiveScreen(AppScreen.CONFIG)} onClearAll={clearAllData} />;
      case AppScreen.CONFIG:
        return <ConfigScreen rules={rules} onRulesUpdate={saveRules} parts={parts} />;
      case AppScreen.SELECTION:
        return <SelectionScreen 
          parts={parts} 
          rules={rules} 
          selectedIds={selectedPartIds} 
          onSelectionChange={saveSelections}
          onGenerate={() => setActiveScreen(AppScreen.BOM_GENERATED)}
        />;
      case AppScreen.BOM_GENERATED:
        return <BOMGenerated 
          parts={parts} 
          selectedIds={selectedPartIds} 
        />;
      default:
        return <BOMTable parts={parts} onPartsUpdate={saveParts} onNavigate={() => setActiveScreen(AppScreen.CONFIG)} onClearAll={clearAllData} />;
    }
  };

  const navItems = [
    { id: AppScreen.BOM_TABLE, label: 'BOM Table', icon: LayoutDashboard },
    { id: AppScreen.CONFIG, label: 'Logic Config', icon: Settings2 },
    { id: AppScreen.SELECTION, label: 'Selection', icon: CheckSquare },
    { id: AppScreen.BOM_GENERATED, label: 'BOM Generated', icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">BOM Configurator Pro</h1>
          </div>
          <nav className="flex bg-indigo-800 rounded-lg p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${
                    activeScreen === item.id 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-indigo-100 hover:bg-indigo-600'
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] overflow-hidden">
          {renderScreen()}
        </div>
      </main>

      <footer className="bg-slate-100 border-t border-slate-200 p-4 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} BOM Configurator Pro. Build Smarter Assemblies.
      </footer>
    </div>
  );
};

export default App;
