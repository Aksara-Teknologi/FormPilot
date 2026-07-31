export type FormField = {
  id: string;
  label: string;
  name?: string;
  type: string;
  required: boolean;
  sensitive?: boolean;
  options?: string[];
};

export type FieldMapping = {
  fieldId: string;
  fieldLabel: string;
  sourceKey: string | null;
  value: string | number | boolean | null;
  confidence: number;
  method: "exact" | "knowledge" | "ai" | "manual" | "random" | "blank";
  sensitive: boolean;
};

export type FormPlan = {
  targetUrl: string;
  fields: FormField[];
  mappings: FieldMapping[];
  summary: {
    total: number;
    ready: number;
    manual: number;
    aiMapped: number;
    knowledgeMapped: number;
  };
};
