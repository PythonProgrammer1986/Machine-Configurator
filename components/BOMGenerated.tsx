
import React, { useMemo } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { FileText, Download, Printer, CheckCircle2, Package, Sparkles, UserCheck, ShieldCheck } from 'lucide-react';

interface Props {
  parts: BOMPart[];
  selectedIds: Set<string>;
  rules?: ConfigRule[]; 
}

const BOMGenerated: React.FC<Props> = ({ parts, selectedIds, rules = [] }) => {
  
  const finalBOM = useMemo(() => {
    // 1. Defaults (F0) are always included as they are baseline
    const defaultParts = parts.filter(p => p.F_Code === 0);

    // 2. User Picks (Confirmed items)
    // To strictly enforce countercheck, we ONLY take what is in selectedIds.
    // Logic recommendations that weren't confirmed by the user (not in selectedIds) 
    // are excluded to ensure a human has verified every configuration choice.
    const userSelectedParts = parts.filter(p => selectedIds.has(p.id));

    return [...defaultParts, ...userSelectedParts]
      .filter(p => p.F_Code !== 9) // Exclude reference-only items
      .sort((a, b) => (a.Select_pref || 0) - (b.Select_pref || 0));
  }, [parts, selectedIds]);

  const groupedBOM = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    finalBOM.forEach(p => {
      const key = p.Ref_des || 'Standard Components';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [finalBOM]);

  const exportToExcel = () => {
    if (finalBOM.length === 0) return;
    const exportData = finalBOM.map(p => ({
      Part_Number: p.Part_Number,
      Name: p.Name,
      Remarks: p.Remarks,
      Std_Remarks: p.Std_Remarks,
      Ref_des: p.Ref_des,
      Verification: selectedIds.has(p.id) ? 'USER_COUNTERCHECKED' : 'SYSTEM_DEFAULT'
    }));
    const ws = (window as any).XLSX.utils.json_to_sheet(exportData);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Assembly BOM");
    (window as any).XLSX.writeFile(wb, `Counterchecked_BOM_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Package className="text-emerald-600" />
            Counterchecked Production BOM
          </h2>
          <p className="text-sm text-slate-500">Only user-confirmed SKUs and system defaults have been released.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-sm"
          >
            <Printer size={16} /> Print BOM
          </button>
          <button 
            onClick={exportToExcel}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all text-xs font-black shadow-lg shadow-indigo-100"
          >
            <Download size={16} /> Release Verified BOM
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-8 print:max-w-none">
          {finalBOM.length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
              <FileText size={48} className="text-slate-200 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Items Confirmed</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="bg-slate-900 text-white px-10 py-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-emerald-400" size={24} />
                  <span className="font-black text-xs uppercase tracking-[0.4em]">Verified Production Build List</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total Confirmed Items: {finalBOM.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-48">SKU / Part Number</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32 text-center">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {groupedBOM.map(([group, items]) => (
                      <React.Fragment key={group}>
                        <tr className="bg-slate-50/50">
                          <td colSpan={3} className="px-10 py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest border-y border-slate-100">
                            DESIGNATOR: {group}
                          </td>
                        </tr>
                        {items.map(part => {
                          const isUser = selectedIds.has(part.id);
                          const isDefault = part.F_Code === 0;
                          return (
                            <tr key={part.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-10 py-5 text-sm font-bold text-slate-900 font-mono">{part.Part_Number}</td>
                              <td className="px-10 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-bold text-slate-800">{part.Name}</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {part.Remarks && <span className="text-[10px] text-slate-400 italic font-medium">{part.Remarks}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-10 py-5 text-center">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1.5 border ${
                                  isDefault ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                                  'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                  {isDefault ? 'Default' : <><UserCheck size={10}/> Confirmed</>}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-8 bg-white border-t border-slate-200 text-center">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">End of Assembly Configuration Output</p>
      </div>
    </div>
  );
};

export default BOMGenerated;
