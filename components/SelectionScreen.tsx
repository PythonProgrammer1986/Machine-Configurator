
import React, { useMemo, useCallback, useState } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { 
  CheckSquare, 
  AlertCircle, 
  ArrowRight, 
  FileCheck, 
  Zap, 
  Info, 
  ShieldCheck, 
  Sparkles,
  MousePointerClick
} from 'lucide-react';

interface Props {
  parts: BOMPart[];
  rules: ConfigRule[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onGenerate: () => void;
}

const SelectionScreen: React.FC<Props> = ({ parts, rules, selectedIds, onSelectionChange, onGenerate }) => {
  const [lastAutoSelected, setLastAutoSelected] = useState<Set<string>>(new Set());

  // Assembly sequence prioritization
  const sortOrder = (ref: string) => {
    const r = ref.toUpperCase();
    if (r.includes('ENGINE')) return 1;
    if (r.includes('CAB')) return 2;
    if (r.includes('CANOPY') || r.includes('CAN')) return 3;
    return 10;
  };

  // Visibility logic (Standard Rules)
  const visibleParts = useMemo(() => {
    const selectedPartsList = parts.filter(p => selectedIds.has(p.id));
    const ruleTargetPartIds = new Set(rules.map(r => r.targetPartId));

    return parts.filter(p => {
      if (p.F_Code === 0 || p.F_Code === 9) return false;

      if (ruleTargetPartIds.has(p.id)) {
        const relevantRules = rules.filter(r => r.targetPartId === p.id);
        const isTriggered = relevantRules.some(r => {
          return selectedPartsList.some(sp => {
            const spRemarks = (sp.Remarks || '').toLowerCase();
            const spStdRemarks = (sp.Std_Remarks || '').toLowerCase();
            const val = r.triggerValue.toLowerCase();
            return spRemarks.includes(val) || spStdRemarks.includes(val);
          });
        });
        return isTriggered;
      }
      return true;
    });
  }, [parts, rules, selectedIds]);

  // Intelligent Recommendation Engine
  // Scans selected parts' Remarks/Std_Remarks for matching strings in unselected parts
  const recommendations = useMemo(() => {
    const recMap = new Map<string, string>(); // partId -> matching reason
    const selectedPartsList = parts.filter(p => selectedIds.has(p.id));

    if (selectedPartsList.length === 0) return recMap;

    visibleParts.forEach(p => {
      if (selectedIds.has(p.id)) return;

      const pText = (p.Remarks + ' ' + p.Std_Remarks).toLowerCase().trim();
      if (pText.length < 3) return;

      for (const sp of selectedPartsList) {
        const spRemarks = (sp.Remarks || '').toLowerCase().trim();
        const spStdRemarks = (sp.Std_Remarks || '').toLowerCase().trim();

        // 1. Check if Selected Remarks exist in target
        if (spRemarks.length >= 4 && pText.includes(spRemarks)) {
          recMap.set(p.id, `Matches selection: "${spRemarks}"`);
          break;
        }
        // 2. Check if Selected Std_Remarks exist in target
        if (spStdRemarks.length >= 4 && pText.includes(spStdRemarks)) {
          recMap.set(p.id, `Matches tech spec: "${spStdRemarks}"`);
          break;
        }
        // 3. Reverse check: Check if target remarks exist in selected metadata
        const spFullText = (spRemarks + ' ' + spStdRemarks);
        if (p.Remarks.length >= 4 && spFullText.includes(p.Remarks.toLowerCase())) {
          recMap.set(p.id, `Compatible with ${sp.Part_Number}`);
          break;
        }
      }
    });

    return recMap;
  }, [visibleParts, selectedIds, parts]);

  // Grouping
  const groupedPartsMap = useMemo(() => {
    const groups: Record<string, { f2: BOMPart[], f1: BOMPart[] }> = {};
    visibleParts.forEach(p => {
      const key = p.Ref_des || 'Unassigned';
      if (!groups[key]) groups[key] = { f2: [], f1: [] };
      if (p.F_Code === 2) groups[key].f2.push(p);
      if (p.F_Code === 1) groups[key].f1.push(p);
    });
    return groups;
  }, [visibleParts]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedPartsMap).sort((a, b) => sortOrder(a) - sortOrder(b));
  }, [groupedPartsMap]);

  // Mandatory checks & Progress
  const validation = useMemo(() => {
    const missing: string[] = [];
    sortedGroupKeys.forEach((group) => {
      const collections = groupedPartsMap[group];
      if (collections.f2.length > 0) {
        const hasSelection = collections.f2.some(p => selectedIds.has(p.id));
        if (!hasSelection) missing.push(group);
      }
    });
    const progress = sortedGroupKeys.length > 0 
      ? Math.round(((sortedGroupKeys.length - missing.length) / sortedGroupKeys.length) * 100)
      : 0;
    return { isValid: missing.length === 0, missing, progress };
  }, [sortedGroupKeys, groupedPartsMap, selectedIds]);

  const toggleSelection = useCallback((id: string, groupKey: string, isF2: boolean) => {
    let newSelected = new Set(selectedIds);
    let autoSelectedThisTurn = new Set<string>();
    const targetPart = parts.find(p => p.id === id);
    if (!targetPart) return;
    
    // Mutex Logic
    const groupCollections = groupedPartsMap[groupKey];
    if (isF2) {
      if (groupCollections) groupCollections.f2.forEach(p => newSelected.delete(p.id));
      newSelected.add(id);
    } else {
      if (groupCollections) groupCollections.f1.forEach(p => newSelected.delete(p.id));
      if (selectedIds.has(id)) newSelected.delete(id);
      else newSelected.add(id);
    }

    // Engineering Cascades (CAB Frame)
    const isCab = (targetPart.Ref_des || '').toUpperCase().includes('CAB');
    const isFrame = (targetPart.Name + targetPart.Remarks + targetPart.Std_Remarks).toUpperCase().includes('FRAME');

    if (isCab && isFrame && !selectedIds.has(id)) {
      sortedGroupKeys.forEach(gKey => {
        if (gKey.toUpperCase().includes('CAB')) {
          const group = groupedPartsMap[gKey];
          const hasMandatorySelected = group.f2.some(p => newSelected.has(p.id));
          if (!hasMandatorySelected && group.f2.length > 0) {
            newSelected.add(group.f2[0].id);
            autoSelectedThisTurn.add(group.f2[0].id);
          }
        }
      });
    }

    // Logic Rules Cascades
    const triggerData = (targetPart.Remarks + targetPart.Std_Remarks).toLowerCase();
    rules.forEach(rule => {
      const val = rule.triggerValue.toLowerCase();
      if (triggerData.includes(val)) {
        const autoPart = parts.find(p => p.id === rule.targetPartId);
        if (autoPart) {
          if (autoPart.F_Code === 2) {
            const g = autoPart.Ref_des || 'Unassigned';
            const groupParts = groupedPartsMap[g];
            if (groupParts) groupParts.f2.forEach(p => newSelected.delete(p.id));
          }
          newSelected.add(autoPart.id);
          autoSelectedThisTurn.add(autoPart.id);
        }
      }
    });

    setLastAutoSelected(autoSelectedThisTurn);
    onSelectionChange(newSelected);
  }, [selectedIds, parts, rules, groupedPartsMap, sortedGroupKeys, onSelectionChange]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white shadow-sm z-20">
        <div className="flex flex-wrap justify-between items-center gap-6">
          <div className="flex-1 min-w-[300px]">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <CheckSquare className="text-indigo-600" />
              Engineering Configurator
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-700 ease-out ${validation.isValid ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${validation.progress}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black text-slate-500 w-12">{validation.progress}%</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onGenerate}
              disabled={!validation.isValid}
              className={`px-10 py-3.5 rounded-xl flex items-center gap-2 font-black transition-all shadow-lg text-sm uppercase tracking-widest ${
                validation.isValid 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 shadow-indigo-200' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {validation.isValid ? <ShieldCheck size={20} /> : <Info size={20} />}
              {validation.isValid ? 'Finalize BOM' : 'Engineering Check'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 lg:p-10">
        {/* Recommendation Intelligence Header */}
        {recommendations.size > 0 && (
          <div className="mb-10 bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row items-center justify-between gap-6 animate-in zoom-in-95 duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Sparkles size={28} className="text-white fill-white/20" />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-[0.2em]">Smart Recommendations</p>
                <p className="text-xs text-indigo-100 mt-1 font-medium">Found {recommendations.size} compatible components matching your technical specifications.</p>
              </div>
            </div>
            <div className="flex -space-x-2 overflow-hidden">
               {Array.from(recommendations.keys()).slice(0, 5).map(id => {
                 const p = parts.find(x => x.id === id);
                 return <div key={id} className="w-8 h-8 rounded-full bg-indigo-400 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold" title={p?.Name}>{p?.Name.charAt(0)}</div>
               })}
            </div>
          </div>
        )}

        {!validation.isValid && (
          <div className="mb-8 bg-white border-l-4 border-amber-500 p-5 rounded-r-xl shadow-md flex items-start gap-4">
            <AlertCircle size={24} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm uppercase tracking-wide">Incomplete Configuration</p>
              <p className="text-xs text-slate-600 mt-1">Required: <span className="font-bold text-amber-600 underline">{validation.missing.join(', ')}</span></p>
            </div>
          </div>
        )}

        <div className="space-y-12 max-w-7xl mx-auto">
          {sortedGroupKeys.map((group) => {
            const data = groupedPartsMap[group];
            return (
              <div key={group} className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="h-8 w-1.5 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-[0.15em]">
                    {group}
                  </h3>
                  <div className="h-px bg-slate-200 flex-1 group-hover:bg-indigo-200 transition-colors"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[...data.f2, ...data.f1].map(part => {
                    const isF2 = part.F_Code === 2;
                    const isSelected = selectedIds.has(part.id);
                    const isAuto = lastAutoSelected.has(part.id);
                    const recReason = recommendations.get(part.id);
                    
                    return (
                      <button
                        key={part.id}
                        onClick={() => toggleSelection(part.id, group, isF2)}
                        className={`group relative flex flex-col text-left p-6 rounded-[2rem] border-2 transition-all duration-500 ${
                          isSelected 
                            ? isF2 
                              ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50'
                              : 'border-emerald-600 bg-white shadow-2xl shadow-emerald-200 ring-8 ring-emerald-50'
                            : recReason 
                              ? 'border-indigo-300 bg-indigo-50/30 shadow-md ring-4 ring-indigo-50 animate-pulse-slow' 
                              : 'border-white bg-white shadow-sm hover:border-slate-200 hover:shadow-xl'
                        } ${isAuto && isSelected ? 'animate-pulse' : ''}`}
                      >
                        {/* Recommendation Badge */}
                        {recReason && !isSelected && (
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5 z-10 border border-white/20">
                            <Sparkles size={10} className="animate-spin-slow" />
                            Technical Match
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-6">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{part.Part_Number}</span>
                            <div className={`h-1.5 w-10 rounded-full transition-colors ${
                              isSelected ? (isF2 ? 'bg-indigo-600' : 'bg-emerald-600') : 'bg-slate-100'
                            }`}></div>
                          </div>
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                            isSelected 
                              ? isF2 ? 'bg-indigo-600 border-indigo-600' : 'bg-emerald-600 border-emerald-600'
                              : 'border-slate-100 group-hover:border-slate-300'
                          }`}>
                            {isSelected && (
                              isF2 
                                ? <div className="w-3 h-3 rounded-full bg-white scale-100 transition-transform"></div> 
                                : <FileCheck size={18} className="text-white" />
                            )}
                            {!isSelected && recReason && <MousePointerClick size={16} className="text-indigo-400" />}
                          </div>
                        </div>
                        
                        <span className={`font-bold text-lg leading-snug mb-4 h-12 line-clamp-2 transition-colors ${
                          recReason && !isSelected ? 'text-indigo-900' : 'text-slate-900'
                        }`}>
                          {part.Name}
                        </span>
                        
                        <div className="space-y-4 mt-auto">
                          {recReason && !isSelected ? (
                            <div className="p-3 bg-indigo-100/50 rounded-xl border border-indigo-200/50">
                              <p className="text-[9px] font-black text-indigo-700 uppercase tracking-tight mb-1">Recommendation Context:</p>
                              <p className="text-[10px] text-indigo-900 font-medium italic">{recReason}</p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed line-clamp-2">
                              {part.Remarks || 'Standard assembly component.'}
                            </p>
                          )}
                          
                          {part.Std_Remarks && (
                            <div className={`flex items-center gap-2 text-[10px] px-3 py-2 rounded-xl font-black border w-fit transition-colors ${
                              isSelected 
                                ? isF2 ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                : 'text-slate-500 bg-slate-50 border-slate-100'
                            }`}>
                              <Zap size={12} className={isSelected ? 'fill-current' : ''} />
                              {part.Std_Remarks.toUpperCase()}
                            </div>
                          )}
                        </div>

                        {isSelected && isAuto && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest shadow-lg">
                            SYSTEM SELECTED
                          </div>
                        )}
                        
                        <div className="absolute bottom-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity">
                          {isF2 ? <Zap size={40} /> : <FileCheck size={40} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        <div className="flex gap-8">
          <span className="flex items-center gap-3"><div className="w-3 h-3 bg-indigo-500 rounded-full ring-2 ring-indigo-100"></div> Mandatory (F2)</span>
          <span className="flex items-center gap-3"><div className="w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-emerald-100"></div> Optional (F1)</span>
          <span className="flex items-center gap-3"><div className="w-3 h-3 bg-indigo-200 rounded-full border border-indigo-300"></div> Recommended Match</span>
        </div>
        <div className="bg-slate-50 px-6 py-3 rounded-full border border-slate-200 text-slate-600">
          Assembly Items: <span className="text-indigo-600 font-black">{selectedIds.size}</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.01); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default SelectionScreen;
