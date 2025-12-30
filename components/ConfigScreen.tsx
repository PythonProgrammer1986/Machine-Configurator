
import React, { useState, useRef } from 'react';
import { ConfigRule, BOMPart, RuleLogic } from '../types';
import { Settings, Plus, X, Download, Upload, Edit3, Save, Search, HelpCircle, Wand2, Hash } from 'lucide-react';

interface Props {
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  parts: BOMPart[];
}

const ConfigScreen: React.FC<Props> = ({ rules, onRulesUpdate, parts }) => {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    targetPartId: '',
    keywordString: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectableParts = parts.filter(p => p.F_Code === 1 || p.F_Code === 2);

  const parseLogicString = (str: string): RuleLogic => {
    const orGroups: string[][] = [];
    const excludes: string[] = [];
    const includes: string[] = [];
    let workingStr = str || '';

    const orRegex = /\(([^)]+)\)/g;
    let orMatch;
    while ((orMatch = orRegex.exec(str)) !== null) {
      const group = orMatch[1].split('/').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
      if (group.length > 0) orGroups.push(group);
      workingStr = workingStr.replace(orMatch[0], ' ');
    }

    const notRegex = /\[([^\]]+)\]/g;
    let notMatch;
    while ((notMatch = notRegex.exec(str)) !== null) {
      const items = notMatch[1].split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
      excludes.push(...items);
      workingStr = workingStr.replace(notMatch[0], ' ');
    }

    const remaining = workingStr.split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    includes.push(...remaining);

    return { includes, excludes, orGroups, raw: str };
  };

  const autoGenerateMissingRules = () => {
    const KEYWORDS_DICT = ['CAB', 'ENGINE', 'CANOPY', 'OIL', 'FUEL', 'FLUID', 'HYDRAULIC', 'AIR', 'PRESSURE', 'HEATER', 'LIGHT', 'AC', 'STD'];
    const newRules: ConfigRule[] = [...rules];
    let count = 0;

    selectableParts.forEach(part => {
      if (newRules.some(r => r.targetPartId === part.id)) return;
      const metadata = (part.Remarks + ' ' + part.Std_Remarks).toUpperCase();
      const words = metadata.split(/[\s,._+/]+/).filter(w => w.length > 1);
      const matchedKeywords = Array.from(new Set(words.filter(word => KEYWORDS_DICT.includes(word))));

      if (matchedKeywords.length > 0) {
        newRules.push({
          id: `auto-${Date.now()}-${count}`,
          targetPartId: part.id,
          logic: {
            includes: matchedKeywords,
            excludes: [],
            orGroups: [],
            raw: matchedKeywords.join(' ')
          },
          isActive: true
        });
        count++;
      }
    });

    if (count > 0) {
      onRulesUpdate(newRules);
      alert(`Successfully auto-generated ${count} new logic rules!`);
    } else {
      alert("No new logic patterns discovered in existing part remarks.");
    }
  };

  const addRule = () => {
    if (!newRule.targetPartId || !newRule.keywordString) {
      alert('Please select a target part and enter keywords.');
      return;
    }
    const rule: ConfigRule = {
      id: `rule-${Date.now()}`,
      targetPartId: newRule.targetPartId,
      logic: parseLogicString(newRule.keywordString),
      isActive: true
    };
    onRulesUpdate([...rules, rule]);
    setNewRule({ targetPartId: '', keywordString: '' });
  };

  const updateRule = (id: string, rawString: string) => {
    onRulesUpdate(rules.map(r => r.id === id ? { ...r, logic: parseLogicString(rawString) } : r));
    setEditingRuleId(null);
  };

  const deleteRule = (id: string) => {
    onRulesUpdate(rules.filter(r => r.id !== id));
  };

  const exportConfig = () => {
    const exportData = rules.map(rule => {
      const p = parts.find(part => part.id === rule.targetPartId);
      return {
        Part_Number: p?.Part_Number || 'Unknown',
        Name: p?.Name || 'Unknown',
        Ref_des: p?.Ref_des || '',
        Logic: rule.logic.raw
      };
    });
    const ws = (window as any).XLSX.utils.json_to_sheet(exportData);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Logic Config");
    (window as any).XLSX.writeFile(wb, `BOM_Logic_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
      const data = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const importedRules: ConfigRule[] = data.map((row: any) => {
        const part = parts.find(p => p.Part_Number === String(row.Part_Number || ''));
        const rawLogic = String(row.Logic || row.Logic_Config || row.Contains || '');
        if (!part || !rawLogic) return null;
        return {
          id: `imp-${Date.now()}-${Math.random()}`,
          targetPartId: part.id,
          logic: parseLogicString(rawLogic),
          isActive: true
        };
      }).filter((r): r is ConfigRule => r !== null);
      onRulesUpdate([...rules, ...importedRules]);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-indigo-600" />
            Engineering Logic Management
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configure SKU dependencies using advanced syntax triggers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={autoGenerateMissingRules} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black border border-emerald-200 transition-all shadow-sm">
            <Wand2 size={14} /> Smart Auto-Generate
          </button>
          <input type="file" ref={fileInputRef} onChange={importConfig} accept=".xlsx,.xls,.csv" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold border border-slate-200 transition-all shadow-sm">
            <Upload size={14} /> Import Rules
          </button>
          <button onClick={exportConfig} className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold border border-slate-200 transition-all shadow-sm">
            <Download size={14} /> Export Logic
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-4 items-start">
          <HelpCircle className="text-indigo-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-indigo-900 leading-relaxed">
            <p className="font-black uppercase mb-1 text-[10px] tracking-wider">Advanced Logic Syntax Guide:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <p>• <span className="font-bold">AND:</span> Separate keywords with spaces. <code className="bg-white px-1 rounded font-mono border">CAB STD</code></p>
              <p>• <span className="font-bold">OR:</span> Wrap in parentheses with slashes. <code className="bg-white px-1 rounded font-mono border">(CAB/CAN)</code></p>
              <p>• <span className="font-bold">NOT:</span> Wrap in square brackets. <code className="bg-white px-1 rounded font-mono border">[TT BT]</code></p>
              <p>• <span className="font-bold">Combo:</span> Mix all three. <code className="bg-white px-1 rounded font-mono border">(CAB/CAN) STD [TT BT]</code></p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
            New Dependency Definition
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Component (SKU)</label>
              <select 
                value={newRule.targetPartId}
                onChange={(e) => setNewRule({...newRule, targetPartId: e.target.value})}
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
              >
                <option value="">Select SKU...</option>
                {selectableParts.map(p => <option key={p.id} value={p.id}>{p.Ref_des || '??'} | {p.Part_Number} — {p.Name}</option>)}
              </select>
            </div>
            <div className="md:col-span-6 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Trigger Expression</label>
              <input 
                type="text"
                placeholder="(CAB/CAN) STD [TT BT]"
                value={newRule.keywordString}
                onChange={(e) => setNewRule({...newRule, keywordString: e.target.value})}
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
              />
            </div>
            <div className="md:col-span-2">
              <button onClick={addRule} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-100 text-xs uppercase tracking-widest">
                <Plus size={18} /> Add Rule
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.15em]">Active Engineering Logic</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Filter rules..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white focus:ring-4 focus:ring-slate-100 transition-all"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
            {rules.length === 0 ? (
              <div className="p-24 text-center">
                <Settings size={48} className="mx-auto mb-4 opacity-10 text-slate-900" />
                <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No Logic Defined</p>
              </div>
            ) : (
              rules.filter(r => {
                const p = parts.find(part => part.id === r.targetPartId);
                const search = searchTerm.toLowerCase();
                return p?.Part_Number.toLowerCase().includes(search) || r.logic.raw.toLowerCase().includes(search) || p?.Ref_des.toLowerCase().includes(search);
              }).map((rule) => {
                const p = parts.find(part => part.id === rule.targetPartId);
                const isEditing = editingRuleId === rule.id;

                return (
                  <div key={rule.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="flex items-center gap-5">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm overflow-hidden">
                          <span className="text-[8px] font-black uppercase opacity-60">Designator</span>
                          <span className="text-[11px] font-black font-mono">{p?.Ref_des || '-'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 font-mono tracking-tight">{p?.Part_Number || 'Unknown PN'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px] mt-0.5">{p?.Name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Triggers if:</div>
                         {isEditing ? (
                           <input 
                             type="text"
                             defaultValue={rule.logic.raw}
                             onBlur={(e) => updateRule(rule.id, e.target.value)}
                             className="flex-1 border-2 border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none ring-4 ring-indigo-500/10"
                             autoFocus
                           />
                         ) : (
                           <div className="flex flex-wrap gap-2 items-center">
                             <span className="text-xs font-mono font-bold text-indigo-700 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{rule.logic.raw}</span>
                             <div className="flex gap-1">
                               {rule.logic.includes.map((k, i) => <span key={i} className="text-[8px] bg-emerald-50 text-emerald-700 px-1 rounded border border-emerald-100">AND {k}</span>)}
                               {rule.logic.orGroups.map((g, i) => <span key={i} className="text-[8px] bg-indigo-50 text-indigo-700 px-1 rounded border border-indigo-100">OR ({g.join('/')})</span>)}
                               {rule.logic.excludes.map((k, i) => <span key={i} className="text-[8px] bg-red-50 text-red-700 px-1 rounded border border-red-100">NOT {k}</span>)}
                             </div>
                           </div>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-8">
                      {isEditing ? (
                        <button onClick={() => setEditingRuleId(null)} className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Save size={20} /></button>
                      ) : (
                        <button onClick={() => setEditingRuleId(rule.id)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm hover:shadow-indigo-100"><Edit3 size={18} /></button>
                      )}
                      <button onClick={() => deleteRule(rule.id)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all hover:shadow-red-100"><X size={20} /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigScreen;
