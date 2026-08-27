// src/data/database.types.ts
//
// GENERATED from the live Supabase schema (project cdmbaujqfnknilruuhht) via the
// Supabase MCP. Do not edit by hand — regenerate after any migration. See
// scripts/README.md.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      leads: {
        Row: {
          agent_label: string | null;
          consent: boolean;
          created_at: string;
          email: string;
          id: string;
          scorecard_id: string | null;
          source: string;
        };
        Insert: {
          agent_label?: string | null;
          consent?: boolean;
          created_at?: string;
          email: string;
          id?: string;
          scorecard_id?: string | null;
          source?: string;
        };
        Update: {
          agent_label?: string | null;
          consent?: boolean;
          created_at?: string;
          email?: string;
          id?: string;
          scorecard_id?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_scorecard_id_fkey';
            columns: ['scorecard_id'];
            isOneToOne: false;
            referencedRelation: 'scorecards';
            referencedColumns: ['id'];
          },
        ];
      };
      scorecards: {
        Row: {
          agent_label: string;
          corpus_version: string;
          created_at: string;
          decided: number;
          fell: number;
          id: string;
          partial: number;
          resistance_score: number | null;
          resisted: number;
          results: Json;
        };
        Insert: {
          agent_label: string;
          corpus_version: string;
          created_at?: string;
          decided: number;
          fell: number;
          id?: string;
          partial: number;
          resistance_score?: number | null;
          resisted: number;
          results?: Json;
        };
        Update: {
          agent_label?: string;
          corpus_version?: string;
          created_at?: string;
          decided?: number;
          fell?: number;
          id?: string;
          partial?: number;
          resistance_score?: number | null;
          resisted?: number;
          results?: Json;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
