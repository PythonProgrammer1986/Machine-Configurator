
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart } from '../types';
import { FileStack, Upload, Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight, Layers, Info } from 'lucide-react';

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
  reason?: string;
}

const MOProvision: React.FC<Props> = ({ parts, onAutoSelect, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'STAGE', 'TIER', 'UNIT']);

  const calculateMatchScore = (opt: any, part: BOMPart): { score: number; reason: string } => {
    const targetText = `${opt.category} ${opt.selection}`.toUpperCase();
    const sourceText = `${part.Name} ${part.Remarks} ${part.Std_Remarks} ${part.Ref_des}`.toUpperCase();
    
    // 1. Check for Exact Part Number match (Rare in MOs but high value)
    if (targetText.includes(part.Part_Number.toUpperCase())) {
      return { score: 1.0, reason: "Exact Part Number Reference" };
    }

    // 2. Tokenized match
    const targetTokens = targetText.split(/[\s,./()]+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
    const sourceTokens = sourceText.split(/[\s,./()]+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
    
    let matches = 0;
    const uniqueTargets = new Set(targetTokens);
    uniqueTargets.forEach(t => {
      if (sourceTokens.includes(t)) matches++;
    });

    const score = uniqueTargets.size > 0 ? matches / uniqueTargets.size : 0;

    // 3. Category/Designator Boost
    let finalScore = score;
    if (part.Ref_des && targetText.includes(part.Ref_des.toUpperCase())) {
      finalScore += 0.3;
    }

    return { 
      score: Math.min(finalScore, 1.0), 
      reason: matches > 0 ? `${matches} technical tokens matched` : "Low textual overlap" 
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || parts.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const allExtractedOptions: any[] = [];
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });

      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        const base64Content = base64Data.split(',')[1];

        const prompt = `
          Extract technical specifications from this Manufacturing Order (MO).
          The document contains a table with columns: "Name", "Option", and "Quantity".
          
          Guidelines:
          1. Extract only rows with meaningful "Option" values.
          2. Skip rows where Option is "No options selected", "None", or matches the "MachineType".
          3. Focus on unique features like Engine types, Tyres, Hydraulic systems, and Cabin environments.
          4. Include the "Quantity" if specified.
          
          Return as JSON array of objects: {"category": "...", "selection": "...", "quantity": "..."}.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: file.type, data: base64Content } },
              ],
            },
          ],
          config: { responseMimeType: "application/json" }
        });

        const pageOptions = JSON.parse(response.text || '[]');
        allExtractedOptions.push(...pageOptions);
      }
      
      const matchedIds = new Set<string>();
      const processedResults: MatchResult[] = allExtractedOptions.map((opt: any) => {
        let bestPart: BOMPart | undefined;
        let bestScore = 0;
        let bestReason = "";

        // Iterate parts to find best match based on weighted score
        parts.forEach(p => {
          const { score, reason } = calculateMatchScore(opt, p);
          if (score > bestScore) {
            bestScore = score;
            bestPart = p;
            bestReason = reason;
          }
        });

        // Thresholding for selection
        if (bestPart && bestScore > 0.4) {
          matchedIds.add(bestPart.id);
        }
        
        return {
          ...opt,
          matchedPart: bestPart,
          confidence: bestScore,
          reason: bestReason
        };
      });

      setResults(processedResults.sort((a, b) => b.confidence - a.confidence));
      if (matchedIds.size > 0) {
        onAutoSelect(matchedIds);
      }
    } catch (err: any) {
      console.error(err);
      setError("Intelligence Engine Error: Could not parse MO document structures.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex p-4 bg-indigo-600 text-white rounded-3xl mb-2 shadow-xl shadow-indigo-100 ring-8 ring-indigo-50">
          <FileStack size={32} />
        </div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">MO Intelligence 2.0</h2>
        <p className="text-slate-500 text-sm font-medium max-w-lg mx-auto leading-relaxed">
          Advanced semantic matching for heavy machinery Manufacturing Orders. Supporting multi-page uploads and technical token weighting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Zone */}
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
            <div className={`border-4 border-dashed rounded-[3rem] p-10 flex flex-col items-center justify-center transition-all min-h-[350px] ${
              isProcessing ? 'bg-slate-50 border-slate-200 cursor-wait' : 'bg-white border-slate-100 group-hover:border-indigo-400 group-hover:bg-indigo-50/30'
            }`}>
              {isProcessing ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <Loader2 size={64} className="text-indigo-600 animate-spin" />
                    <Sparkles size={24} className="absolute -top-2 -right-2 text-amber-500 animate-bounce" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] animate-pulse">Scanning Page Data...</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold max-w-[150px]">Matching technical tokens against {parts.length} parts</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-indigo-50/50">
                    <Upload size={32} />
                  </div>
                  <p className="text-xs font-black text-slate-700 uppercase tracking-widest text-center px-4">Upload All MO Pages</p>
                  <p className="text-[10px] text-slate-400 mt-3 font-bold bg-slate-100 px-3 py-1 rounded-full">Supports JPG, PNG, WEBP</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
             <div className="flex items-center gap-2 text-indigo-600 mb-2">
               <Info size={16} />
               <span className="text-[10px] font-black uppercase tracking-widest">Matching Guide</span>
             </div>
             <div className="space-y-3">
               <div className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1"></div>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Green matches are >70% confident and auto-applied to your configuration.</p>
               </div>
               <div className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1"></div>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Amber matches require your verification in the Selection catalog.</p>
               </div>
             </div>
          </div>
        </div>

        {/* Results Zone */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex flex-col min-h-[600px] overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" /> Component Context Discovery
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Analyzed {results.length} order line items</p>
            </div>
            {results.length > 0 && (
              <div className="flex gap-2">
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-[9px] font-black uppercase border border-emerald-100 shadow-sm flex items-center gap-2">
                  <CheckCircle2 size={12} /> {results.filter(r => r.confidence > 0.7).length} Confirmed
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-auto p-8 space-y-4">
            {results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                <div className="p-8 bg-slate-50 rounded-full">
                  <FileStack size={64} className="text-slate-200" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em]">No Document Data Loaded</p>
              </div>
            ) : (
              results.map((res, i) => {
                const isHigh = res.confidence > 0.7;
                const isMed = res.confidence > 0.3 && res.confidence <= 0.7;
                
                return (
                  <div key={i} className={`group p-6 rounded-[2rem] border-2 transition-all ${
                    isHigh ? 'border-emerald-100 bg-emerald-50/20' : 
                    isMed ? 'border-amber-100 bg-amber-50/20' : 
                    'border-slate-100 bg-white opacity-60'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">{res.category}</span>
                        <p className="text-base font-black text-slate-800 leading-tight">{res.selection}</p>
                        {res.quantity && <span className="text-[10px] font-black text-indigo-500 mt-1 block">QTY: {res.quantity}</span>}
                      </div>
                      
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 border ${
                          isHigh ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          isMed ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {Math.round(res.confidence * 100)}% Match
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{res.reason}</p>
                      </div>
                    </div>

                    {res.matchedPart ? (
                      <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white shadow-sm">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-900 font-mono">{res.matchedPart.Part_Number}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[300px]">{res.matchedPart.Name}</p>
                        </div>
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                           {res.matchedPart.Ref_des || 'GEN'}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-red-400 px-4 py-2 bg-red-50/30 rounded-2xl border border-red-50">
                        <AlertCircle size={14} />
                        <span className="text-[9px] font-black uppercase">No Part Discovered in Repository</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {results.length > 0 && (
            <div className="p-8 bg-slate-900 text-white">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ready for Verification</p>
                  <p className="text-2xl font-black">
                    {results.filter(r => r.matchedPart).length} <span className="text-slate-500">/</span> {results.length} Matches
                  </p>
                </div>
                <button 
                  onClick={onNavigateToSelection}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/20 transition-all flex items-center gap-3"
                >
                  Confirm Configuration <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MOProvision;
