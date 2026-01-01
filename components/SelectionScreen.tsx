
import React, { useMemo, useCallback, useState } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { 
  CheckSquare, 
  Hash, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Search, 
  AlertTriangle, 
  UserCheck, 
  Sparkles,
  Check,
  SortAsc,
  Filter,
  Zap
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
  const [sortByFCode, setSortByFCode] = useState(false);

  // Updated to include F_Code 9 (Reference parts that now act as optional selections)
  const configParts = useMemo(() => parts.filter(p => p.F_Code === 1 || p.F_Code === 2 || p.F_Code === 9), [parts]);

  // High Performance Logic Solver
  const logicSelectedIds = useMemo(() => {
    const currentLogicSelected = new Set<string>();
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    const tokenize = (p: BOMPart) => 
      new Set(`${p.Part_Number} ${p.Name} ${p.Remarks} ${p.Std_Remarks}`.toUpperCase().split(/[\s,._+/()\[\]]+/).filter(s => s.length > 0));

    const baseTokens = new Set<string>();
    parts.filter(p => p.F_Code === 0).forEach(p => tokenize(p).forEach(t => baseTokens.add(t)));

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      const currentContextTokens = new Set(baseTokens);
      parts.filter(p => selectedIds.has(p.id) || currentLogicSelected.has(p.id))
           .forEach(p => tokenize(p).forEach(t => currentContextTokens.add(t)));

      for (const rule of rules) {
        if (!rule.isActive || selectedIds.has(rule.targetPartId) || currentLogicSelected.has(rule.targetPartId)) continue;

        const part = parts.find(p => p.id === rule.targetPartId);
        if (!part) continue;

        if (part.F_Code === 2) {
           const groupAlreadyChosen = parts.some(p => p.Ref_des === part.Ref_des && (selectedIds.has(p.id) || currentLogicSelected.has(p.id)));
           if (groupAlreadyChosen) continue;
        }

        const { includes, excludes, orGroups } = rule.logic;
        const allIn = includes.every(kw => currentContextTokens.has(kw.toUpperCase()));
        if (!allIn) continue;

        const anyEx = excludes.some(kw => currentContextTokens.has(kw.toUpperCase()));
        if (anyEx) continue;

        const orMet = orGroups.every(g => g.some(kw => currentContextTokens.has(kw.toUpperCase())));
        if (!orMet) continue;

        currentLogicSelected.add(rule.targetPartId);
        changed = true;
      }
    }
    return currentLogicSelected;
  }, [selectedIds, parts, rules]);

  const groupedParts = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    const lowerQ = searchTerm.toLowerCase();

    configParts.forEach(p => {
      if (lowerQ && !p.Part_Number.toLowerCase().includes(lowerQ) && !p.Name.toLowerCase().includes(lowerQ) && !p.Ref_des.toLowerCase().includes(lowerQ)) return;
      const key = p.Ref_des || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const entries = Object.entries(groups);

    if (sortByFCode) {
      return entries.sort((a, b) => {
        const fA = a[1][0].F_Code;
        const fB = b[1][0].F_Code;
        return fB - fA; 
      });
    }

    return entries.sort((a, b) => {
      const minA = Math.min(...a[1].map(p => p.Select_pref || 9999));
      const minB = Math.min(...b[1].map(p => p.Select_pref || 9999));
      return minA - minB;
    });
  }, [configParts, searchTerm, sortByFCode]);

  const validation = useMemo(() => {
    let missingF2 = 0;
    let pendingConfirmation = 0;
    let totalF2Groups = 0;

    groupedParts.forEach(([_, items]) => {
      const isF2 = items.some(p => p.F_Code === 2);
      if (isF2) totalF2Groups++;

      const hasUser = items.some(p => selectedIds.has(p.id));
      const hasLogic = items.some(p => logicSelectedIds.has(p.id));

      if (isF2 && !hasUser) missingF2++;
      if (hasLogic && !hasUser) pendingConfirmation++;
    });

    const progress = totalF2Groups > 0 ? Math.round(((totalF2Groups - missingF2) / totalF2Groups) * 100) : 100;
    const isValid = missingF2 === 0 && pendingConfirmation === 0;

    return { isValid, progress, pendingConfirmation };
  }, [groupedParts, selectedIds, logicSelectedIds]);

  const toggleSelection = useCallback((part: BOMPart) => {
    const next = new Set(selectedIds);
    if (next.has(part.id)) {
      next.delete(part.id);
    } else {
      if (part.F_Code === 2) {
        const group = groupedParts.find(([k]) => k === part.Ref_des)?.[1] || [];
        group.forEach(p => next.delete(p.id));
      }
      next.add(part.id);
    }
    onSelectionChange(next);
  }, [selectedIds, groupedParts, onSelectionChange]);

  const handleProceedWithSuggestion = () => {
    const combined = new Set([...selectedIds, ...logicSelectedIds]);
    onSelectionChange(combined);
    // Use setTimeout to allow the set to propagate to parent state before generating
    setTimeout(() => {
      onGenerate();
    }, 100);
  };

  const getFCodeStyle = (fcode: number) => {
    switch (fcode) {
      case 1: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 2: return 'bg-amber-50 text-amber-700 border-amber-200';
      case 0: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 9: return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-6 max-w-[1400px] mx-auto w-full">
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                <CheckSquare size={20} />
              </div>
              Engineering Selection Catalog
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 ${validation.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  style={{ width: `${validation.progress}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {validation.progress}% Validated
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleProceedWithSuggestion}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            >
              <Zap size={14} className="fill-indigo-600" /> Proceed with Suggestion
            </button>
            <button 
              onClick={() => setSortByFCode(!sortByFCode)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                sortByFCode ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
              }`}
            >
              <SortAsc size={14} /> Sort by F-Code
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Find components..." 
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
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <ShieldCheck size={16} /> Finalize BOM
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">
        {groupedParts.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-300">
             <Search size={48} className="opacity-20 mb-4" />
             <p className="text-xs font-black uppercase tracking-widest">No matching items found in database</p>
          </div>
        ) : groupedParts.map(([group, items]) => {
          const isExpanded = expandedGroups.has(group) || searchTerm.length > 0;
          const userHasPick = items.some(p => selectedIds.has(p.id));
          const logicHasPick = items.some(p => logicSelectedIds.has(p.id));
          const primaryFCode = items[0].F_Code;

          return (
            <div key={group} className={`border rounded-[2rem] overflow-hidden transition-all bg-white shadow-sm ${
              userHasPick ? 'border-emerald-500 ring-4 ring-emerald-500/5' : 
              logicHasPick ? 'border-amber-500 ring-4 ring-amber-500/5' : 'border-slate-200'
            }`}>
              <button 
                onClick={() => {
                  const next = new Set(expandedGroups);
                  if (next.has(group)) next.delete(group);
                  else next.add(group);
                  setExpandedGroups(next);
                }} 
                className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className={`p-3 rounded-xl ${userHasPick ? 'bg-emerald-600 text-white shadow-emerald-200' : logicHasPick ? 'bg-amber-600 text-white shadow-amber-200' : 'bg-slate-100 text-slate-400'} shadow-md`}>
                    <Hash size={20} />
                  </div>
                  <div className="text-left flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-widest ${getFCodeStyle(primaryFCode)}`}>
                        CODE {primaryFCode}
                      </span>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                        {group}
                      </h3>
                    </div>
                    <span className="hidden sm:inline text-slate-300">|</span> 
                    <span className="font-bold text-slate-600 text-sm">{items[0].Name}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {isExpanded && (
                <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-1 duration-200">
                  {items.map(part => {
                    const isSelected = selectedIds.has(part.id);
                    const isRecommended = logicSelectedIds.has(part.id);
                    return (
                      <button
                        key={part.id}
                        onClick={() => toggleSelection(part)}
                        className={`flex flex-col text-left p-6 rounded-[2rem] border-2 transition-all group/card ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/20 shadow-lg scale-[1.02]' : 
                          isRecommended ? 'border-amber-400 bg-amber-50/20' : 'border-slate-100 hover:border-indigo-200 bg-slate-50/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black font-mono text-slate-400">{part.Part_Number}</span>
                            <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black border uppercase tracking-tighter w-fit ${getFCodeStyle(part.F_Code)}`}>
                              F-{part.F_Code}
                            </span>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 
                            isRecommended ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'border-slate-200 group-hover/card:border-indigo-400'
                          }`}>
                            {(isSelected || isRecommended) && <Check size={12} strokeWidth={4} />}
                          </div>
                        </div>
                        <p className="text-xs font-black text-slate-800 leading-tight mb-2 uppercase tracking-tight">{part.Name}</p>
                        <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed line-clamp-2">{part.Remarks}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionScreen;
