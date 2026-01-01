
import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MachineKnowledge, LearningEntry, BOMPart, ConfigRule, ConfidenceLevel, TechnicalGlossary } from '../types';
import { 
  GraduationCap, 
  Upload, 
  Play, 
  Loader2, 
  FileText, 
  Download, 
  BrainCircuit, 
  History,
  Trash2,
  Zap,
  ShieldCheck,
  Database,
  RefreshCw,
  Plus,
  BookOpenCheck,
  Layers,
  FileJson,
  Check
} from 'lucide-react';

interface ExcelRow {
  Part_Number?: string | number;
  Name?: string;
  Remarks?: string;
  Std_Remarks?: string;
  Ref_des?: string;
  F_Code?: string | number;
  [key: string]: any;
}

interface NeuralWeights {
  modelName: string;
  knowledgeBase: MachineKnowledge;
  timestamp: string;
  type: string;
}

interface Props {
  knowledgeBase: MachineKnowledge;
  onKnowledgeBaseUpdate: (kb: MachineKnowledge) => void;
  apiKey: string;
  parts: BOMPart[];
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  glossary: TechnicalGlossary;
}

interface ExtractionMatch {
  id: string;
  category: string;
  selection: string;
  suggestedPart?: BOMPart;
  manualPartNumber?: string;
  status: 'Matched' | 'Unmatched' | 'Conflict';
  confidence: number;
  level: ConfidenceLevel;
  source: 'Learned' | 'Baseline' | 'AI' | 'None';
}

const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'UNIT', 'OPTIONS']);

