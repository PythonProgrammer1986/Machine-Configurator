import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MachineKnowledge, LearningEntry, BOMPart, ConfigRule, ConfidenceLevel, TechnicalGlossary } from '../types';
import { 
  GraduationCap, 
  Play, 
  Loader2, 
  FileText, 
  BrainCircuit, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  Database, 
  FlaskConical, 
  FileSpreadsheet, 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Terminal, 
  Layers, 
  Search, 
  Activity, 
  Cpu, 
  RefreshCw, 
  SearchCode, 
  CheckCircle, 
  Bug, 
  Info, 
  Layers2, 
  Binary, 
  Microchip,
  Timer,
  Clock,
  RotateCcw,
  Save
} from 'lucide-react';

interface Props {
  knowledgeBase: MachineKnowledge;
  onKnowledgeBaseUpdate: (kb: MachineKnowledge) => void;
  apiKey: string;
  parts: BOMPart[];
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  glossary: TechnicalGlossary;
}

interface LogicProposal {
  partNumber: string;
  partName: string;
  proposedExpression: string;
  evidenceCount: number;
  confidence: number;
  reasoning: string;
  matchedMOs: string[];
  keyIndicators: string[];
}

const NeuralAcademy: React.FC<Props> = ({ knowledgeBase, onKnowledgeBaseUpdate, apiKey, parts, rules, onRulesUpdate, glossary }) => {
  const [activeMode, setActiveMode] = useState<'weights' | 'logic-synthesis'>('logic-synthesis');
  const [moFiles, setMoFiles] = useState<File[]>([]);
  const [milFiles, setMilFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'warn'}[]>([]);
  const [proposals, setProposals] = useState<LogicProposal[]>([]);
  const [resultSearchTerm, setResultSearchTerm] = useState('');
  
  // Batch & Cooldown States
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const BATCH_SIZE = 10;
  const COOLDOWN_SECONDS = 65; 

  // Persistence Key
  const STORAGE_KEY = 'bom_synthesis_session';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.proposals) setProposals(parsed.proposals);
        addLog(`Restore point detected: ${parsed.proposals.length} existing formulas loaded.`, 'info');
      } catch (e) {
        console.error("Failed to load restore point", e);
      }
    }
  }, []);

  // Save to restore point whenever proposals change
  useEffect(() => {
    if (proposals.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        proposals,
        timestamp: new Date().toISOString()
      }));
    }
  }, [proposals]);

  useEffect(() => {
    let timer: number;
    if (cooldownRemaining > 0) {
      timer = window.setInterval(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => 
    setTrainingLog(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev]);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const normalizeId = (id: any): string => {
    return String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
  };

  const safeJsonParse = (text: string) => {
    try {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw Text:", text);
      return {};
    }
  };

  const clearSession = () => {
    if (confirm("Clear current lab restore point and results?")) {
      localStorage.removeItem(STORAGE_KEY);
      setProposals([]);
      addLog("Lab session reset. Starting from zero.", 'warn');
    }
  };

  const parseMilExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = (window as any).XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = (window as any).XLSX.utils.sheet_to_json(firstSheet);
          
          if (rawRows.length === 0) {
            resolve([]);
            return;
          }

          const normalizedRows = rawRows.map((row: any) => {
            const normalized: any = { _raw: row };
            Object.keys(row).forEach(key => {
              const val = row[key];
              const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (k === 'mo' || k.includes('order') || k.includes('monumber') || k === 'factoryorder') {
                normalized['monumber'] = val;
                normalized['norm_mo'] = normalizeId(val);
              } else if (k === 'partno' || k.includes('partnumber') || k === 'pn' || k === 'sku') {
                normalized['partnumber'] = val;
                normalized['norm_pn'] = normalizeId(val);
              } else if (k === 'partname' || k.includes('name') || k.includes('nomenclature')) {
                normalized['name'] = val;
              } else if (k === 'remarks' || k.includes('notes') || k.includes('technical')) {
                normalized['remarks'] = val;
              } else {
                normalized[k] = val;
              }
            });
            return normalized;
          });
          resolve(normalizedRows);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsBinaryString(file);
    });
  };

  const startLogicSynthesis = async () => {
    const key = apiKey || process.env.API_KEY;
    if (!key) {
      addLog("Authentication Failure: Missing Gemini API Key.", 'error');
      return;
    }
    
    if (moFiles.length === 0 || milFiles.length === 0) {
      addLog("Prerequisites Not Met: Upload MIL Excel and Factory Order PDFs.", 'warn');
      return;
    }

    setIsTraining(true);
    addLog(`Initiating Phase 1: Knowledge Base Ingestion...`, 'info');

    try {
      let milData: any[] = [];
      for (const file of milFiles) {
        addLog(`Indexing MIL: ${file.name}`, 'info');
        const data = await parseMilExcel(file);
        milData = [...milData, ...data];
      }

      const ai = new GoogleGenAI({ apiKey: key });
      const moDetails: { moNumber: string, normMo: string, specs: {name: string, option: string}[] }[] = [];

      addLog(`Initiating Phase 2: PDF Vision Extraction...`, 'info');

      for (const file of moFiles) {
        addLog(`Analyzing PDF: ${file.name}`, 'info');
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: `Identify MO Number. Extract 'Options' table (Name/Option columns). JSON: {"moNumber": "string", "options": [{"name": "string", "option": "string"}]}` },
              { inlineData: { mimeType: file.type, data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const data = safeJsonParse(resp.text || '{}');
        const moNum = String(data.moNumber || '').trim();
        if (moNum) {
          moDetails.push({ 
            moNumber: moNum, 
            normMo: normalizeId(moNum),
            specs: data.options || [] 
          });
          addLog(`Order #${moNum} mapped.`, 'success');
        }
      }

      addLog(`Initiating Phase 3: Semantic Logic Correlation...`, 'info');
      const skuContexts: Record<string, { contexts: string[], mos: string[], milEntry?: any }> = {}; 
      
      moDetails.forEach(mo => {
        const linkedRows = milData.filter(row => row.norm_mo === mo.normMo);
        linkedRows.forEach(row => {
          const pn = String(row.partnumber || '').trim();
          if (!pn) return;
          if (!skuContexts[pn]) skuContexts[pn] = { contexts: [], mos: [], milEntry: row };
          const fullContext = mo.specs.map(s => `${s.name}: ${s.option}`).join(' | ');
          skuContexts[pn].contexts.push(fullContext);
          skuContexts[pn].mos.push(mo.moNumber);
        });
      });

      const skus = Object.keys(skuContexts);
      if (skus.length === 0) {
        addLog(`Synthesis Aborted: No overlapping MO numbers found.`, 'error');
        setIsTraining(false);
        return;
      }

      const currentProcessed = new Set(proposals.map(p => p.partNumber));
      const skusToProcess = skus.filter(s => {
        if (currentProcessed.has(s)) return false;
        const masterPart = parts.find(p => normalizeId(p.Part_Number) === normalizeId(s));
        return masterPart && (masterPart.F_Code === 1 || masterPart.F_Code === 2);
      });

      if (skusToProcess.length === 0) {
        addLog("All detected SKUs already synthesized in this session.", 'success');
        setIsTraining(false);
        return;
      }

      addLog(`Phase 4: Synthesis Engine Resumed. Processing ${skusToProcess.length} remaining SKUs...`, 'info');
      const glossaryContext = Object.entries(glossary).map(([k, v]) => `${k} = ${v}`).join('; ');

      for (let idx = 0; idx < skusToProcess.length; idx++) {
        // Safe Batching Break
        if (idx > 0 && idx % BATCH_SIZE === 0) {
          addLog(`Batch completed. Quota cooldown triggered...`, 'warn');
          setCooldownRemaining(COOLDOWN_SECONDS);
          await delay(COOLDOWN_SECONDS * 1000);
          addLog(`Cooldown finished. Resuming.`, 'info');
        }

        const pn = skusToProcess[idx];
        const { contexts, mos, milEntry } = skuContexts[pn];
        const masterPart = parts.find(p => normalizeId(p.Part_Number) === normalizeId(pn));
        const partName = masterPart?.Name || milEntry?.name || 'Component';
        const partRemarks = milEntry?.remarks || masterPart?.Remarks || '';

        await delay(1500);

        let retryCount = 0;
        let success = false;

        while (!success && retryCount < 3) {
          try {
            const prompt = `
              TASK: Create configuration logic formula for: ${pn} (${partName})
              REMARKS: "${partRemarks}"
              TECH DICT: ${glossaryContext}
              EVIDENCE: ${contexts.map((c, i) => `MO #${mos[i]}: ${c}`).join('\n')}
              FORMAT: (INCLUDES) [EXCLUDES]
              JSON: {"expression": "string", "confidence": number, "reasoning": "string", "indicators": ["string"]}
            `;

            const resp = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: { responseMimeType: "application/json" }
            });

            const logic = safeJsonParse(resp.text || '{}');
            const proposal = {
              partNumber: pn,
              partName: partName,
              proposedExpression: logic.expression || "(N/A)",
              evidenceCount: contexts.length,
              confidence: logic.confidence || 0.5,
              reasoning: logic.reasoning || "Neural correlation result.",
              matchedMOs: Array.from(new Set(mos)),
              keyIndicators: logic.indicators || []
            };

            // Incremental Update: Add to state and save restore point immediately
            setProposals(prev => [...prev, proposal]);
            
            success = true;
            addLog(`Synthesized: ${pn} [${idx + 1}/${skusToProcess.length}]`, 'success');
          } catch (aiErr: any) {
            if (aiErr.message?.includes('429')) {
              retryCount++;
              const backoff = 30000 * retryCount;
              addLog(`Rate Limit: Pausing ${backoff/1000}s...`, 'warn');
              setCooldownRemaining(Math.round(backoff/1000));
              await delay(backoff);
            } else {
              addLog(`Error for ${pn}: ${aiErr.message}`, 'error');
              break;
            }
          }
        }
      }

      addLog(`Laboratory synthesis complete.`, 'success');

    } catch (e: any) {
      addLog(`Fatal Lab Error: ${e.message}`, 'error');
    } finally {
      setIsTraining(false);
      setCooldownRemaining(0);
    }
  };

  const startTraining = async () => {
    setTrainingLog([{ msg: "Pattern Training Lab Initializing...", type: 'info' }]);
    const key = apiKey || process.env.API_KEY;
    if (!key) return addLog("Access Denied: Missing Key.", 'error');
    setIsTraining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const newKB = { ...knowledgeBase };
      for (const file of moFiles) {
        addLog(`Analyzing weights: ${file.name}`, 'info');
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });
        const prompt = `Identify Machine Model and Configuration options. JSON: {"model": "string", "options": [{"category": "string", "selection": "string"}]}`;
        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] },
          config: { responseMimeType: "application/json" }
        });
        const data = safeJsonParse(resp.text || '{}');
        const model = (data.model || 'Generic').toUpperCase();
        if (!newKB[model]) newKB[model] = [];
        addLog(`Weights updated for ${model}.`, 'success');
      }
      onKnowledgeBaseUpdate(newKB);
    } catch (e: any) { addLog(`Error: ${e.message}`, 'error'); } finally { setIsTraining(false); }
  };

  const deployLogic = () => {
    const newRules = [...rules];
    proposals.forEach(p => {
      const part = parts.find(x => normalizeId(x.Part_Number) === normalizeId(p.partNumber));
      if (!part) return;
      const existingIdx = newRules.findIndex(r => r.targetPartId === part.id);
      const logicObj = { includes: [], excludes: [], orGroups: [], raw: p.proposedExpression };
      if (existingIdx !== -1) {
        newRules[existingIdx].logic = { ...logicObj, raw: p.proposedExpression };
      } else {
        newRules.push({ id: `rule-synth-${Date.now()}-${Math.random()}`, targetPartId: part.id, logic: logicObj, isActive: true });
      }
    });
    onRulesUpdate(newRules);
    setProposals([]);
    localStorage.removeItem(STORAGE_KEY);
    addLog(`Logic deployed to system. Restore point cleared.`, 'success');
    alert(`Success: Deployed ${proposals.length} rules.`);
  };

  const exportToExcel = () => {
    if (proposals.length === 0) return;
    const data = proposals.map(p => ({
      "Part Number": p.partNumber,
      "Part Name": p.partName,
      "Synthesized Logic": p.proposedExpression,
      "Confidence": `${Math.round(p.confidence * 100)}%`,
      "Evidence Hits": p.evidenceCount,
      "Associated MOs": p.matchedMOs.join(', '),
      "AI Indicators": p.keyIndicators.join(', '),
      "Neural Analysis": p.reasoning
    }));
    const wb = (window as any).XLSX.utils.book_new();
    const ws = (window as any).XLSX.utils.json_to_sheet(data);
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Neural Synthesis Report");
    (window as any).XLSX.writeFile(wb, `Logic_Synthesis_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredProposals = proposals.filter(p => 
    p.partNumber.toLowerCase().includes(resultSearchTerm.toLowerCase()) || 
    p.partName.toLowerCase().includes(resultSearchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b bg-white flex flex-wrap justify-between items-center shadow-sm gap-4">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Neural Academy</h2>
            <div className="flex items-center gap-4 mt-3">
               <button onClick={() => setActiveMode('logic-synthesis')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeMode === 'logic-synthesis' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Logic Synthesis Lab</button>
               <button onClick={() => setActiveMode('weights')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeMode === 'weights' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Neural Pattern Training</button>
            </div>
          </div>
        </div>
        <div className="flex gap-8">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Database</p>
              <p className="text-2xl font-black text-slate-800 leading-none mt-1">{parts.length} SKU Items</p>
           </div>
           {proposals.length > 0 && (
             <div className="text-right border-l pl-8 border-slate-100">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Logic Proposals</p>
                <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{proposals.length} Formulas</p>
             </div>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm space-y-6 sticky top-0">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FlaskConical size={14} className="text-indigo-500" /> Lab Configuration
              </h3>
              {proposals.length > 0 && (
                <button onClick={clearSession} className="text-red-500 hover:text-red-600 transition-colors" title="Reset Session">
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                <input type="file" multiple onChange={e => setMilFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileSpreadsheet className={milFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{milFiles.length > 0 ? `${milFiles.length} MIL Files Indexed` : 'Upload MIL Excel (Ground Truth)'}</span>
              </div>

              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                <input type="file" multiple onChange={e => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileText className={moFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{moFiles.length > 0 ? `${moFiles.length} Order Files Loaded` : 'Upload MO Summaries (PDF)'}</span>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
                    <span>Session Persistence</span>
                    <span className="flex items-center gap-1 text-emerald-500"><Save size={8} /> Auto-Saving Enabled</span>
                 </div>
                 <button 
                  onClick={activeMode === 'logic-synthesis' ? startLogicSynthesis : startTraining} 
                  disabled={isTraining || cooldownRemaining > 0} 
                  className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase transition-all shadow-xl active:scale-95 ${isTraining || cooldownRemaining > 0 ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                >
                  {isTraining ? <Loader2 size={18} className="animate-spin" /> : cooldownRemaining > 0 ? <Clock size={18} /> : proposals.length > 0 ? <Play size={18} /> : <Zap size={18} />}
                  {isTraining ? 'Neural Processing...' : cooldownRemaining > 0 ? `Cooling (${cooldownRemaining}s)` : proposals.length > 0 ? 'Resume Synthesis' : 'Synthesize Logic Formulas'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl h-80 border border-white/5 flex flex-col">
             <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
               <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={12} /> Live Lab Feed</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-500 hover:text-white transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-2 scrollbar-hide">
                {cooldownRemaining > 0 && (
                   <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30 flex items-center gap-3 text-indigo-300 mb-4 animate-pulse">
                      <Timer size={14} />
                      <span className="font-bold uppercase tracking-tight">API QUOTA RESET: PAUSING FOR {cooldownRemaining}s</span>
                   </div>
                )}
                {trainingLog.length === 0 && <p className="text-slate-700 italic">Lab standby. Restore point active if previously closed.</p>}
                {trainingLog.map((l, i) => (
                  <div key={i} className={`flex gap-3 leading-relaxed ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'warn' ? 'text-amber-400' : 'text-indigo-200/80'}`}>
                    <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                    <span className="flex-1">{l.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col h-full">
           {proposals.length > 0 ? (
             <div className="bg-white rounded-[3rem] border-2 border-indigo-100 p-8 shadow-2xl h-full flex flex-col animate-in zoom-in-95">
                <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b pb-8 border-slate-50">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><Activity size={24} /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Real-Time Discoveries</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Incremental Restore Point Active</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <div className="relative mr-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input type="text" placeholder="Filter results..." value={resultSearchTerm} onChange={(e) => setResultSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 text-[10px] font-black uppercase bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all w-48" />
                      </div>
                      <button onClick={exportToExcel} title="Export Findings" className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"><Download size={18} /></button>
                      <button onClick={deployLogic} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">Deploy All Rules</button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-auto pr-4 space-y-4">
                   {filteredProposals.slice().reverse().map((p, i) => (
                      <div key={p.partNumber} className="p-8 border-2 rounded-[2.5rem] bg-white hover:border-indigo-400 transition-all flex flex-col gap-6 shadow-sm group animate-in slide-in-from-top-4">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">Part Number: {p.partNumber}</p>
                               <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none">{p.partName}</h4>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm ${p.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                               <CheckCircle size={12} /> {Math.round(p.confidence * 100)}% Pattern Match
                            </div>
                         </div>
                         
                         <div className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 flex flex-wrap items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5"><Binary size={80} className="text-indigo-400" /></div>
                            <div className="space-y-1 relative z-10">
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Trigger Formula</span>
                              <code className="text-white font-mono font-black text-lg sm:text-2xl tracking-tighter">{p.proposedExpression}</code>
                            </div>
                            <div className="text-right relative z-10">
                              <span className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Statistical Sample</span>
                              <span className="text-xl font-black text-indigo-400 uppercase">{p.evidenceCount} Orders Found</span>
                            </div>
                         </div>

                         <div className="space-y-4">
                           <div className="flex flex-wrap gap-2">
                              {p.keyIndicators.map(ki => (
                                <span key={ki} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-lg border border-indigo-100 uppercase flex items-center gap-1"><Microchip size={10} /> {ki}</span>
                              ))}
                           </div>
                           <div className="flex gap-3 items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <BrainCircuit size={18} className="text-indigo-400 mt-1 shrink-0" />
                             <div>
                               <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight italic">
                                 <span className="text-indigo-600 font-black mr-2 not-italic">Neural Insight:</span> {p.reasoning}
                               </p>
                             </div>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {p.matchedMOs.map(mo => (
                                <span key={mo} className="px-3 py-1 bg-white text-slate-400 text-[9px] font-black rounded-lg border border-slate-100 uppercase transition-colors hover:text-indigo-600">MO #{mo}</span>
                              ))}
                           </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-[3rem] border border-slate-200 p-8 shadow-sm h-full flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-50/50 [mask-image:radial-gradient(circle_at_center,white,transparent)]"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border shadow-inner mb-8 transition-transform hover:scale-110 group">
                    <FlaskConical size={48} className="text-slate-200 group-hover:text-indigo-300 transition-colors" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">Synthesis Engine Offline</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-4 max-w-sm uppercase leading-relaxed tracking-wider">
                    Upload your datasets to begin automated engineering logic correlation. All results are saved incrementally to allow pause/resume.
                  </p>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default NeuralAcademy;