
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { 
  CheckSquare, 
  Circle, 
  Square,
  FileCheck, 
  Zap, 
  ShieldCheck, 
  Sparkles,
  Search,
  Settings2,
  AlertCircle,
  Hash,
  Info,
  Check
} from 'lucide-react';

interface Props {
  parts: BOMPart[];
  rules: ConfigRule[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onGenerate: () => void;
}

const SelectionScreen: React.FC<Props> = ({ parts, rules, selectedIds, onSelectionChange, onGenerate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Logic: Exclude F0 (defaults) from the selection UI as they are automatically in the BOM
  const configParts = useMemo(() => {
    return parts.filter(p => (p.F_Code === 1 || p.F_Code === 2));
  }, [parts]);

  // Logic: Advanced Selection Logic Engine
  // Aggregates metadata from all current selections to trigger dependencies globally
  const systemRecommendedIds = useMemo(() => {
    const recommended = new Set<string>();
    
    // Include F_Code 0 (Defaults) in the trigger context
    const activeContextParts = [
      ...parts.filter(p => p.F_Code === 0),
      ...parts.filter(p => selectedIds.has(p.id))
    ];
    
    const globalMetadata = activeContextParts.map(p => 
      `${p.Remarks} ${p.Std_Remarks}`.toUpperCase()
    ).join(' ');

    rules.forEach(rule => {
      const { includes, excludes, orGroups } = rule.logic;
      
      // Validation Logic:
      // 1. All 'includes' keywords must be present (AND)
      const allIncludesMet = includes.every(kw => globalMetadata.includes(kw));
      
      // 2. No 'excludes' keywords can be present (NOT)
      const anyExcludesMet = excludes.some(kw => globalMetadata.includes(kw));
      
      // 3. At least one keyword from each 'orGroup' must be present (OR)
      const allOrGroupsMet = orGroups.every(group => group.some(kw => globalMetadata.includes(kw)));

      if (allIncludesMet && !anyExcludesMet && allOrGroupsMet && (includes.length > 0 || orGroups.length > 0)) {
        recommended.add(rule.targetPartId);
      }
    });

    return recommended;
  }, [selectedIds, parts, rules]);

  // Proactive Sync: Automatically select parts triggered by logic
  useEffect(() => {
    let hasChanges = false;
    const nextSelected = new Set(selectedIds);
    
    systemRecommendedIds.forEach(id => {
      if (!nextSelected.has(id)) {
        const part = parts.find(p => p.id === id);
        if (part && part.F_Code === 2) {
          parts.filter(p => p.Ref_des === part.Ref_des && p.F_Code === 2).forEach(p => {
            nextSelected.delete(p.id);
          });
        }
        nextSelected.add(id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onSelectionChange(nextSelected);
    }
  }, [systemRecommendedIds, parts, onSelectionChange, selectedIds]);

  // Grouping by Reference Designator
  const groupedParts = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    configParts.filter(p => {
      const q = searchTerm.toLowerCase();
      return p.Part_Number.toLowerCase().includes(q) || 
             p.Name.toLowerCase().includes(q) ||
             p.Remarks.toLowerCase().includes(q) ||
             p.Std_Remarks.toLowerCase().includes(q);
    }).forEach(p => {
      const key = p.Ref_des || 'Standard Components';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  }, [configParts, searchTerm]);

  // Validation: Mandatory F2 groups
  const validation = useMemo(() => {
    const missing: string[] = [];
    groupedParts.forEach(([group, items]) => {
      const hasF2 = items.some(p => p.F_Code === 2);
      if (hasF2) {
        const isSelected = items.some(p => selectedIds.has(p.id) && p.F_Code === 2);
        if (!isSelected) missing.push(group);
      }
    });
    const totalMandatory = groupedParts.filter(([_, items]) => items.some(p => p.F_Code === 2)).length;
    const progress = totalMandatory > 0 ? Math.round(((totalMandatory - missing.length) / totalMandatory) * 100) : 100;
    return { isValid: missing.length === 0, missing, progress };
  }, [groupedParts, selectedIds]);

  const toggleSelection = useCallback((part: BOMPart) => {
    const nextSelected = new Set(selectedIds);
    
    if (part.F_Code === 2) {
      const groupItems = groupedParts.find(([k]) => k === part.Ref_des)?.[1] || [];
      groupItems.forEach(p => {
        if (p.F_Code === 2) nextSelected.delete(p.id);
      });
      nextSelected.add(part.id);
    } else {
      if (nextSelected.has(part.id)) {
        nextSelected.delete(part.id);
      } else {
        nextSelected.add(part.id);
      }
    }
    onSelectionChange(nextSelected);
  }, [selectedIds, groupedParts, onSelectionChange]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-8 max-w-[1600px] mx-auto w-full">
          <div className="flex-1 min-w-[300px]">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-indigo-100 shadow-lg">
                <CheckSquare size={24} />
              </div>
              Engineering Configuration Selector
            </h2>
            <div className="mt-6 flex items-center gap-6">
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${validation.isValid ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                  style={{ width: `${validation.progress}%` }}
                ></div>
              </div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{validation.progress}% Groups Valid</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Filter catalog..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-bold focus:border-indigo-500 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all outline-none w-96 shadow-sm"
              />
            </div>
            <button 
              onClick={onGenerate} 
              disabled={!validation.isValid} 
              className={`px-10 py-4 rounded-[2rem] flex items-center gap-3 font-black transition-all shadow-xl text-xs uppercase tracking-[0.2em] border-b-4 active:border-b-0 active:translate-y-1 ${
                validation.isValid 
                ? 'bg-indigo-600 border-indigo-800 hover:bg-indigo-700 text-white shadow-indigo-200' 
                : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <ShieldCheck size={20} /> Build Configured BOM
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 md:p-12 space-y-16 max-w-[1600px] mx-auto w-full">
        {!validation.isValid && (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-center gap-5 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="p-3.5 bg-white rounded-full text-amber-500 shadow-md ring-8 ring-amber-100/50"><AlertCircle size={28} /></div>
            <div>
              <p className="font-black text-amber-900 uppercase tracking-[0.2em] text-xs mb-1">Configuration Required</p>
              <p className="text-amber-800 font-bold text-sm tracking-tight">Mandatory items missing for: <span className="bg-amber-200/40 px-3 py-1 rounded-xl border border-amber-300/50 ml-1">{validation.missing.join(', ')}</span></p>
            </div>
          </div>
        )}

        {groupedParts.map(([group, items]) => {
          const selectedInGroup = items.find(p => selectedIds.has(p.id) && p.F_Code === 2);
          
          return (
            <div key={group} className="space-y-10">
              <div className="flex items-center gap-6 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-4">
                <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl transform rotate-3">
                  <Hash size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-[0.3em] truncate">
                    {group}
                  </h3>
                  {selectedInGroup && (
                    <div className="text-[11px] text-indigo-600 font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-1.5 animate-in fade-in slide-in-from-left-4">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></div>
                      Selected: <span className="text-slate-700 bg-white px-3 py-0.5 rounded-full border border-slate-200 shadow-sm ml-1">{selectedInGroup.Name}</span>
                    </div>
                  )}
                </div>
                <div className="h-px bg-slate-200 flex-[0.6]"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                {items.map(part => {
                  const isSelected = selectedIds.has(part.id);
                  const isSystemSelected = systemRecommendedIds.has(part.id);
                  const isF2 = part.F_Code === 2;

                  return (
                    <button
                      key={part.id}
                      onClick={() => toggleSelection(part)}
                      className={`group relative flex flex-col text-left p-8 rounded-[3rem] border-2 transition-all duration-500 transform active:scale-95 ${
                        isSelected 
                          ? isF2 
                            ? 'border-indigo-600 bg-white shadow-2xl ring-[14px] ring-indigo-50/60 scale-[1.02] z-10' 
                            : 'border-emerald-600 bg-white shadow-2xl ring-[14px] ring-emerald-50/60 scale-[1.02] z-10'
                          : 'border-white bg-white shadow-md hover:border-slate-200 hover:shadow-2xl hover:translate-y-[-6px]'
                      } ${isSystemSelected && isSelected ? 'bg-indigo-50/20' : ''}`}
                    >
                      {isSystemSelected && (
                        <div className="absolute -top-4 left-10 px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-xl flex items-center gap-2 z-20 border-2 border-white animate-in zoom-in">
                          <Sparkles size={12} className="animate-pulse" /> Verified Logic
                        </div>
                      )}

                      <div className="absolute top-8 right-8">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5 ${
                          isF2 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          <Info size={12} />
                          {isF2 ? 'F2: Mandatory' : 'F1: Optional'}
                        </span>
                      </div>

                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-mono">
                            {part.Part_Number}
                          </span>
                          <div className={`h-2 w-16 rounded-full transition-all duration-700 shadow-sm ${isSelected ? (isF2 ? 'bg-indigo-600 w-28' : 'bg-emerald-600 w-28') : 'bg-slate-100'}`}></div>
                        </div>
                        
                        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                          isSelected 
                            ? isF2 ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-200'
                            : 'border-slate-100 group-hover:border-slate-300 group-hover:bg-slate-50'
                        }`}>
                          {isSelected ? (
                            isF2 ? <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div> : <Check size={22} className="text-white stroke-[3px]" />
                          ) : (
                            isF2 ? <Circle size={18} className="text-slate-100" /> : <Square size={18} className="text-slate-100" />
                          )}
                        </div>
                      </div>

                      <p className={`text-xl font-black leading-tight mb-8 min-h-[3rem] line-clamp-2 transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {part.Name}
                      </p>
                      
                      <div className="mt-auto space-y-6">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">Technical Specs</span>
                          <p className={`text-[13px] font-bold italic leading-relaxed line-clamp-2 ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                            {part.Remarks || 'Standard engineering part.'}
                          </p>
                        </div>

                        {part.Std_Remarks && (
                          <div className={`flex items-center gap-2.5 text-[10px] px-4 py-2.5 rounded-[1.25rem] font-black border-2 w-fit transition-all shadow-sm ${
                            isSelected 
                              ? isF2 ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-slate-500 bg-slate-50 border-slate-100 group-hover:bg-slate-100 group-hover:border-slate-200'
                          }`}>
                            <Zap size={14} className={isSelected ? 'fill-current' : 'text-slate-300'} />
                            {part.Std_Remarks.toUpperCase()}
                          </div>
                        )}

                        {isSystemSelected && isSelected && (
                          <div className="pt-5 border-t border-slate-100 flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in">
                            <Settings2 size={16} className="text-indigo-600" />
                            <span className="text-[11px] font-black text-indigo-700 uppercase tracking-tight">Active via System Logic</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-10 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-8 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
        <div className="flex gap-12">
          <span className="flex items-center gap-4">
            <div className="w-5 h-5 border-2 border-indigo-600 rounded-full flex items-center justify-center bg-indigo-50"><div className="w-2 h-2 bg-indigo-600 rounded-full"></div></div> 
            F2 Mandatory
          </span>
          <span className="flex items-center gap-4">
            <div className="w-5 h-5 border-2 border-emerald-600 rounded-lg flex items-center justify-center bg-emerald-50"><Check size={14} className="text-emerald-600 stroke-[3px]" /></div> 
            F1 Optional
          </span>
          <span className="flex items-center gap-4 text-indigo-600 px-5 py-2 rounded-full border border-indigo-100 bg-indigo-50/50 shadow-sm">
            <Sparkles size={20} className="animate-pulse" /> Global Logic Matches: {systemRecommendedIds.size}
          </span>
        </div>
        <div className="bg-slate-900 px-10 py-5 rounded-[2.5rem] text-white shadow-2xl flex items-center gap-4 border-b-4 border-indigo-500">
          <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-emerald-400 shadow-lg"></div>
          ACTIVE CONFIGURATION SKU COUNT: <span className="text-indigo-400 text-lg font-mono tracking-tighter ml-2">{(selectedIds.size + parts.filter(p => p.F_Code === 0).length).toString().padStart(3, '0')}</span>
        </div>
      </div>
    </div>
  );
};

export default SelectionScreen;
