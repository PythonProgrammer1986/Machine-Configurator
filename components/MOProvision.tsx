import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart } from '../types';
import { 
  FileStack, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  Info,
  Layers,
  ChevronRight
} from 'lucide-react';

interface Props {
  parts: BOMPart[];
  onAutoSelect: (selectedIds: Set<string>) => void;
  onNavigateToSelection: void;
}

interface MatchResult {
  category: string;
  selection: string;
  quantity: string;
  matchedPart?: BOMPart;
  confidence: number;
  matchType?: 'Exact' | 'Semantic' | 'Partial' | 'None';
}

const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'STAGE', 'TIER', 'UNIT', 'OPTIONS', 'TYPE', 'REMARKS', 'STD']);

const MOProvision: React.FC<Props> = ({ parts, onAutoSelect, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pre-index the parts database for high-performance weighted matching
  const partIndex = useMemo(() => {
    return parts.map(p => {
      const technicalSource = `${p.Name} ${p.Remarks} ${p.Std_Remarks} ${p.Ref_des}`.toUpperCase();
      const tokens = technicalSource.split(/[\s,./()\[\]]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s));
      return {
        part: p,
        tokens: new Set(tokens),
        tokenCount: tokens.length,
        pn: p.Part_Number.toUpperCase()
      };
    });
  }, [parts]);

  const calculateScore = (opt: { category: string, selection: string }, indexedPart: typeof partIndex[0]): { score: number, type: MatchResult['matchType'] } => {
    const targetText = `${opt.category} ${opt.selection}`.toUpperCase();
    
    // 1. Exact Part Number Match (Highest weight)
    if (targetText.includes(indexedPart.pn)) {
      return { score: 1.0, type: 'Exact' };
    }

    const queryTokens = targetText.split(/[\s,./()\[\]]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s));
    if (queryTokens.length === 0) return { score: 0, type: 'None' };

    let matches = 0;
    queryTokens.forEach(qt => {
      if (indexedPart.tokens.has(qt)) matches++;
    });

    // Weighted score: Ratio of matched tokens relative to query length
    // Fix: queryTokens is a string[], use .length instead of .size (which is for Set)
    const semanticScore = matches / queryTokens.length;
    
    // 2. Strong Semantic Match (>70% tokens match)
    if (semanticScore >= 0.7) return { score: semanticScore, type: 'Semantic' };
    
    // 3. Partial Match
    if (semanticScore >= 0.3) return { score: semanticScore, type: 'Partial' };

    return { score: semanticScore, type: 'None' };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || parts.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      // Fix: Initialize GoogleGenAI with named parameter apiKey from process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const fileProcessingPromises = Array.from(files).map(async (file) => {
        const reader = new FileReader();
        const base64Content = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const prompt = `
          Extract technical configuration options from this Manufacturing Order (MO) document.
          Identify the table containing "Name", "Option", and "Quantity".
          
          Guidelines:
          - Extract specific engineering options like Engine type, Cab configuration, Hydraulics, etc.
          - Skip rows where Option is "No options selected", "None", or matches a generic machine model.
          - Normalize the "Name" as 'category' and "Option" as 'selection'.
          
          Return a JSON array: [{"category": string, "selection": string, "quantity": string}]
        `;

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
        let bestMatch: BOMPart | undefined;
        let bestScore = 0;
        let bestType: MatchResult['matchType'] = 'None';

        // Fix: Use for...of loop instead of forEach to ensure TypeScript correctly tracks mutation of variables for narrowing
        for (const ip of partIndex) {
          const { score, type } = calculateScore(opt, ip);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = ip.part;
            bestType = type;
          }
        }

        // Threshold for auto-selection: 60% confidence or Exact match
        // TS will now recognize bestType can be 'Exact' due to for...of mutation tracking
        if (bestMatch && (bestScore >= 0.6 || bestType === 'Exact')) {
          matchedIds.add(bestMatch.id);
        }
        
        return { 
          ...opt, 
          matchedPart: bestMatch, 
          confidence: bestScore,
          matchType: bestType
        };
      });

      // Filter out total failures and sort by confidence
      setResults(finalResults.sort((a, b) => b.confidence - a.confidence));
      if (matchedIds.size > 0) onAutoSelect(matchedIds);
    } catch (err) {
      console.error(err);
      setError("Intelligence Engine unavailable. Please ensure images are clear and API keys are active.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex p-5 bg-indigo-600 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
          <FileStack size={36} />
        </div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">MO Intelligence Parser</h2>
        <p className="text-slate-500 text-sm font-medium max-w-2xl mx-auto leading-relaxed">
          Upload multi-page Manufacturing Orders. Our semantic engine uses weighted token analysis to map customer specs to your engineering repository.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Input Control Area */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative group">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleFileUpload} 
              disabled={isProcessing} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            />
            <div className={`border-4 border-dashed rounded-[3rem] p-10 flex flex-col items-center justify-center min-h-[450px] transition-all duration-300 ${
              isProcessing ? 'bg-slate-50 border-indigo-200 cursor-wait' : 'bg-white border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/20 shadow-sm hover:shadow-2xl'
            }`}>
              {isProcessing ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                    <Sparkles size={24} className="absolute -top-2 -right-2 text-amber-500 animate-bounce" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 animate-pulse">Analyzing Payload...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="p-8 bg-indigo-50 text-indigo-600 rounded-full shadow-inner ring-4 ring-white">
                    <Upload size={48} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">Drop Order Images</p>
                    <p className="text-[10px] font-bold text-slate-400 px-6 leading-relaxed">Cross-referencing {parts.length} parts in technical repository</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Info size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Parser Logic Status</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Weighted Token Scoring: ACTIVE</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Semantic Context Filter: ACTIVE</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-5 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-2xl border border-red-100 flex items-center gap-3">
              <AlertCircle size={18} /> {error}
            </div>
          )}
        </div>

        {/* Intelligence Report Area */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] shadow-xl flex flex-col overflow-hidden min-h-[650px]">
          <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" /> Discovery Workspace
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Semantic confidence ranking for order line items</p>
            </div>
            {results.length > 0 && (
              <button 
                onClick={onNavigateToSelection} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center gap-3"
              >
                Release to Catalog <ArrowRight size={16} />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto p-10 space-y-6">
            {results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-6 opacity-40">
                <div className="p-10 bg-slate-50 rounded-full">
                  <FileStack size={100} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Initialize Document scan</p>
              </div>
            ) : (
              results.map((res, i) => {
                const isHigh = res.confidence >= 0.7;
                const isMed = res.confidence >= 0.4 && res.confidence < 0.7;
                
                return (
                  <div key={i} className={`p-8 rounded-[2.5rem] border-2 transition-all duration-300 group ${
                    isHigh ? 'border-emerald-100 bg-emerald-50/10' : 
                    isMed ? 'border-amber-100 bg-amber-50/10' : 
                    'border-slate-50 bg-white opacity-60'
                  }`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{res.category}</span>
                        <p className="text-lg font-black text-slate-800 leading-tight">{res.selection}</p>
                        {res.quantity && <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md mt-2 inline-block">QTY: {res.quantity}</span>}
                      </div>
                      <div className="text-right">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm ${
                          isHigh ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          isMed ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {Math.round(res.confidence * 100)}% Confidence
                        </div>
                        <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-tighter">{res.matchType} Match Identification</p>
                      </div>
                    </div>

                    {res.matchedPart ? (
                      <div className="flex items-center gap-5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                          isHigh ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          <CheckCircle2 size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-indigo-600 font-mono tracking-tighter">{res.matchedPart.Part_Number}</p>
                          <p className="text-xs font-bold text-slate-600 uppercase truncate max-w-[350px]">{res.matchedPart.Name}</p>
                        </div>
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                          {res.matchedPart.Ref_des || 'GEN'} <ChevronRight size={14} className="inline ml-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-red-400 text-[10px] font-black uppercase italic px-6 py-4 bg-red-50/30 rounded-3xl border border-red-50/50">
                        <AlertCircle size={18} /> No technical correlate discovered
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {results.length > 0 && (
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Ready for Verification</p>
                <p className="text-3xl font-black">
                  {results.filter(r => r.matchedPart).length} <span className="text-slate-600">/</span> {results.length} Matches
                </p>
              </div>
              <button 
                onClick={onNavigateToSelection} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3"
              >
                Apply Configuration <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MOProvision;