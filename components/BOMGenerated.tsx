
import React, { useMemo, useState } from 'react';
import { BOMPart, LearningEntry } from '../types';
import { FileText, Download, Printer, UserCheck, ShieldCheck, BrainCircuit, RefreshCw } from 'lucide-react';

interface Props {
  parts: BOMPart[];
  selectedIds: Set<string>;
  modelName: string;
  onFinalizeKnowledge: (mappings: {category: string, selection: string, partNumber: string}[]) => void;
}

const BOMGenerated: React.FC<Props> = ({ parts, selectedIds, modelName, onFinalizeKnowledge }) => {
  const [learned, setLearned] = useState(false);

  const finalBOM = useMemo(() => {
    const defaultParts = parts.filter(p => p.F_Code === 0);
    const userSelectedParts = parts.filter(p => selectedIds.has(p.id));
    return [...defaultParts, ...userSelectedParts]
      .filter(p => p.F_Code !== 9)
      .sort((a, b) => (a.Select_pref || 0) - (b.Select_pref || 0));
  }, [parts, selectedIds]);

  const handleFinalize = () => {
    // Generate mapping data for learning
    // We only map items that were confirmed by the user (F1/F2 code)
    const confirmedMappings = parts
      .filter(p => selectedIds.has(p.id) && (p.F_Code === 1 || p.F_Code === 2))
      .map(p => ({
        category: p.Ref_des || 'Unknown',
        selection: p.Name,
        partNumber: p.Part_Number
      }));

    onFinalizeKnowledge(confirmedMappings);
    setLearned(true);
    
    // Trigger standard export
    const exportData = finalBOM.map(p => ({
      Part_Number: p.Part_Number,
      Name: p.Name,
      Ref_des: p.Ref_des,
      Status: 'VERIFIED'
    }));
    const ws = (window as any).XLSX.utils.json_to_sheet(exportData);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Production BOM");
    (window as any).XLSX.writeFile(wb, `${modelName}_BOM_Final.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" /> Confirmed Output
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Model Index: <span className="text-indigo-600">{modelName}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="bg-slate-50 text-slate-600 px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-slate-200">
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={handleFinalize}
            disabled={learned}
            className={`px-8 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl ${
              learned ? 'bg-emerald-500 text-white opacity-80' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {learned ? <BrainCircuit size={18} /> : <RefreshCw size={18} />}
            {learned ? "Engine Trained" : "Release & Train Engine"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10">
        <div className="max-w-5xl mx-auto bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 text-white p-10 flex justify-between items-center">
             <div className="flex items-center gap-4">
                <FileText size={32} className="text-indigo-400" />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter">Verified Build Manifest</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Authorized Assembly Document</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmed Items</p>
                <p className="text-4xl font-black text-emerald-400">{finalBOM.length}</p>
             </div>
          </div>
          
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">PN / Reference</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Component Nomenclature</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {finalBOM.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-10 py-5 text-sm font-mono font-bold text-indigo-600">{p.Part_Number}</td>
                  <td className="px-10 py-5">
                    <p className="text-sm font-black text-slate-800">{p.Name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.Ref_des || 'Standard'}</p>
                  </td>
                  <td className="px-10 py-5 text-center">
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center justify-center gap-1.5 border border-emerald-100 mx-auto w-fit">
                      <UserCheck size={10} /> Confirmed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BOMGenerated;
