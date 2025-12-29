
import React, { useRef, useState, useMemo } from 'react';
import { BOMPart } from '../types';
import { Upload, Table as TableIcon, Trash2, ArrowRight, Search, FileSpreadsheet } from 'lucide-react';

interface Props {
  parts: BOMPart[];
  onPartsUpdate: (parts: BOMPart[]) => void;
  onNavigate: () => void;
  onClearAll: () => void;
}

const BOMTable: React.FC<Props> = ({ parts, onPartsUpdate, onNavigate, onClearAll }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParts = useMemo(() => {
    return parts.filter(p => 
      p.Part_Number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Ref_des.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [parts, searchTerm]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = (window as any).XLSX.utils.sheet_to_json(ws);

      const mappedParts: BOMPart[] = data.map((row: any, index: number) => ({
        id: `part-${Date.now()}-${index}`,
        Part_Number: String(row.Part_Number || ''),
        Name: String(row.Name || ''),
        Remarks: String(row.Remarks || ''),
        Std_Remarks: String(row.Std_Remarks || ''),
        F_Code: isNaN(parseInt(row.F_Code)) ? 0 : parseInt(row.F_Code),
        Ref_des: String(row.Ref_des || ''),
      }));

      onPartsUpdate(mappedParts);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <FileSpreadsheet className="text-indigo-600" />
            Master BOM Repository
          </h2>
          <p className="text-sm text-slate-500">Engineering data management and SKU validation.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-bold shadow-sm"
          >
            <Upload size={16} /> Import Master BOM
          </button>
          {parts.length > 0 && (
            <button
              onClick={onNavigate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-bold shadow-sm"
            >
              Configure Logic <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Search SKUs, names, or reference designators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        {parts.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} /> Reset System
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {parts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-slate-300">
            <TableIcon size={80} strokeWidth={1} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">BOM Data Not Loaded</p>
            <p className="text-sm">Please import an Excel file to begin configuration.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="w-40 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Part Number</th>
                <th className="w-1/4 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Remarks</th>
                <th className="w-24 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">F Code</th>
                <th className="w-32 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref Des</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredParts.map((part) => (
                <tr key={part.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3 text-sm font-bold text-indigo-700 font-mono">{part.Part_Number}</td>
                  <td className="px-6 py-3 text-sm text-slate-900 font-medium">{part.Name}</td>
                  <td className="px-6 py-3 text-xs text-slate-500 italic">
                    <span className="block truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:z-20 bg-inherit">{part.Remarks}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-black tracking-tighter
                      ${part.F_Code === 0 ? 'bg-indigo-100 text-indigo-700' : 
                        part.F_Code === 1 ? 'bg-amber-100 text-amber-700' : 
                        part.F_Code === 9 ? 'bg-slate-100 text-slate-400 border border-slate-200' :
                        'bg-emerald-100 text-emerald-700'}`}>
                      CODE {part.F_Code}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 font-bold">{part.Ref_des || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="p-4 bg-white border-t border-slate-200 text-[10px] text-slate-400 flex justify-between font-bold uppercase tracking-widest">
        <div className="flex gap-4">
          <span>0: Default</span>
          <span>1: Optional</span>
          <span>2: Mandatory</span>
          <span>9: Reference Only</span>
        </div>
        <span>Total Records: {parts.length} | Shown: {filteredParts.length}</span>
      </div>
    </div>
  );
};

export default BOMTable;
