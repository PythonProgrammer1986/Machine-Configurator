
import React, { useMemo, useCallback, useState } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { 
  CheckSquare, 
  Circle, 
  Square,
  ShieldCheck, 
  Sparkles,
  Search,
  Hash,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserCheck
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filter parts for configuration (F1/F2)
  const configParts = useMemo(() => parts.filter(p => p.F_Code === 1 || p.F_Code === 2), [parts]);

  // Iterative Logic Solver (Fix-point iteration)
  const logicSelectedIds = useMemo(() => {
    let currentLogicSelected = new Set<string>();
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 10; // Safety break

    // Pre-calculate which parts are user-selected to speed up loops
    const userSelectedParts = parts.filter(p => selectedIds.has(p.id));
    const defaultParts = parts.filter(p => p.F_Code === 0);

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      // Build context from Defaults + User Picks + current Logic Picks
      const activeContextParts = [
        ...defaultParts,
        ...userSelectedParts,
        ...parts.filter(p => currentLogicSelected.has(p.id))
      ];

      // Aggregate all metadata + the logic keywords of selected parts to allow propagation
      const contextStrings = activeContextParts.map(p => {
        const rule = rules.find(r => r.targetPartId === p.id);
        return `${p.Part_Number} ${p.Name} ${p.Remarks} ${p.Std_Remarks} ${rule?.logic.raw || ''}`.toUpperCase();
      });
      const globalMetadata = ` ${contextStrings.join(' ')} `;

      for (const rule of rules) {
        if (!rule.isActive) continue;
        if (selectedIds.has(rule.targetPartId) || currentLogicSelected.has(rule.targetPartId)) continue;

        const part = parts.find(p => p.id === rule.targetPartId);
        if (!part) continue;

        // F2 Constraint: If this is an F2 part, don't logic-select it if the group already has a user pick
        if (part.F_Code === 2 && userSelectedParts.some(up => up.Ref_des === part.Ref_des)) continue;
        // F2 Constraint: Don't logic-select if another part in this F2 group is already logic-selected
        if (part.F_Code === 2 && Array.from(currentLogicSelected).some(lsId => parts.find(p => p.id === lsId)?.Ref_des === part.Ref_des)) continue;

        const { includes, excludes, orGroups } = rule.logic;
        if (includes.length === 0 && orGroups.length === 0) continue;

        // Use Regex for strict word boundary matching to avoid partial matches (CAB vs CABINET)
        const checkMatch = (kw: string) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(globalMetadata);

        const allIncludesMet = includes.every(kw => checkMatch(kw));
        const anyExcludesMet = excludes.some(kw => checkMatch(kw));
        const allOrGroupsMet = orGroups.every(group => group.some(kw => checkMatch(kw)));

        if (allIncludesMet && !anyExcludesMet && allOrGroupsMet) {
          currentLogicSelected.add(rule.targetPartId);
          changed = true;
        }
      }
    }

    return currentLogicSelected;
  }, [selectedIds, parts, rules]);

  const groupedParts = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    configParts.filter(p => {
      const q = searchTerm.toLowerCase();
      return p.Part_Number.toLowerCase().includes(q) || p.Name.toLowerCase().includes(q) || p.Remarks.toLowerCase().includes(q);
    }).forEach(p => {
      const key = p.Ref_des || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    Object.keys(groups).forEach(key => groups[key].sort((a, b) => (a.Select_pref || 999999) - (b.Select_pref || 999999)));
    return Object.entries(groups).sort((a, b) => {
      const minA = Math.min(...a[1].map(p => p.Select_pref || 999999));
      const minB = Math.min(...b[1].map(p => p.Select_pref || 999999));
      return minA - minB;
    });
  }, [configParts, searchTerm]);

  const validation = useMemo(() => {
    const missingMandatory: string[] = [];
    groupedParts.forEach(([group, items]) => {
      if (items.some(p => p.F_Code === 2) && !items.some(p => selectedIds.has(p.id) || logicSelectedIds.has(p.id))) {
        missingMandatory.push(group);
      }
    });
    const totalF2 = groupedParts.filter(([_, items]) => items.some(p => p.F_Code === 2)).length;
    const progress = totalF2 > 0 ? Math.round(((totalF2 - missingMandatory.length) / totalF2) * 100) : 100;
    return { isValid: missingMandatory.length === 0, missingMandatory, progress };
  }, [groupedParts, selectedIds, logicSelectedIds]);

  const toggleSelection = useCallback((part: BOMPart) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(part.id)) {
      nextSelected.delete(part.id);
    } else {
      if (part.F_Code === 2) {
        const groupItems = groupedParts.find(([k]) => k === part.Ref_des)?.[1] || [];
        groupItems.forEach(p => nextSelected.delete(p.id));
      }
      nextSelected.add(part.id);
    }
    onSelectionChange(nextSelected);
  }, [selectedIds, groupedParts, onSelectionChange]);

  const toggleGroup = (group: string) => {
    const next = new Set(expandedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setExpandedGroups(next);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-6 max-w-[1600px] mx-auto w-full">
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                <CheckSquare size={20} />
              </div>
              BOM Selection Catalog
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-700 ${validation.isValid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} 
                  style={{ width: `${validation.progress}%` }}
                ></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${validation.isValid ? 'text-emerald-600' : 'text-red-500'}`}>
                {validation.progress}% Mandatory Satisfied
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Search catalog..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 focus:bg-white outline-none w-64 transition-all"
              />
            </div>
            <button 
              onClick={onGenerate} 
              disabled={!validation.isValid} 
              className={`px-6 py-2.5 rounded-xl flex items-center gap-2 font-black transition-all text-[10px] uppercase tracking-widest shadow-lg ${
                validation.isValid 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <ShieldCheck size={16} /> Finalize BOM
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        {groupedParts.map(([group, items]) => {
          const isExpanded = expandedGroups.has(group) || searchTerm.length > 0;
          const isF2Group = items.some(p => p.F_Code === 2);
          const userSelectedInGroup = items.find(p => selectedIds.has(p.id));
          const logicSelectedInGroup = items.find(p => logicSelectedIds.has(p.id));
          
          const statusColor = userSelectedInGroup 
            ? 'border-emerald-500 bg-emerald-50/20' 
            : logicSelectedInGroup 
              ? 'border-blue-500 bg-blue-50/20' 
              : isF2Group 
                ? 'border-red-500 bg-red-50/20 animate-pulse' 
                : 'border-slate-200 bg-white';

          const iconColor = userSelectedInGroup 
            ? 'bg-emerald-600 text-white' 
            : logicSelectedInGroup 
              ? 'bg-blue-600 text-white' 
              : isF2Group 
                ? 'bg-red-600 text-white' 
                : 'bg-slate-100 text-slate-400';

          return (
            <div key={group} className={`border rounded-[2rem] overflow-hidden transition-all shadow-sm ${statusColor}`}>
              <button onClick={() => toggleGroup(group)} className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/40 transition-colors">
                <div className="flex items-center gap-6">
                  <div className={`p-3 rounded-xl shadow-sm ${iconColor}`}>
                    <Hash size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.15em] flex items-center gap-2">
                      {group} <span className="text-slate-300">|</span> 
                      <span className="normal-case font-bold text-slate-600 text-sm">{items[0]?.Name}</span>
                    </h3>
                    <div className="flex gap-4 mt-1.5">
                       {userSelectedInGroup ? (
                         <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-full border border-emerald-100 shadow-sm">
                           <UserCheck size={10} /> Selection Confirmed
                         </span>
                       ) : logicSelectedInGroup ? (
                         <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-full border border-blue-100 shadow-sm">
                           <Sparkles size={10} /> Logic Propagated
                         </span>
                       ) : isF2Group ? (
                         <span className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                           <AlertTriangle size={10} /> Action Required
                         </span>
                       ) : (
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Optional Items</span>
                       )}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={24} className="text-slate-400" /> : <ChevronDown size={24} className="text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map(part => {
                    const isUser = selectedIds.has(part.id);
                    const isLogic = logicSelectedIds.has(part.id);
                    const isF2 = part.F_Code === 2;
                    
                    const isGreen = isUser;
                    const isBlue = isLogic && !isUser;
                    const isRed = isF2 && !userSelectedInGroup && !logicSelectedInGroup;

                    return (
                      <button
                        key={part.id}
                        onClick={() => toggleSelection(part)}
                        className={`flex flex-col text-left p-6 rounded-3xl border-2 transition-all duration-300 relative transform active:scale-95 group ${
                          isGreen 
                            ? 'border-emerald-500 bg-white ring-8 ring-emerald-500/10 shadow-lg scale-[1.02]' 
                            : isBlue 
                              ? 'border-blue-500 bg-white ring-8 ring-blue-500/10 shadow-lg scale-[1.02]'
                              : isRed
                                ? 'border-red-500 bg-red-50/50 hover:bg-white hover:border-red-400'
                                : 'border-transparent bg-slate-100/50 hover:bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className={`text-[10px] font-black font-mono tracking-widest ${isGreen ? 'text-emerald-600' : isBlue ? 'text-blue-600' : isRed ? 'text-red-500' : 'text-slate-400'}`}>
                            {part.Part_Number}
                          </span>
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                            isGreen ? 'bg-emerald-600 border-emerald-600 shadow-md' :
                            isBlue ? 'bg-blue-600 border-blue-600 shadow-md' :
                            isRed ? 'border-red-300' : 'border-slate-100'
                          }`}>
                            {isGreen ? <UserCheck size={14} className="text-white" /> :
                             isBlue ? <Sparkles size={14} className="text-white" /> :
                             isF2 ? <Circle size={14} className={isRed ? 'text-red-200' : 'text-slate-200'} /> :
                             <Square size={14} className="text-slate-200" />}
                          </div>
                        </div>

                        <div className="space-y-3 flex-1">
                          <p className={`text-sm font-black leading-tight ${isGreen || isBlue ? 'text-slate-900' : isRed ? 'text-red-800' : 'text-slate-700'}`}>
                            {part.Name}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 italic line-clamp-2">
                            {part.Remarks || 'Standard BOM Entry'}
                          </p>
                          {part.Std_Remarks && (
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 inline-block">
                              {part.Std_Remarks}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                           <div className={`text-[8px] font-black uppercase tracking-widest ${isF2 ? 'text-amber-600' : 'text-slate-400'}`}>
                             {isF2 ? 'F2 Mandatory' : 'F1 Optional'}
                           </div>
                           <div className="flex gap-1.5">
                              {isBlue && (
                                <div className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded-md">
                                  <Sparkles size={10} /> Dependency
                                </div>
                              )}
                              {isGreen && (
                                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  <Check size={10} /> Confirmed
                                </div>
                              )}
                           </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-6 bg-white border-t border-slate-200 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
        <div className="flex gap-10">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 bg-red-500 rounded-lg shadow-sm"></div> Required
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 bg-blue-500 rounded-lg shadow-sm"></div> Logic Suggestion
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 bg-emerald-500 rounded-lg shadow-sm"></div> User Confirm
          </div>
        </div>
        <div className="text-slate-900 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-3">
          <span className="text-slate-400">Total Configured Items:</span>
          <span className="text-indigo-600 text-lg font-mono">
             {(selectedIds.size + 
               logicSelectedIds.size + 
               parts.filter(p => p.F_Code === 0).length).toString().padStart(3, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SelectionScreen;
