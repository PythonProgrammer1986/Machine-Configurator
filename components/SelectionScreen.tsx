
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
  Hash
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
  
  // All F1 and F2 parts are visible for manual or system selection
  const configParts = useMemo(() => {
    return parts.filter(p => (p.F_Code === 1 || p.F_Code === 2));
  }, [parts]);

  // Logic Evaluation for System Selection
  // Rule Logic: Selection logic runs across DIFFERENT Ref_des. 
  // We collect metadata from ALL currently selected parts (including F_Code 0 defaults)
  const systemRecommendedIds = useMemo(() => {
    const recommended = new Set<string>();
    
    // Include F_Code 0 parts in the trigger context as they are "default added"
    const defaultParts = parts.filter(p => p.F_Code === 0);
    const contextParts = [...defaultParts, ...parts.filter(p => selectedIds.has(p.id))];
    
    const combinedMetadata = contextParts.map(p => {
      return (p?.Remarks + ' ' + p?.Std_Remarks).toUpperCase();
    }).join(' ');

    rules.forEach(rule => {
      // AND Logic: All keywords in rule must exist in combined metadata of all active selections
      const allKeywordsMet = rule.keywords.length > 0 && rule.keywords.every(kw => 
        combinedMetadata.includes(kw.toUpperCase())
      );
      
      if (allKeywordsMet) {
        recommended.add(rule.targetPartId);
      }
    });

    return recommended;
  }, [selectedIds, parts, rules]);

  // Sync system recommendations into selection state
  useEffect(() => {
    let changed = false;
    const newSelected = new Set(selectedIds);
    
    systemRecommendedIds.forEach(id => {
      if (!newSelected.has(id)) {
        newSelected.add(id);
        changed = true;
      }
    });

    if (changed) {
      onSelectionChange(newSelected);
    }
  }, [systemRecommendedIds]);

  // Grouping by Reference Designator
  const groupedParts = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    configParts.filter(p => 
      p.Part_Number.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Std_Remarks.toLowerCase().includes(searchTerm.toLowerCase())
    ).forEach(p => {
      const key = p.Ref_des || 'Unassigned Components';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  }, [configParts, searchTerm]);

  // Validation: Mandatory (F2) check
  const validation = useMemo(() => {
    const missing: string[] = [];
    groupedParts.forEach(([group, items]) => {
      const hasMandatoryParts = items.some(p => p.F_Code === 2);
      if (hasMandatoryParts) {
        const isSelectedInGroup = items.some(p => selectedIds.has(p.id) && p.F_Code === 2);
        if (!isSelectedInGroup) missing.push(group);
      }
    });
    const totalMandatoryGroups = groupedParts.filter(([_, items]) => items.some(p => p.F_Code === 2)).length;
    const metCount = totalMandatoryGroups - missing.length;
    const progress = totalMandatoryGroups > 0 ? Math.round((metCount / totalMandatoryGroups) * 100) : 100;
    return { isValid: missing.length === 0, missing, progress };
  }, [groupedParts, selectedIds]);

  const toggleSelection = useCallback((part: BOMPart) => {
    const newSelected = new Set(selectedIds);
    
    if (part.F_Code === 2) {
      // Requirement: Only one selection allowed for F_Code 2 within same Ref_des group
      const groupItems = groupedParts.find(([k]) => k === part.Ref_des)?.[1] || [];
      groupItems.forEach(p => {
        if (p.F_Code === 2) newSelected.delete(p.id);
      });
      newSelected.add(part.id);
    } else {
      // F_Code 1: Optional multiple selection toggle
      if (newSelected.has(part.id)) {
        newSelected.delete(part.id);
      } else {
        newSelected.add(part.id);
      }
    }
    onSelectionChange(newSelected);
  }, [selectedIds, groupedParts, onSelectionChange]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-30">
        <div className="flex flex-wrap justify-between items-center gap-6">
          <div className="flex-1 min-w-[300px]">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <CheckSquare className="text-indigo-600" />
              Engineering Selector
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 ${validation.isValid ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                  style={{ width: `${validation.progress}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{validation.progress}% Mandatory Groups Fulfilled</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search catalog..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none w-64"
              />
            </div>
            <button 
              onClick={onGenerate} 
              disabled={!validation.isValid} 
              className={`px-8 py-3 rounded-xl flex items-center gap-2 font-black transition-all shadow-lg text-xs uppercase tracking-widest ${
                validation.isValid 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <ShieldCheck size={18} /> Finalize Configuration
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10 space-y-12 max-w-7xl mx-auto w-full">
        {!validation.isValid && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="text-amber-500" size={20} />
            <div className="text-xs">
              <span className="font-black text-amber-800 uppercase tracking-widest">Pending Selection:</span>
              <span className="ml-2 text-amber-700 font-medium">Please select mandatory components for: <span className="font-bold">{validation.missing.join(', ')}</span></span>
            </div>
          </div>
        )}

        {groupedParts.map(([group, items]) => {
          // Requirement: Each Ref_des group header should show the Name of selected item
          const selectedInGroup = items.find(p => selectedIds.has(p.id) && p.F_Code === 2);
          
          return (
            <div key={group} className="space-y-6">
              <div className="flex items-center gap-4 bg-white/50 p-2 rounded-xl border border-slate-100 backdrop-blur-sm">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                  <Hash size={16} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">
                    {group}
                  </h3>
                  {selectedInGroup && (
                    <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5 animate-in fade-in slide-in-from-left-2">
                      <div className="w-1 h-1 bg-indigo-600 rounded-full"></div>
                      Current Selection: {selectedInGroup.Name}
                    </div>
                  )}
                </div>
                <div className="h-px bg-slate-200 flex-[0.5]"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(part => {
                  const isSelected = selectedIds.has(part.id);
                  const isSystemSelected = systemRecommendedIds.has(part.id);
                  const isF2 = part.F_Code === 2;

                  return (
                    <button
                      key={part.id}
                      onClick={() => toggleSelection(part)}
                      className={`group relative flex flex-col text-left p-6 rounded-[2rem] border-2 transition-all duration-300 transform active:scale-[0.98] ${
                        isSelected 
                          ? isF2 
                            ? 'border-indigo-600 bg-white shadow-2xl ring-8 ring-indigo-50/50' 
                            : 'border-emerald-600 bg-white shadow-2xl ring-8 ring-emerald-50/50'
                          : 'border-white bg-white shadow-sm hover:border-slate-200 hover:shadow-xl'
                      } ${isSystemSelected && isSelected ? 'bg-indigo-50/30' : ''}`}
                    >
                      {/* System Recommendation Highlight */}
                      {isSystemSelected && (
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5 z-10 border border-white/20">
                          <Sparkles size={10} className="animate-pulse" /> Recommended
                        </div>
                      )}

                      {/* Type Label */}
                      <div className="absolute top-6 right-6">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                          isF2 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {isF2 ? 'Radio' : 'Checkbox'}
                        </span>
                      </div>

                      {/* Requirement: Show Part_Number, Name, Std_Remarks, Remarks */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">
                            {part.Part_Number}
                          </span>
                          <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${isSelected ? (isF2 ? 'bg-indigo-600 w-16' : 'bg-emerald-600 w-16') : 'bg-slate-100'}`}></div>
                        </div>
                        
                        {/* Status Icon */}
                        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                          isSelected 
                            ? isF2 ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-100'
                            : 'border-slate-100 group-hover:border-slate-300'
                        }`}>
                          {isSelected ? (
                            isF2 ? <div className="w-3 h-3 rounded-full bg-white scale-110 transition-transform"></div> : <FileCheck size={18} className="text-white" />
                          ) : (
                            isF2 ? <Circle size={14} className="text-slate-200" /> : <Square size={14} className="text-slate-200" />
                          )}
                        </div>
                      </div>

                      <p className={`text-base font-black leading-tight mb-4 min-h-[2.5rem] line-clamp-2 transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {part.Name}
                      </p>
                      
                      <div className="mt-auto space-y-4">
                        {/* Remarks Section */}
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block">Assembly Specs</span>
                          <p className={`text-[11px] font-medium italic leading-relaxed line-clamp-2 ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                            {part.Remarks || 'Standard engineering unit.'}
                          </p>
                        </div>

                        {/* Standard Remarks Label */}
                        {part.Std_Remarks && (
                          <div className={`flex items-center gap-2 text-[9px] px-3 py-1.5 rounded-xl font-black border w-fit transition-all ${
                            isSelected 
                              ? isF2 ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-slate-500 bg-slate-50 border-slate-100 group-hover:bg-slate-100'
                          }`}>
                            <Zap size={10} className={isSelected ? 'fill-current' : ''} />
                            {part.Std_Remarks.toUpperCase()}
                          </div>
                        )}

                        {/* System Highlight Visual */}
                        {isSystemSelected && isSelected && (
                          <div className="pt-3 border-t border-slate-100 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
                            <Settings2 size={12} className="text-indigo-600" />
                            <span className="text-[9px] font-black text-indigo-700 uppercase tracking-tighter">Logic-Driven Selection</span>
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

      <div className="p-6 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        <div className="flex gap-8">
          <span className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 border-2 border-indigo-600 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div></div> 
            F2 Mandatory (Single)
          </span>
          <span className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 rounded flex items-center justify-center"><FileCheck size={10} className="text-emerald-600" /></div> 
            F1 Optional (Multiple)
          </span>
          <span className="flex items-center gap-3 text-indigo-600">
            <Sparkles size={14} className="animate-pulse" /> Logic Recommended
          </span>
        </div>
        <div className="bg-slate-900 px-6 py-2.5 rounded-full text-white shadow-lg">
          ACTIVE BOM PARTS: <span className="text-indigo-400 ml-1">{selectedIds.size + parts.filter(p => p.F_Code === 0).length}</span>
        </div>
      </div>
    </div>
  );
};

export default SelectionScreen;
