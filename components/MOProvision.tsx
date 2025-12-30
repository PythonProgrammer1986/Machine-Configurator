import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart } from '../types';
import { FileStack, Upload, Sparkles, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface Props {
  parts: BOMPart[];
  onAutoSelect: (selectedIds: Set<string>) => void;
  onNavigateToSelection: () => void;
}

interface MatchResult {
  category: string;
  selection: string;
  quantity: string;
  matchedPart?: BOMPart;
  confidence: number;
}

const MOProvision: React.FC<Props> = ({ parts, onAutoSelect, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pre-tokenize engine for O(1) keyword lookups
  const partIndex = useMemo(() => {
    return parts.map(p => ({
      part: p,
      tokens: new Set(`${p.Name} ${p.Remarks} ${p.Ref_des}`.toUpperCase().split(/[\s,./()\[\]]+/).filter(s => s.length > 2))
    }));
  }, [parts]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || parts.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      
      const fileProcessingPromises = Array.from(files).map(async (file) => {
        const reader = new FileReader();
        const base64Content = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const prompt = `Act as an engineer. Extract options from this MO table (Name, Option, Quantity). Return JSON array of objects. Skip "No options selected".`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64Content } }] }],
          config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '[]');
      });

      const pages = await Promise.all(fileProcessingPromises);
      const allExtracted = pages.flat();
      
      const matchedIds = new Set<string>();
      const finalResults: MatchResult[] = allExtracted.map(opt => {
        const queryTokens = `${opt.category} ${opt.selection}`.toUpperCase().split(/[\s,./()\[\]]+/).filter(s => s.length > 2);
        
        let bestMatch: BOMPart | undefined;
        let topScore = 0;

        partIndex.forEach(({ part, tokens }) => {
          let hits = 0;
          queryTokens.forEach(qt => { if (tokens.has(qt)) hits++; });
          const score = queryTokens.length > 0 ? hits / queryTokens.length : 0;
          
          if (score > topScore) {
            topScore = score;
            bestMatch = part;
          }
        });

        if (bestMatch && topScore > 0.45) matchedIds.add(bestMatch.id);
        
        return { ...opt, matchedPart: bestMatch, confidence: topScore };
      });

      setResults(finalResults.sort((a, b) => b.confidence - a.confidence));
      if (matchedIds.size > 0) onAutoSelect(matchedIds);
    } catch (err) {
      console.error(err);
      setError("AI Analysis failed. Check API connectivity and image quality.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="relative group">
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className={`border-4 border-dashed rounded-[3rem] p-10 flex flex-col items-center justify-center min-h-[400px] transition-all duration-300 ${
              isProcessing ? 'bg-slate-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/10 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5'
            }`}>
              {isProcessing ? (
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-6 bg-indigo-50 text-indigo-600 rounded-full shadow-inner">
                    <Upload size={40} />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">Scan MO Pages</p>
                  <p className="text-[10px] font-bold text-slate-400 text-center px-8 leading-relaxed">Intelligence will cross-reference technical keywords with active repository</p>
                </div>
              )}
            </div>
          </div>
          {error && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-2">{error}</div>}
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex flex-col overflow-hidden min-h-[600px] relative">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> Confidence Analysis
              </h3>
              {results.length > 0 && <p className="text-[10px] text-slate-400 font-bold mt-1">{results.length} Line items discovered</p>}
            </div>
            {results.length > 0 && (
              <button 
                onClick={onNavigateToSelection} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
              >
                Verify Matches <ArrowRight size={14} />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto p-8 space-y-4">
            {results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-4 opacity-40">
                <FileStack size={80} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Order Input</p>
              </div>
            ) : (
              results.map((res, i) => (
                <div key={i} className={`p-6 rounded-[2rem] border-2 transition-all group ${
                  res.confidence > 0.6 ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-50 bg-white'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                      <p className="text-sm font-black text-slate-800 leading-tight">{res.selection}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                      res.confidence > 0.6 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {Math.round(res.confidence * 100)}% Logic Rank
                    </div>
                  </div>
                  {res.matchedPart ? (
                    <div className="mt-4 flex items-center gap-4 bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-black">
                        {res.matchedPart.Ref_des || '??'}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-indigo-600 font-mono tracking-tighter">{res.matchedPart.Part_Number}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[250px]">{res.matchedPart.Name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase italic px-4 py-2 bg-red-50/30 rounded-xl">
                      <AlertCircle size={14} /> Repository mismatch detected
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MOProvision;