
import React, { useState, useRef } from 'react';
import { ConfigRule, BOMPart } from '../types';
import { Settings, Plus, X, Download, Upload, Edit3, Save, Search } from 'lucide-react';

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

  const parseKeywords = (str: string) => {
    return str.split(/[\s+,._/]+/).map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
  };

  const addRule = () => {
    if (!newRule.targetPartId || !newRule.keywordString) {
      alert('Please select a target part and enter keywords.');
      return;
    }

    const rule: ConfigRule = {
      id: `rule-${Date.now()}`,
      targetPartId: newRule.targetPartId,
      keywords: parseKeywords(newRule.keywordString),
      isActive: true
    };

    onRulesUpdate([...rules, rule]);
    setNewRule({ targetPartId: '', keywordString: '' });
  };

  const updateRule = (id: string, updatedFields: Partial<ConfigRule>) => {
    onRulesUpdate(rules.map(r => r.id === id ? { ...r, ...updatedFields } : r));
    setEditingRuleId(null);
  };

  const deleteRule = (id: string) => {
    onRulesUpdate(rules.filter(r => r.id !== id));
  };

  const exportConfig = () => {
    // Requirement: Export logic with specific columns
    const exportData = rules.map(rule => {
      const p = parts.find(part => part.id === rule.targetPartId);
      return {
        Part_Number: p?.Part_Number || 'Unknown',
        Name: p?.Name || 'Unknown',
        Contains: rule.keywords.join(' + '),
        Std_Remarks: p?.Std_Remarks || '',
        Remarks: p?.Remarks || ''
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
        return {
          id: `imp-${Date.now()}-${Math.random()}`,
          targetPartId: part?.id || '',
          keywords: parseKeywords(String(row.Contains || '')),
          isActive: true
        };
      }).filter(r => r.targetPartId !== '');

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
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configure SKU dependencies using technical keyword triggers</p>
        </div>
        <div className="flex gap-2">
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
        {/* NEW RULE FORM */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
            New Dependency Definition
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Component (SKU)</label>
              <select 
                value={newRule.targetPartId}
                onChange={(e) => setNewRule({...newRule, targetPartId: e.target.value})}
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
              >
                <option value="">Select SKU to control...</option>
                {selectableParts.map(p => <option key={p.id} value={p.id}>{p.Part_Number} — {p.Name}</option>)}
              </select>
            </div>
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Trigger Keywords (Combined AND logic)</label>
              <input 
                type="text"
                placeholder="e.g. AC STD CAB"
                value={newRule.keywordString}
                onChange={(e) => setNewRule({...newRule, keywordString: e.target.value})}
                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
              />
            </div>
            <div className="md:col-span-2">
              <button 
                onClick={addRule}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-100 text-xs uppercase tracking-widest"
              >
                <Plus size={18} /> Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* RULES TABLE */}
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
                return p?.Part_Number.toLowerCase().includes(search) || r.keywords.join(' ').toLowerCase().includes(search);
              }).map((rule) => {
                const p = parts.find(part => part.id === rule.targetPartId);
                const isEditing = editingRuleId === rule.id;

                return (
                  <div key={rule.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px] shadow-sm border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">SKU</div>
                        <div>
                          <p className="text-sm font-black text-slate-900 font-mono tracking-tight">{p?.Part_Number || 'Unknown PN'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px] mt-0.5">{p?.Name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[80px]">If contains:</div>
                         {isEditing ? (
                           <input 
                             type="text"
                             defaultValue={rule.keywords.join(' ')}
                             onBlur={(e) => updateRule(rule.id, { keywords: parseKeywords(e.target.value) })}
                             className="flex-1 border-2 border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none ring-4 ring-indigo-500/10"
                             autoFocus
                           />
                         ) : (
                           <div className="flex flex-wrap gap-2">
                             {rule.keywords.map((k, i) => (
                               <span key={i} className="px-3 py-1 bg-white text-indigo-700 border border-slate-200 rounded-lg text-[10px] font-black shadow-sm">{k}</span>
                             ))}
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
