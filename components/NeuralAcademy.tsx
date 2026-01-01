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
  const [machineModel, setMachineModel] = useState('');
  const [pageRange, setPageRange] = useState('1'); 
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'warn'}[]>([]);
  const [pendingMatches, setPendingMatches] = useState<ExtractionMatch[]>([]);
  
  const excelInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => 
    setTrainingLog(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev]);

  const stats = useMemo(() => {
    const keys = Object.keys(knowledgeBase);
    let count = 0;
    keys.forEach(k => { count += (knowledgeBase[k] || []).length; });
    return { models: keys.length, entries: count };
  }, [knowledgeBase]);

  const partIndex = useMemo(() => {
    const sourceParts = parts.length > 0 ? parts : (targetBom || []);
    return (sourceParts as any[]).map(p => {
      const tech = `${String(p.Name || '')} ${String(p.Remarks || '')}`.toUpperCase();
      return {
        part: (p.id ? p : { ...p, id: `temp-${Math.random()}`, Part_Number: String(p.Part_Number || '') }) as BOMPart,
        tokens: new Set(tech.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
        pn: String(p.Part_Number || '').toUpperCase()
      };
    });
  }, [parts, targetBom]);

  const startTraining = async () => {
    const key = apiKey || process.env.API_KEY;
    if (!key || moFiles.length === 0 || !machineModel) return alert("Missing Config Parameters");

    setIsTraining(true);
    setTrainingLog([]);
    addLog(`Neural Session Initiated: [${machineModel}]`, 'info');

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const matches: ExtractionMatch[] = [];

      for (const file of moFiles) {
        addLog(`Scanning document: ${file.name}`, 'info');
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: `EXTRACT CONFIG OPTIONS FROM PAGES: ${pageRange}. JSON SCHEMA: {"options": [{"category": "string", "selection": "string"}]}` },
              { inlineData: { mimeType: file.type, data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const extracted = JSON.parse(resp.text || '{"options": []}');
        (extracted.options || []).forEach((opt: any, idx: number) => {
          const normCat = String(opt.category).toUpperCase();
          const normSel = String(opt.selection).toUpperCase();
          const query = `${normCat} ${normSel}`;
          
          let best: BOMPart | undefined;
          let top = 0;
          partIndex.forEach(ip => {
            let s = query.includes(ip.pn) ? 1.1 : 0;
            // Token based partial match
            if (s === 0) {
               const queryTokens = query.split(/[\s,./()]+/).filter(s => s.length > 2);
               let hits = 0;
               queryTokens.forEach(t => { if (ip.tokens.has(t)) hits++; });
               s = queryTokens.length > 0 ? hits / queryTokens.length : 0;
            }
            if (s > top) { top = s; best = ip.part; }
          });

          matches.push({
            id: `m-${idx}-${Math.random()}`,
            category: normCat,
            selection: normSel,
            suggestedPart: best,
            manualPartNumber: best?.Part_Number || '',
            status: best ? 'Matched' : 'Unmatched',
            confidence: top,
            level: top > 0.9 ? ConfidenceLevel.AUTO_VERIFIED : ConfidenceLevel.REVIEW_NEEDED,
            source: 'AI'
          });
        });
      }
      setPendingMatches(matches);
      addLog(`Academy Training Complete. Found ${matches.length} matches.`, 'success');
    } catch (e: any) { addLog(`Training Fatal Error: ${e.message}`, 'error'); } 
    finally { setIsTraining(false); }
  };

  const commit = () => {
    const nKB = { ...knowledgeBase };
    const m = machineModel.toUpperCase();
    if (!nKB[m]) nKB[m] = [];
    pendingMatches.forEach(pm => {
      const pn = pm.manualPartNumber?.toUpperCase();
      if (pn) {
        const entries = nKB[m] as LearningEntry[];
        const ex = entries.findIndex(e => e.category === pm.category && e.selection === pm.selection);
        if (ex !== -1) {
           entries[ex].partNumber = pn;
           entries[ex].confirmedCount++;
        } else {
           entries.push({ category: pm.category, selection: pm.selection, partNumber: pn, confirmedCount: 1, lastUsed: new Date().toISOString() });
        }
      }
    });
    onKnowledgeBaseUpdate(nKB);
    setPendingMatches([]);
    addLog(`Neural Reservoir updated for ${m}.`, 'success');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b bg-white flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl transition-transform hover:scale-105">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Neural Academy</h2>
            <div className="flex items-center gap-4 mt-1">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Models: {stats.models}</span>
               <span className="text-slate-200">|</span>
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Learned Points: {stats.entries}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Academy Mastery</p>
          <p className="text-2xl font-black text-indigo-600">{(stats.entries / (parts.length || 1) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-indigo-500" /> Training Session
            </h3>
            <div className="space-y-4">
              <input type="text" placeholder="Machine Profile (e.g. PC210-10)" value={machineModel} onChange={e => setMachineModel(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold shadow-inner focus:border-indigo-500" />
              
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-300 transition-colors">
                <input type="file" multiple onChange={e => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer" />
                <FileText className="text-slate-300" size={24} />
                <span className="text-[9px] font-black text-slate-400 mt-2 uppercase">{moFiles.length > 0 ? `${moFiles.length} Selected` : 'Upload Spec Docs'}</span>
              </div>

              <button onClick={startTraining} disabled={isTraining} className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase transition-all shadow-xl active:scale-95 ${isTraining ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {isTraining ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {isTraining ? 'Scanning...' : 'Start Training'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white h-64 shadow-2xl flex flex-col">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Neural Stream</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-500 hover:text-white transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-2 pr-2 custom-scrollbar">
                {trainingLog.map((l, i) => <div key={i} className={`flex gap-2 leading-tight ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}><span>>></span><span>{l.msg}</span></div>)}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8">
           {pendingMatches.length > 0 ? (
             <div className="bg-white rounded-[2.5rem] border-2 border-indigo-100 p-8 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pattern Proposals</h3>
                   <div className="flex gap-4">
                      <button onClick={() => setPendingMatches([])} className="px-6 py-3 text-[10px] font-black uppercase bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100">Discard</button>
                      <button onClick={commit} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-xl shadow-lg">Commit To Brain</button>
                   </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Configuration Text</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Neural Part Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {pendingMatches.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-6 py-4">
                                  <p className="text-[10px] font-black text-indigo-600 uppercase">{m.category}</p>
                                  <p className="text-xs font-bold text-slate-800">{m.selection}</p>
                               </td>
                               <td className="px-6 py-4">
                                  <input type="text" value={m.manualPartNumber} onChange={e => {
                                     const n = [...pendingMatches];
                                     const i = n.findIndex(x => x.id === m.id);
                                     if (i !== -1) n[i].manualPartNumber = e.target.value.toUpperCase();
                                     setPendingMatches(n);
                                  }} className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-mono font-bold w-full focus:border-indigo-400 outline-none shadow-sm" />
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm h-full min-h-[500px] flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-8"><BrainCircuit size={14} /> Intelligence Base</h3>
                {stats.models === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-200 py-40">
                      <History size={80} className="mb-6 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-[0.4em]">Reservoir Empty</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(knowledgeBase).map(model => (
                      <div key={model} className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 hover:border-indigo-200 transition-all shadow-sm group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600 border border-slate-100"><Database size={20} /></div>
                            <button onClick={() => {
                              if(confirm(`Wipe memory for ${model}?`)) {
                                 const n = { ...knowledgeBase }; delete n[model]; onKnowledgeBaseUpdate(n);
                              }
                            }} className="p-3 bg-white rounded-xl text-slate-300 hover:text-red-500 transition-all shadow-sm"><Trash2 size={16} /></button>
                        </div>
                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">{model}</h4>
                        <div className="flex items-center justify-between mt-8">
                           <span className="text-lg font-black text-indigo-600">{(knowledgeBase[model] || []).length} Nodes</span>
                           <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5"><ShieldCheck size={14} /> Optimized</div>
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