const NeuralAcademy: React.FC<Props> = ({ knowledgeBase, onKnowledgeBaseUpdate, apiKey, parts, rules, onRulesUpdate, glossary }) => {
  const [moFiles, setMoFiles] = useState<File[]>([]);
  const [targetBom, setTargetBom] = useState<ExcelRow[] | null>(null);
  const [baselineKnowledge, setBaselineKnowledge] = useState<MachineKnowledge | null>(null);
  const [useExistingBOM, setUseExistingBOM] = useState(true);
  const [machineModel, setMachineModel] = useState('');
  const [pageRange, setPageRange] = useState('1'); 
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'warn'}[]>([]);
  const [pendingMatches, setPendingMatches] = useState<ExtractionMatch[]>([]);
  
  const excelInputRef = useRef<HTMLInputElement>(null);
  const baselineInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => 
    setTrainingLog(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev]);

  const partIndex = useMemo(() => {
    const sourceParts = useExistingBOM ? parts : (targetBom || []);
    return (sourceParts as any[]).map(p => {
      const pName = String(p.Name || '').toUpperCase();
      const pRemarks = String(p.Remarks || '').toUpperCase();
      const pStd = String(p.Std_Remarks || '').toUpperCase();
      const pRef = String(p.Ref_des || '').toUpperCase();
      let technicalSource = `${pName} ${pRemarks} ${pStd} ${pRef}`;
      
      // Fix for Error in file components/NeuralAcademy.tsx on line 94: Property 'toUpperCase' does not exist on type 'unknown'.
      (Object.entries(glossary) as [string, string][]).forEach(([abbr, full]) => {
        if (technicalSource.includes(abbr.toUpperCase())) technicalSource += ` ${full.toUpperCase()}`;
      });

      return {
        part: (p.id ? p : { ...p, id: `temp-acad-${Math.random()}`, Part_Number: String(p.Part_Number || '') }) as BOMPart,
        tokens: new Set(technicalSource.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
        pn: String(p.Part_Number || '').toUpperCase(),
        ref: pRef
      };
    });
  }, [parts, targetBom, useExistingBOM, glossary]);

  const handleBaselineUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        setBaselineKnowledge(json.knowledgeBase || json);
        addLog(`Intelligence teacher loaded successfully.`, 'success');
      } catch (err) {
        addLog(`Error parsing baseline weights.`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = (window as any).XLSX;
        if (!XLSX) throw new Error("Excel Library not loaded");
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];
        setTargetBom(data);
        addLog(`Technical Reference [${data.length} items] mapped.`, 'success');
      } catch (err) {
        addLog(`Excel load failed.`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const startTraining = async () => {
    const effectiveApiKey = apiKey || process.env.API_KEY;
    const groundTruth = useExistingBOM ? parts : targetBom;

    if (!effectiveApiKey || moFiles.length === 0 || !groundTruth || !machineModel) {
      alert("Missing configuration: Model Name, MO Files, and Reference BOM are required.");
      return;
    }

    setIsTraining(true);
    setTrainingLog([]);
    setPendingMatches([]);
    addLog(`Neural Engine Initiated: Profile [${machineModel}]`, 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const currentMatches: ExtractionMatch[] = [];

      for (const file of moFiles) {
        addLog(`Scanning document: ${file.name}...`, 'info');
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const prompt = `
          ACT AS A SENIOR CONFIGURATION ENGINEER.
          STRICTLY SCAN PAGES: ${pageRange}. 
          EXTRACT ALL CONFIGURATION OPTIONS.
          JSON SCHEMA: {"options": [{"category": "string", "selection": "string"}]}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.type, data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const extracted = JSON.parse(response.text || '{"options": []}');
        const options = extracted.options || [];
        
        options.forEach((opt: any, idx: number) => {
          const normCat = String(opt.category || 'GENERAL').trim().toUpperCase();
          const normSel = String(opt.selection || 'UNDEFINED').trim().toUpperCase();
          const queryRaw = `${normCat} ${normSel}`;
          
          let queryTokens = queryRaw.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s));
          // Fix for Error in file components/NeuralAcademy.tsx on line 197: Property 'toUpperCase' does not exist on type 'unknown'.
          (Object.entries(glossary) as [string, string][]).forEach(([abbr, full]) => {
            if (queryRaw.includes(abbr.toUpperCase())) queryTokens.push(...full.toUpperCase().split(' '));
          });
          const queryTokenSet = new Set(queryTokens);

          let bestMatchPart: BOMPart | undefined;
          let topScore = 0;

          partIndex.forEach(ip => {
            let score = 0;
            if (queryRaw.includes(ip.pn)) score = 1.1;
            
            if (baselineKnowledge) {
              // Fix for Error in file components/NeuralAcademy.tsx on line 210: Property 'category'/'selection'/'partNumber' does not exist on type 'unknown'.
              const baselineHits = Object.values(baselineKnowledge).flat() as LearningEntry[];
              if (baselineHits.find(h => h.category.toUpperCase() === normCat && h.selection.toUpperCase() === normSel && h.partNumber.toUpperCase() === ip.pn)) score = Math.max(score, 1.05);
            }
            
            if ((knowledgeBase[machineModel] || []).some(h => h.category.toUpperCase() === normCat && h.selection.toUpperCase() === normSel && h.partNumber.toUpperCase() === ip.pn)) score = Math.max(score, 1.0);
            
            let semanticHits = 0;
            queryTokenSet.forEach(t => { if (ip.tokens.has(t)) semanticHits++; });
            const semanticScore = queryTokenSet.size > 0 ? (semanticHits / queryTokenSet.size) * 0.7 : 0;
            score = Math.max(score, semanticScore);

            if (score > topScore) { 
              topScore = score; 
              bestMatchPart = ip.part; 
            }
          });

          currentMatches.push({
            id: `acad-match-${file.name}-${idx}-${Math.random()}`,
            category: normCat,
            selection: normSel,
            suggestedPart: bestMatchPart,
            manualPartNumber: bestMatchPart?.Part_Number || '',
            status: bestMatchPart ? 'Matched' : 'Unmatched',
            confidence: Math.min(topScore, 1.0),
            level: topScore >= 0.9 ? ConfidenceLevel.AUTO_VERIFIED : (topScore >= 0.5 ? ConfidenceLevel.REVIEW_NEEDED : ConfidenceLevel.UNCERTAIN),
            source: topScore >= 1.0 ? 'Learned' : 'AI'
          });
        });
      }

      setPendingMatches(currentMatches.sort((a, b) => b.confidence - a.confidence));
      addLog(`Academy Extraction Finished. ${currentMatches.length} patterns identified.`, 'success');
    } catch (err: any) {
      addLog(`Training Error: ${err.message || 'Unknown failure'}`, 'error');
    } finally {
      setIsTraining(false);
    }
  };

  const commitMatches = () => {
    const newKB = { ...knowledgeBase };
    const modelKey = machineModel.trim().toUpperCase();
    if (!newKB[modelKey]) newKB[modelKey] = [];

    let count = 0;
    pendingMatches.forEach(m => {
      const finalPN = (m.manualPartNumber || m.suggestedPart?.Part_Number || '').trim().toUpperCase();
      if (finalPN) {
        const entry: LearningEntry = {
          category: m.category.trim().toUpperCase(),
          selection: m.selection.trim().toUpperCase(),
          partNumber: finalPN,
          confirmedCount: 1,
          lastUsed: new Date().toISOString()
        };
        
        const existingIdx = newKB[modelKey].findIndex(e => e.category === entry.category && e.selection === entry.selection);
        if (existingIdx !== -1) {
          newKB[modelKey][existingIdx].partNumber = entry.partNumber;
          newKB[modelKey][existingIdx].confirmedCount++;
          newKB[modelKey][existingIdx].lastUsed = entry.lastUsed;
        } else {
          newKB[modelKey].push(entry);
        }
        count++;
      }
    });

    onKnowledgeBaseUpdate(newKB);
    setPendingMatches([]);
    addLog(`Intelligence Committed: ${count} nodes synced to [${modelKey}].`, 'success');
  };

  const promoteToRule = (match: ExtractionMatch) => {
    const finalPN = (match.manualPartNumber || match.suggestedPart?.Part_Number || '').trim().toUpperCase();
    if (!finalPN) return;

    const part = parts.find(p => p.Part_Number.toUpperCase() === finalPN);
    if (!part) {
      alert("Part number not found in main database. Manual creation required.");
      return;
    }

    const newRule: ConfigRule = {
      id: `rule-acad-${Date.now()}`,
      targetPartId: part.id,
      logic: {
        includes: [match.category.toUpperCase(), match.selection.toUpperCase()],
        excludes: [],
        orGroups: [],
        raw: `${match.category} ${match.selection}`.toUpperCase()
      },
      isActive: true
    };
    onRulesUpdate([...rules.filter(r => r.targetPartId !== part.id), newRule]);
    addLog(`Rule Promotion: Permanent dependency logic saved for ${finalPN}.`, 'success');
  };

  const exportPortableModel = (model: string) => {
    const data: NeuralWeights = {
      modelName: model,
      knowledgeBase: { [model]: knowledgeBase[model] },
      timestamp: new Date().toISOString(),
      type: "NEURAL_WEIGHTS"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Neural_Weights_${model}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Exported portable weights for [${model}].`, 'info');
  };

  const stats = useMemo(() => {
    const modelsCount = Object.keys(knowledgeBase).length;
    // Fix for Error in file components/NeuralAcademy.tsx on line 327: Property 'length' does not exist on type 'unknown'.
    const entriesCount = Object.values(knowledgeBase).reduce((acc, curr) => acc + (curr as LearningEntry[]).length, 0);
    return { models: modelsCount, entries: entriesCount };
  }, [knowledgeBase]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b border-slate-200 bg-white shadow-sm flex flex-wrap justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-200">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Neural Academy</h2>
            <div className="flex items-center gap-4 mt-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 Active Intelligence Models: {stats.models}
               </span>
               <span className="text-slate-200">|</span>
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Learned Nodes: {stats.entries}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Knowledge Density</p>
          <p className="text-2xl font-black text-indigo-600">{(stats.entries / (parts.length || 1) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b pb-4">
              <Zap size={14} className="text-indigo-500" /> Session Configuration
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Machine Profile</label>
                <input 
                  type="text" 
                  placeholder="e.g. PC2000-11 PRODUCTION" 
                  value={machineModel}
                  onChange={e => setMachineModel(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Extraction Pages</label>
                <input 
                  type="text" 
                  value={pageRange}
                  onChange={e => setPageRange(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Baseline Weights</label>
                <div onClick={() => baselineInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer ${baselineKnowledge ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'}`}>
                  <input type="file" ref={baselineInputRef} className="hidden" accept=".json" onChange={handleBaselineUpload} />
                  <BookOpenCheck size={20} className={baselineKnowledge ? 'text-indigo-600' : 'text-slate-300'} />
                  <span className="text-[9px] font-black mt-2 text-slate-400 uppercase">{baselineKnowledge ? 'Teacher Active' : 'Load Neural Weights'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Historical Factory Orders</label>
                <div className="relative group">
                  <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center group-hover:border-indigo-300 transition-all">
                    <FileText className="text-slate-300 group-hover:text-indigo-500" size={24} />
                    <span className="text-[9px] font-black text-slate-400 mt-2 uppercase">
                      {moFiles.length > 0 ? `${moFiles.length} Selected` : 'Upload MO Documents'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Sync With Live DB</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Cross-ref against repository</p>
                 </div>
                 <button onClick={() => setUseExistingBOM(!useExistingBOM)} className={`w-12 h-6 rounded-full transition-all relative ${useExistingBOM ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useExistingBOM ? 'left-7' : 'left-1'}`}></div>
                 </button>
              </div>

              {!useExistingBOM && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target BOM Source</label>
                  <div onClick={() => excelInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer ${targetBom ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'}`}>
                    <input type="file" ref={excelInputRef} className="hidden" onChange={handleExcelUpload} />
                    <Database size={20} className={targetBom ? 'text-emerald-500' : 'text-slate-300'} />
                    <span className="text-[9px] font-black mt-2 text-slate-400 uppercase">{targetBom ? 'Reference Loaded' : 'Upload BOM Excel'}</span>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={startTraining}
              disabled={isTraining}
              className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                isTraining ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isTraining ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {isTraining ? 'Scanning Intelligence...' : 'Initialize Training'}
            </button>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white h-64 shadow-2xl overflow-hidden flex flex-col">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Live Intelligence Stream</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-500 hover:text-white transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-3 pr-2 custom-scrollbar">
                {trainingLog.length === 0 ? (
                  <p className="text-slate-600 italic">SYSTEM IDLE</p>
                ) : trainingLog.map((log, i) => (
                  <div key={i} className={`flex gap-3 leading-relaxed ${
                    log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    <span className="opacity-40">>></span>
                    <span>{log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
           {pendingMatches.length > 0 ? (
             <div className="bg-white rounded-[2.5rem] border-2 border-indigo-100 p-8 shadow-2xl animate-in slide-in-from-right-4">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Review Extraction Nodes</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Manual overrides persist as Ground Truth in the brain.</p>
                   </div>
                   <div className="flex gap-4">
                      <button onClick={() => setPendingMatches([])} className="px-6 py-3 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-xl">Discard</button>
                      <button onClick={commitMatches} className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-black uppercase rounded-xl shadow-lg transition-all flex items-center gap-2">
                         <RefreshCw size={14} /> Commit Patterns
                      </button>
                   </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                         <tr>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Order Specification</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Neural Part Number Link</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {pendingMatches.map((match, idx) => (
                            <tr key={match.id} className="hover:bg-slate-50/50 group">
                               <td className="px-6 py-4">
                                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-0.5">{match.category}</p>
                                  <p className="text-xs font-bold text-slate-800">{match.selection}</p>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex flex-col gap-2">
                                     <input 
                                       type="text" 
                                       value={match.manualPartNumber} 
                                       onChange={(e) => {
                                          const next = [...pendingMatches];
                                          next[idx].manualPartNumber = e.target.value.toUpperCase();
                                          setPendingMatches(next);
                                       }}
                                       className={`w-full bg-slate-50 border-2 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none focus:bg-white transition-all ${
                                          match.status === 'Matched' ? 'border-slate-100 focus:border-indigo-400' : 'border-amber-100 focus:border-amber-400'
                                       }`}
                                     />
                                     {match.suggestedPart && (
                                       <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[200px] flex items-center gap-1">
                                          <Check size={10} className="text-emerald-500" /> {match.suggestedPart.Name}
                                       </span>
                                     )}
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-center">
                                  <button onClick={() => promoteToRule(match)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                                     <Plus size={16} />
                                  </button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm h-full min-h-[500px]">
                <div className="flex justify-between items-center mb-10">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <BrainCircuit size={14} /> Mastered Intelligence Models
                   </h3>
                </div>

                {stats.models === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-30 py-40">
                     <History size={80} className="mb-6" />
                     <p className="text-xs font-black uppercase tracking-[0.4em]">Intelligence reservoir empty</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(knowledgeBase).map(model => (
                      <div key={model} className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 hover:border-indigo-300 transition-all group">
                         <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600 border border-slate-100">
                               <Database size={20} />
                            </div>
                            <div className="flex gap-2">
                               <button onClick={() => exportPortableModel(model)} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all hover:shadow-lg" title="Portable Weights"><FileJson size={16} /></button>
                               <button onClick={() => {
                                 const entries = knowledgeBase[model];
                                 const XLSX = (window as any).XLSX;
                                 if (!XLSX) return;
                                 const ws = XLSX.utils.json_to_sheet(entries);
                                 const wb = XLSX.utils.book_new();
                                 XLSX.utils.book_append_sheet(wb, ws, "Neural Data");
                                 XLSX.writeFile(wb, `Neural_Weights_${model}.xlsx`);
                               }} className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-emerald-600 transition-all hover:shadow-lg" title="Excel Export"><Download size={16} /></button>
                               <button 
                                 onClick={() => {
                                   if (confirm(`Wipe memory for model [${model}]?`)) {
                                      const next = { ...knowledgeBase };
                                      delete next[model];
                                      onKnowledgeBaseUpdate(next);
                                   }
                                 }}
                                 className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-red-500 transition-all"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                         </div>
                         <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">{model}</h4>
                         <div className="flex items-center justify-between mt-8">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mastery</span>
                               <span className="text-lg font-black text-indigo-600">{(knowledgeBase[model] as LearningEntry[]).length} Connections</span>
                            </div>
                            <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                               <ShieldCheck size={14} /> Ready
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default NeuralAcademy;
