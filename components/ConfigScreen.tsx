
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
    return str.split(/[\s+,]+/).map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
  };

  const addRule = () => {
    if (!newRule.targetPartId || !newRule.keywordString) {
      alert('Please select a target part and enter trigger keywords.');
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
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Engineering Logic");
    (window as any).XLSX.writeFile(wb, `BOM_Logic_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
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
        // Find part by Part_Number + Name for unique matching
        const part = parts.find(p => p.Part_Number === row.Part_Number && p.Name === row.Name);
        return {
          id: `imp-${Date.now()}-${Math.random()}`,
          targetPartId: part?.id || '',
          keywords: parseKeywords(String(row.Contains || '')),
          isActive: true
        };
      }).filter(r => r.targetPartId !== '');

      onRulesUpdate(importedRules);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-indigo-600" />
            Logic Configurator
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Define Part Dependencies via Technical Keyword Matches</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={importConfig} accept=".xlsx,.xls,.csv" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded flex items-center gap-1 text-xs font-bold border border-slate-200 transition-all">
            <Upload size={14} /> Import Rules
          </button>
          <button onClick={exportConfig} className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded flex items-center gap-1 text-xs font-bold border border-slate-200 transition-all">
            <Download size={14} /> Export Logic
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* NEW RULE FORM */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Add Engineering Dependency</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Target Component</label>
              <select 
                value={newRule.targetPartId}
                onChange={(e) => setNewRule({...newRule, targetPartId: e.target.value})}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select SKU...</option>
                {selectableParts.map(p => <option key={p.id} value={p.id}>{p.Part_Number} - {p.Name}</option>)}
              </select>
            </div>
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Trigger Keywords (e.g. AC + STD + CAB)</label>
              <input 
                type="text"
                placeholder="Keywords required to trigger selection..."
                value={newRule.keywordString}
                onChange={(e) => setNewRule({...newRule, keywordString: e.target.value})}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="md:col-span-2">
              <button 
                onClick={addRule}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 text-xs uppercase tracking-widest"
              >
                <Plus size={16} /> Create
              </button>
            </div>
          </div>
        </div>

        {/* RULES LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Active System Rules</h3>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Filter rules..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
            {rules.length === 0 ? (
              <div className="p-20 text-center text-slate-300">
                <Settings size={40} className="mx-auto mb-4 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">No Active Dependencies</p>
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
                  <div key={rule.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">SKU</div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{p?.Part_Number || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{p?.Name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Required If:</div>
                         {isEditing ? (
                           <input 
                             type="text"
                             defaultValue={rule.keywords.join(' + ')}
                             onBlur={(e) => updateRule(rule.id, { keywords: parseKeywords(e.target.value) })}
                             className="flex-1 border border-indigo-200 rounded-md px-2 py-1 text-xs font-bold outline-none ring-2 ring-indigo-500/10"
                             autoFocus
                           />
                         ) : (
                           <div className="flex flex-wrap gap-1.5">
                             {rule.keywords.map((k, i) => (
                               <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-black">{k}</span>
                             ))}
                           </div>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {isEditing ? (
                        <button onClick={() => setEditingRuleId(null)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Save size={18} /></button>
                      ) : (
                        <button onClick={() => setEditingRuleId(rule.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit3 size={18} /></button>
                      )}
                      <button onClick={() => deleteRule(rule.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={18} /></button>
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
