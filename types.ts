
export interface BOMPart {
  Part_Number: string;
  Name: string;
  Remarks: string;
  Std_Remarks: string;
  F_Code: number; // 0: Default, 1: Optional Multiple, 2: Mandatory Single, 9: Reference Only
  Ref_des: string;
  id: string; // Internal unique ID
}

export type LogicOperator = 'CONTAINS' | 'EQUALS' | 'STARTS_WITH';

export interface ConfigRule {
  id: string;
  targetPartId: string; 
  keywords: string[]; // List of keywords that must ALL be present (AND logic)
  isActive: boolean;
}

export enum AppScreen {
  BOM_TABLE = 'BOM_TABLE',
  CONFIG = 'CONFIG',
  SELECTION = 'SELECTION',
  BOM_GENERATED = 'BOM_GENERATED'
}
