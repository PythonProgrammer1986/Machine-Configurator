
export interface BOMPart {
  Part_Number: string;
  Name: string;
  Remarks: string;
  Std_Remarks: string;
  F_Code: number; // 0: Default, 1: Optional Multiple, 2: Mandatory Single, 9: Reference Only
  Ref_des: string;
  id: string; // Internal unique ID
}

export interface RuleLogic {
  includes: string[];  // AND conditions (must all be present)
  excludes: string[];  // NOT conditions (must all be absent)
  orGroups: string[][]; // OR groups (at least one from each group must be present)
  raw: string;         // Original string for display/editing
}

export interface ConfigRule {
  id: string;
  targetPartId: string; 
  logic: RuleLogic;
  isActive: boolean;
}

export enum AppScreen {
  BOM_TABLE = 'BOM_TABLE',
  CONFIG = 'CONFIG',
  SELECTION = 'SELECTION',
  BOM_GENERATED = 'BOM_GENERATED'
}
