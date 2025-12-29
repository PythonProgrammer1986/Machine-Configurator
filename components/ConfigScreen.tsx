
import React, { useState, useRef } from 'react';
import { ConfigRule, BOMPart, LogicOperator } from '../types';
import { Settings, Plus, X, Download, Upload } from 'lucide-react';

interface Props {
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  parts: BOMPart[];
}

const ConfigScreen: React.FC<Props> = ({ rules, onRulesUpdate, parts }) => {
  const [newRule, setNewRule] = useState<Partial<ConfigRule>>({
    triggerField: 'Remarks',
    triggerOperator: 'CONTAINS',
    targetPartId: '',
    isActive: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available selectable parts (F-Code 1 and 2)
  const selectableParts = parts.filter(p => p.F_Code === 1 || p.F_Code === 2);

  const addRule = () => {
    if (!newRule.triggerValue || !newRule.targetPartId) {
      alert('Please fill in both trigger keyword (Remarks) and the target part.');
      return;
    }

    const rule: ConfigRule = {
      id: `rule-${Date.now()}`,
      triggerField: (newRule.triggerField as keyof BOMPart) || 'Remarks',
      triggerOperator: (newRule.triggerOperator as LogicOperator) || 'CONTAINS',
      triggerValue: newRule.triggerValue || '',
      targetPartId: newRule.targetPartId || '',
      isActive: true
    };

    onRulesUpdate([...rules, rule]);
    setNewRule({ ...newRule, triggerValue: '', targetPartId: '' });
  };

  const deleteRule = (id: string) => {
    onRulesUpdate(rules.filter(r => r.id !== id));
  };

  const exportConfig = () => {
    const ws = (window as any).XLSX.utils.json_to_sheet(rules);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Rules");
    (window as any).XLSX.writeFile(wb, "bom_config_rules.xlsx");
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = (window as any).XLSX.utils.sheet_to_json(ws);
      onRulesUpdate(data as ConfigRule[]);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-indigo-600" />
            Logic Configuration
          </h2>
          <p className="text-sm text-slate-500">Map Remarks trigger to specific Part Number & Name targets.</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={importConfig} accept=".xlsx,.xls,.csv" className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded flex items-center gap-1 text-sm font-medium border border-slate-200"
          >
            <Upload size={16} /> Import Rules
          </button>
          <button 
            onClick={exportConfig}
            className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded flex items-center gap-1 text-sm font-medium border border-slate-200"
          >
            <Download size={16} /> Export Rules
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-sm">
          <h3 className="text-indigo-900 font-semibold mb-4 text-sm uppercase tracking-wider">Create New Rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">If [Remarks] Contains</label>
              <input 
                type="text"
                placeholder="e.g. PRESSURIZER"
                value={newRule.triggerValue}
                onChange={(e) => setNewRule({...newRule, triggerValue: e.target.value})}
                className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Then show this specific Part</label>
              <select 
                value={newRule.targetPartId}
                onChange={(e) => setNewRule({...newRule, targetPartId: e.target.value})}
                className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">Select Part Number & Name...</option>
                {selectableParts.map(part => (
                  <option key={part.id} value={part.id}>
                    {part.Part_Number} - {part.Name} ({part.Ref_des})
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={addRule}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md"
            >
              <Plus size={20} /> Add Rule
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between">
            <h3 className="font-bold text-slate-700">Active Dependency Rules</h3>
            <span className="text-xs text-slate-400 bg-white px-2 py-1 border rounded">{rules.length} Rules Defined</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-auto">
            {rules.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p>No rules defined. All parts (F-Code 1/2) are shown by default.</p>
              </div>
            ) : (
              rules.map((rule) => {
                const targetPart = parts.find(p => p.id === rule.targetPartId);
                return (
                  <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-indigo-600 uppercase text-xs">If Selection Remarks contains</span>
                      <span className="bg-amber-50 px-2 py-1 rounded border border-amber-100 text-amber-800 font-bold">"{rule.triggerValue}"</span>
                      <span className="font-semibold text-emerald-600 uppercase text-xs">Then allow selection of</span>
                      <span className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-emerald-800 font-medium">
                        {targetPart ? `${targetPart.Part_Number} - ${targetPart.Name}` : 'Unknown Part'}
                      </span>
                    </div>
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
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
