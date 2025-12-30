
import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart, MachineKnowledge } from '../types';
import { 
  FileStack, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  Info,
  Brain,
  History
} from 'lucide-react';

interface Props {
  parts: BOMPart[];
  knowledgeBase: MachineKnowledge;
  onAutoSelect: (selectedIds: Set<string>) => void;
  onModelDetected: (model: string) => void;
  onNavigateToSelection: () => void;
}

interface MatchResult {
  category: string;
  selection: string;
  quantity: string;
  matchedPart?: BOMPart;
  confidence: number;
  source: 'Learned' | 'Semantic' | 'Partial' | 'None';
}

const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'UNIT', 'OPTIONS']);

const MOProvision: React.FC<Props> = ({ parts, knowledgeBase, onAutoSelect, onModelDetected, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState('Generic');

  const partIndex = useMemo(() => {
    return parts.map(p => ({
      part: p,
      tokens: new Set(`${p.Name} ${p.Remarks} ${p.Std_Remarks}`.toUpperCase().split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
      pn: p.Part_Number.toUpperCase()
    }));
  }, [parts]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || parts.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      const resultsBatch: MatchResult[] = [];
      let detectedModel = 'Generic';

      const filePromises = Array.from(files).map(async (file) => {
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1]);
          r.readAsDataURL(file);
        });

        const prompt = `
          1. Extract the "Machine Model" or "Product Name" from the header (e.g. PC210-10, DX225LCA).
          2. Extract the table of engineering options (Name, Option, Quantity).
          Return JSON: {"model": "string", "options": [{"category": "string", "selection": "string", "quantity": "string"}]}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }],
          config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '{}');
      });

      const pages = await Promise.all(filePromises);
      
      // Aggregate Model Detection
      const models = pages.map(p => p.model).filter(m => m && m !== 'Generic');
      if (models.length > 0) {
        detectedModel = models[0];
        setModelName(detectedModel);
        onModelDetected(detectedModel);
      }

      const allOptions = pages.flatMap(p => p.options || []);
      const modelHistory = knowledgeBase[detectedModel] || [];

      const matchedIds = new Set<string>();

      allOptions.forEach(opt => {
        // Priority 1: Check Learning Memory
        const historyMatch = modelHistory.find(h => h.category === opt.category && h.selection === opt.selection);
        if (historyMatch) {
          const part = parts.find(p => p.Part_Number === historyMatch.partNumber);
          if (part) {
            matchedIds.add(part.id);
            resultsBatch.push({ ...opt, matchedPart: part, confidence: 1.0, source: 'Learned' });
            return;
          }
        }

        // Priority 2: Semantic AI Match
        const query = `${opt.category} ${opt.selection}`.toUpperCase();
        const queryTokens = query.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s));
        
        let bestPart: BOMPart | undefined;
        let topScore = 0;

        partIndex.forEach(ip => {
          if (query.includes(ip.pn)) { topScore = 1.0; bestPart = ip.part; return; }
          let hits = 0;
          queryTokens.forEach(t => { if (ip.tokens.has(t)) hits++; });
          const score = queryTokens.length > 0 ? hits / queryTokens.length : 0;
          if (score > topScore) { topScore = score; bestPart = ip.part; }
        });

        if (bestPart && topScore > 0.45) matchedIds.add(bestPart.id);
        resultsBatch.push({ 
          ...opt, 
          matchedPart: bestPart, 
          confidence: topScore, 
          source: topScore > 0.7 ? 'Semantic' : topScore > 0.3 ? 'Partial' : 'None' 
        });
      });

      setResults(resultsBatch.sort((a, b) => b.confidence - a.confidence));
      if (matchedIds.size > 0) onAutoSelect(matchedIds);
    } catch (err) {
      setError("Document intelligence error. Check API key or image quality.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end border-b pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <FileStack className="text-indigo-600" /> MO Intelligence 
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <Brain className="text-emerald-500" size={16} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Model: <span className="text-indigo-600">{modelName}</span></p>
          </div>
        </div>
        {results.length > 0 && (
          <button onClick={onNavigateToSelection} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2">
            Verify Selections <ArrowRight size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="relative border-4 border-dashed border-slate-100 rounded-[2.5rem] p-10 flex flex-col items-center justify-center bg-white hover:bg-indigo-50/20 transition-all min-h-[400px]">
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            {isProcessing ? <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" /> : <Upload className="w-16 h-16 text-slate-200" />}
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Scan All MO Pages</p>
          </div>
          {error && <div className="mt-4 p-4 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-2xl border border-red-100">{error}</div>}
        </div>

        <div className="lg:col-span-8 space-y-4 max-h-[700px] overflow-auto pr-2">
          {results.map((res, i) => (
            <div key={i} className={`p-6 rounded-[2rem] border-2 transition-all ${res.source === 'Learned' ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 bg-white'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                  <p className="text-base font-black text-slate-800 leading-tight">{res.selection}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 border ${res.source === 'Learned' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                  {res.source === 'Learned' ? <History size={10} /> : null}
                  {res.source === 'Learned' ? 'Learned' : `${Math.round(res.confidence * 100)}% Conf`}
                </div>
              </div>
              {res.matchedPart ? (
                <div className="mt-4 p-4 bg-white/60 rounded-2xl border border-white flex items-center justify-between shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black font-mono text-indigo-600">{res.matchedPart.Part_Number}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{res.matchedPart.Name}</span>
                  </div>
                  <CheckCircle2 size={16} className={res.source === 'Learned' ? 'text-emerald-500' : 'text-indigo-400'} />
                </div>
              ) : (
                <div className="mt-4 text-[9px] font-black text-red-400 uppercase flex items-center gap-2 italic">
                  <AlertCircle size={14} /> Technical Correlate Not Found
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MOProvision;
