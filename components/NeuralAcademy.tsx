
import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MachineKnowledge, LearningEntry, BOMPart, ConfigRule, ConfidenceLevel, TechnicalGlossary } from '../types';
import { 
  GraduationCap, 
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
      let techSource = `${pName} ${pRemarks} ${pStd} ${pRef}`;
      
      const glosEntries = Object.entries(glossary) as [string, string][];
      glosEntries.forEach(([abbr, full]) => {
        if (techSource.includes(abbr.toUpperCase())) {
          techSource += ` ${full.toUpperCase()}`;
        }
      });

      return {
        part: (p.id ? p : { ...p, id: `temp-acad-${Math.random()}`, Part_Number: String(p.Part_Number || '') }) as BOMPart,
        tokens: new Set(techSource.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
        pn: String(p.Part_Number || '').toUpperCase(),
        ref: pRef
      };
    });
  }, [parts, targetBom, useExistingBOM, glossary]);

  const stats = useMemo(() => {
    const modelKeys = Object.keys(knowledgeBase);
    let entriesCount = 0;
    modelKeys.forEach(k => {
      const entries = (knowledgeBase[k] as LearningEntry[]) || [];
      entriesCount += entries.length;
    });
    return { models: modelKeys.length, entries: entriesCount };
  }, [knowledgeBase]);

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
        addLog(`Technical Reference mapped.`, 'success');
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
      alert("Missing configuration.");
      return;
    }

    setIsTraining(true);
    setTrainingLog([]);
    setPendingMatches([]);
    addLog(`Neural Engine Initiated: [${machineModel}]`, 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const currentMatches: ExtractionMatch[] = [];

      for (const file of moFiles) {
        addLog(`Scanning: ${file.name}...`, 'info');
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const prompt = `ACT AS SENIOR CONFIGURATION ENGINEER. SCAN PAGES: ${pageRange}. EXTRACT OPTIONS. JSON SCHEMA: {"options": [{"category": "string", "selection": "string"}]}`;

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
        const options = (extracted.options || []) as {category: string, selection: string}[];
        
        options.forEach((opt, idx) => {
          const normCat = String(opt.category).toUpperCase();
          const normSel = String(opt.selection).toUpperCase();
          const queryRaw = `${normCat} ${normSel}`;
          
          let bestMatchPart: BOMPart | undefined;
          let topScore = 0;

          partIndex.forEach(ip => {
            let score = 0;
            if (queryRaw.includes(ip.pn)) score = 1.1;
            
            if (baselineKnowledge) {
              const bHits = Object.values(baselineKnowledge).flat() as LearningEntry[];
              if (bHits.find(h => h.category.toUpperCase() === normCat && h.selection.toUpperCase() === normSel && h.partNumber.toUpperCase() === ip.pn)) {
                score = Math.max(score, 1.05);
              }
            }
            
            const localHits = (knowledgeBase[machineModel] || []) as LearningEntry[];
            if (localHits.some(h => h.category.toUpperCase() === normCat && h.selection.toUpperCase() === normSel && h.partNumber.toUpperCase() === ip.pn)) {
              score = Math.max(score, 1.0);
            }
            
            if (score > topScore) { 
              topScore = score; 
              bestMatchPart = ip.part; 
            }
          });

          currentMatches.push({
            id: `acad-match-${file.name}-${idx}`,
            category: normCat,
            selection: normSel,
            suggestedPart: bestMatchPart,
            manualPartNumber: bestMatchPart?.Part_Number || '',
            status: bestMatchPart ? 'Matched' : 'Unmatched',
            confidence: topScore,
            level: topScore >= 0.9 ? ConfidenceLevel.AUTO_VERIFIED : ConfidenceLevel.REVIEW_NEEDED,
            source: topScore >= 1.0 ? 'Learned' : 'AI'
          });
        });
      }

      setPendingMatches(currentMatches.sort((a, b) => b.confidence - a.confidence));
      addLog(`Academy Extraction Finished.`, 'success');
    } catch (err: any) {
      addLog(`Training Error: ${err.message}`, 'error');
    } finally {
      setIsTraining(false);
    }
  };

  const commitMatches = () => {
    const newKB = { ...knowledgeBase };
    const modelKey = machineModel.toUpperCase();
    if (!newKB[modelKey]) newKB[modelKey] = [];

    pendingMatches.forEach(m => {
      const finalPN = (m.manualPartNumber || m.suggestedPart?.Part_Number || '').trim().toUpperCase();
      if (finalPN) {
        const entry: LearningEntry = {
          category: m.category,
          selection: m.selection,
          partNumber: finalPN,
          confirmedCount: 1,
          lastUsed: new Date().toISOString()
        };
        const modelEntries = newKB[modelKey] as LearningEntry[];
        const idx = modelEntries.findIndex(e => e.category === entry.category && e.selection === entry.selection);
        if (idx !== -1) {
          modelEntries[idx].partNumber = entry.partNumber;
          modelEntries[idx].confirmedCount++;
        } else {
          modelEntries.push(entry);
        }
      }
    });

    onKnowledgeBaseUpdate(newKB);
    setPendingMatches([]);
    addLog(`Patterns Committed to ${modelKey}.`, 'success');
  };

  /**
   * Promotes an intelligence match to a permanent engineering dependency rule.
   */
  const promoteToRule = (match: ExtractionMatch) => {
    const pn = (match.manualPartNumber || match.suggestedPart?.Part_Number || '').trim().toUpperCase();
    const part = parts.find(p => p.Part_Number.toUpperCase() === pn);
    
    if (!part) {
      addLog(`SKU ${pn} not found in repository.`, 'error');
      return;
    }

    const keywords = `${match.category} ${match.selection}`.toUpperCase();
    const newRule: ConfigRule = {
      id: `rule-acad-${Date.now()}`,
      targetPartId: part.id,
      logic: {
        includes: keywords.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s)),
        excludes: [],
        orGroups: [],
        raw: keywords
      },
      isActive: true
    };

    onRulesUpdate([...rules, newRule]);
    addLog(`Intelligence promoted to logic: ${pn}`, 'success');
  };

  /**
   * Exports a portable model file containing specific neural weights.
   */
  const exportPortableModel = (model: string) => {
    const exportData: NeuralWeights = {
      modelName: model,
      knowledgeBase: { [model]: knowledgeBase[model] },
      timestamp: new Date().toISOString(),
      type: "NEURAL_WEIGHTS"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `Weights_${model}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLog(`Weights exported for ${model}`, 'info');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b border-slate-200 bg-white flex flex-wrap justify-between items-center gap-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Neural Academy</h2>
            <div className="flex items-center gap-4 mt-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Models: {stats.models}</span>
               <span className="text-slate-200">|</span>
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Learned Nodes: {stats.entries}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Mastery Index</p>
          <p className="text-2xl font-black text-indigo-600">{(stats.entries / (parts.length || 1) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap size={14} className="text-indigo-500" /> Training Hub
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Profile Name</label>
                <input 
                  type="text" 
                  placeholder="PC2000-11" 
                  value={machineModel}
                  onChange={e => setMachineModel(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scan Documents</label>
                <div className="relative group">
                  <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center group-hover:border-indigo-300 transition-all">
                    <FileText className="text-slate-300" size={24} />
                    <span className="text-[9px] font-black text-slate-400 mt-2 uppercase">{moFiles.length > 0 ? `${moFiles.length} Selected` : 'Upload Spec'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                 <button onClick={() => setUseExistingBOM(!useExistingBOM)} className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors">
                   <div className={`w-8 h-4 rounded-full relative transition-all ${useExistingBOM ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                     <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useExistingBOM ? 'left-4.5' : 'left-0.5'}`} />
                   </div>
                   Sync With Repository
                 </button>
              </div>

              {!useExistingBOM && (
                <div className="space-y-1" onClick={() => excelInputRef.current?.click()}>
                   <input type="file" ref={excelInputRef} className="hidden" onChange={handleExcelUpload} />
                   <div className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center cursor-pointer ${targetBom ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <Database size={16} className={targetBom ? 'text-emerald-500' : 'text-slate-300'} />
                      <span className="text-[9px] font-black uppercase mt-1 text-slate-400">{targetBom ? 'BOM Linked' : 'Load Target BOM'}</span>
                   </div>
                </div>
              )}
            </div>

            <button 
              onClick={startTraining}
              disabled={isTraining}
              className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl ${isTraining ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isTraining ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {isTraining ? 'Scanning...' : 'Initialize Academy'}
            </button>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white h-64 shadow-2xl flex flex-col">
             <div className="flex justify-between items-center mb-3">
               <h3 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Intelligence Log</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-600 hover:text-white"><Trash2 size={12} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-2 pr-2 custom-scrollbar">
                {trainingLog.map((log, i) => (
                  <div key={i} className={`flex gap-2 leading-tight ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                    <span>>></span>
                    <span>{log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8">
           {pendingMatches.length > 0 ? (
             <div className="bg-white rounded-[2.5rem] border-2 border-indigo-100 p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Validation Deck</h3>
                   <div className="flex gap-3">
                      <button onClick={() => setPendingMatches([])} className="px-5 py-2.5 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-xl">Discard</button>
                      <button onClick={commitMatches} className="px-7 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-black uppercase rounded-xl shadow-lg flex items-center gap-2">
                         <RefreshCw size={12} /> Commit Nodes
                      </button>
                   </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                         <tr>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Configuration</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Neural Link</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {pendingMatches.map((match) => (
                            <tr key={match.id} className="hover:bg-slate-50/50">
                               <td className="px-6 py-4">
                                  <p className="text-[10px] font-black text-indigo-600 uppercase">{match.category}</p>
                                  <p className="text-xs font-bold text-slate-800">{match.selection}</p>
                               </td>
                               <td className="px-6 py-4">
                                  <input 
                                    type="text" 
                                    value={match.manualPartNumber} 
                                    onChange={(e) => {
                                       const next = [...pendingMatches];
                                       const idx = next.findIndex(m => m.id === match.id);
                                       if (idx !== -1) {
                                         next[idx].manualPartNumber = e.target.value.toUpperCase();
                                         setPendingMatches(next);
                                       }
                                    }}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none focus:border-indigo-400"
                                  />
                               </td>
                               <td className="px-6 py-4 text-center">
                                  <button onClick={() => promoteToRule(match)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors">
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
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-8">
                  <BrainCircuit size={14} /> Mastered Models Repository
                </h3>

                {stats.models === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-200 py-32">
                     <History size={64} className="opacity-20 mb-4" />
                     <p className="text-xs font-black uppercase tracking-widest">Neural Reservoir Empty</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(knowledgeBase).map(model => (
                      <div key={model} className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 hover:border-indigo-300 transition-all">
                         <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600 border border-slate-100"><Database size={20} /></div>
                            <div className="flex gap-2">
                               <button onClick={() => exportPortableModel(model)} className="p-2 bg-white rounded-lg text-slate-400 hover:text-indigo-600"><FileJson size={14} /></button>
                               <button 
                                 onClick={() => {
                                   if (confirm(`Wipe memory for [${model}]?`)) {
                                       const next = { ...knowledgeBase };
                                       delete next[model];
                                       onKnowledgeBaseUpdate(next);
                                   }
                                 }}
                                 className="p-2 bg-white rounded-lg text-slate-400 hover:text-red-500"
                               >
                                 <Trash2 size={14} />
                               </button>
                            </div>
                         </div>
                         <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">{model}</h4>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-600">{(knowledgeBase[model] as LearningEntry[] || []).length} Nodes</span>
                            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5">
                               <ShieldCheck size={12} /> Sync Ready
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
