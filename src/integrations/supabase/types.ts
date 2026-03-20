export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      breakout_companies: {
        Row: {
          created_at: string
          id: string
          mapped_data: Json | null
          raw_data: Json | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_data?: Json | null
          raw_data?: Json | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapped_data?: Json | null
          raw_data?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakout_companies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "breakout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_leads: {
        Row: {
          background: string | null
          company: string | null
          created_at: string
          email: string | null
          expertise_tags: Json | null
          id: string
          linkedin_url: string | null
          name: string | null
          profile_pdf_url: string | null
          session_id: string
          title: string | null
          website: string | null
        }
        Insert: {
          background?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise_tags?: Json | null
          id?: string
          linkedin_url?: string | null
          name?: string | null
          profile_pdf_url?: string | null
          session_id: string
          title?: string | null
          website?: string | null
        }
        Update: {
          background?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise_tags?: Json | null
          id?: string
          linkedin_url?: string | null
          name?: string | null
          profile_pdf_url?: string | null
          session_id?: string
          title?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breakout_leads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "breakout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_sessions: {
        Row: {
          allow_stage_mixing: boolean | null
          avoid_competitors: boolean | null
          breakout_end: string | null
          breakout_start: string | null
          column_mapping: Json | null
          created_at: string
          grouping_priority: string | null
          id: string
          lead_matching_mode: string | null
          num_tables: number | null
          prompts: Json | null
          round_settings: Json
          session_date: string | null
          session_format: string | null
          session_name: string
          status: string | null
          target_per_table: number | null
          updated_at: string
        }
        Insert: {
          allow_stage_mixing?: boolean | null
          avoid_competitors?: boolean | null
          breakout_end?: string | null
          breakout_start?: string | null
          column_mapping?: Json | null
          created_at?: string
          grouping_priority?: string | null
          id?: string
          lead_matching_mode?: string | null
          num_tables?: number | null
          prompts?: Json | null
          round_settings?: Json
          session_date?: string | null
          session_format?: string | null
          session_name?: string
          status?: string | null
          target_per_table?: number | null
          updated_at?: string
        }
        Update: {
          allow_stage_mixing?: boolean | null
          avoid_competitors?: boolean | null
          breakout_end?: string | null
          breakout_start?: string | null
          column_mapping?: Json | null
          created_at?: string
          grouping_priority?: string | null
          id?: string
          lead_matching_mode?: string | null
          num_tables?: number | null
          prompts?: Json | null
          round_settings?: Json
          session_date?: string | null
          session_format?: string | null
          session_name?: string
          status?: string | null
          target_per_table?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      breakout_table_assignments: {
        Row: {
          company_id: string
          id: string
          table_id: string
        }
        Insert: {
          company_id: string
          id?: string
          table_id: string
        }
        Update: {
          company_id?: string
          id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakout_table_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "breakout_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breakout_table_assignments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "breakout_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_tables: {
        Row: {
          briefing_content: string | null
          created_at: string
          id: string
          rationale: string | null
          round_number: number
          session_id: string
          shared_challenges: Json | null
          stage_mix: string | null
          suggested_lead: string | null
          table_name: string | null
          table_number: number
          theme: string | null
        }
        Insert: {
          briefing_content?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          round_number?: number
          session_id: string
          shared_challenges?: Json | null
          stage_mix?: string | null
          suggested_lead?: string | null
          table_name?: string | null
          table_number: number
          theme?: string | null
        }
        Update: {
          briefing_content?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          round_number?: number
          session_id?: string
          shared_challenges?: Json | null
          stage_mix?: string | null
          suggested_lead?: string | null
          table_name?: string | null
          table_number?: number
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breakout_tables_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "breakout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pool: {
        Row: {
          background: string | null
          company: string | null
          created_at: string
          email: string | null
          expertise_tags: Json | null
          id: string
          linkedin_url: string | null
          name: string
          title: string | null
          website: string | null
        }
        Insert: {
          background?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise_tags?: Json | null
          id?: string
          linkedin_url?: string | null
          name: string
          title?: string | null
          website?: string | null
        }
        Update: {
          background?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise_tags?: Json | null
          id?: string
          linkedin_url?: string | null
          name?: string
          title?: string | null
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_password: {
        Args: { _password: string; _user_id: string }
        Returns: undefined
      }
      assign_initial_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "viewer"],
    },
  },
} as const
