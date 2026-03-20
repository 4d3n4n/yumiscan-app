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
      allergens: {
        Row: {
          created_at: string
          id: string
          ingredients: string[] | null
          ingredients_en: string[] | null
          name: string
          name_en: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredients?: string[] | null
          ingredients_en?: string[] | null
          name: string
          name_en?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredients?: string[] | null
          ingredients_en?: string[] | null
          name?: string
          name_en?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      paywall_hits: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_offers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          credits: number
          discount_price_cents: number | null
          full_price_cents: number
          id: string
          stripe_price_id_discount: string | null
          stripe_price_id_full: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          credits: number
          discount_price_cents?: number | null
          full_price_cents: number
          id?: string
          stripe_price_id_discount?: string | null
          stripe_price_id_full?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          credits?: number
          discount_price_cents?: number | null
          full_price_cents?: number
          id?: string
          stripe_price_id_discount?: string | null
          stripe_price_id_full?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          assistant_cache_json: Json | null
          assistant_tts_cache_json: Json | null
          certified_raw_text: string | null
          created_at: string
          credit_consumed_type: string | null
          debug_json: Json | null
          gemini_request_count: number
          id: string
          image_storage_path: string | null
          ocr_request_count: number
          performance_json: Json | null
          phase09_executed: boolean
          pipeline_version: string | null
          processing_error: string | null
          processing_status: string
          product_status: string | null
          result_json: Json
          selected_allergen_ids: string[] | null
          user_id: string
        }
        Insert: {
          assistant_cache_json?: Json | null
          assistant_tts_cache_json?: Json | null
          certified_raw_text?: string | null
          created_at?: string
          credit_consumed_type?: string | null
          debug_json?: Json | null
          gemini_request_count?: number
          id?: string
          image_storage_path?: string | null
          ocr_request_count?: number
          performance_json?: Json | null
          phase09_executed?: boolean
          pipeline_version?: string | null
          processing_error?: string | null
          processing_status?: string
          product_status?: string | null
          result_json?: Json
          selected_allergen_ids?: string[] | null
          user_id: string
        }
        Update: {
          assistant_cache_json?: Json | null
          assistant_tts_cache_json?: Json | null
          certified_raw_text?: string | null
          created_at?: string
          credit_consumed_type?: string | null
          debug_json?: Json | null
          gemini_request_count?: number
          id?: string
          image_storage_path?: string | null
          ocr_request_count?: number
          performance_json?: Json | null
          phase09_executed?: boolean
          pipeline_version?: string | null
          processing_error?: string | null
          processing_status?: string
          product_status?: string | null
          result_json?: Json
          selected_allergen_ids?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          accepted_cgu_at: string | null
          accepted_cgu_version: string | null
          accepted_health_disclaimer: boolean | null
          created_at: string
          daily_credit_used_at: string | null
          first_name: string
          free_scans_used: number
          id: string
          is_admin: boolean
          last_name: string
          paid_scans_used: number
          preferences: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_cgu_at?: string | null
          accepted_cgu_version?: string | null
          accepted_health_disclaimer?: boolean | null
          created_at?: string
          daily_credit_used_at?: string | null
          first_name?: string
          free_scans_used?: number
          id?: string
          is_admin?: boolean
          last_name?: string
          paid_scans_used?: number
          preferences?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_cgu_at?: string | null
          accepted_cgu_version?: string | null
          accepted_health_disclaimer?: boolean | null
          created_at?: string
          daily_credit_used_at?: string | null
          first_name?: string
          free_scans_used?: number
          id?: string
          is_admin?: boolean
          last_name?: string
          paid_scans_used?: number
          preferences?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          amount_cents: number | null
          created_at: string
          credits_added: number
          id: string
          plan: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          credits_added: number
          id?: string
          plan: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          credits_added?: number
          id?: string
          plan?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_count_users: {
        Args: { p_admin_user_id: string; p_search?: string }
        Returns: number
      }
      admin_delete_auth_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_get_user_email: { Args: { p_user_id: string }; Returns: string }
      admin_list_users: {
        Args: {
          p_admin_user_id: string
          p_page?: number
          p_per_page?: number
          p_search?: string
        }
        Returns: {
          created_at: string
          email: string
          first_name: string
          free_scans_used: number
          id: string
          last_name: string
          paid_credits_purchased: number
          paid_scans_used: number
          scans_count: number
        }[]
      }
      consume_scan_credit_and_finalize_scan: {
        Args: {
          p_certified_raw_text?: string
          p_debug_json?: Json
          p_gemini_request_count?: number
          p_ocr_request_count?: number
          p_phase09_executed?: boolean
          p_pipeline_version?: string
          p_product_status: string
          p_result_json: Json
          p_scan_id: string
          p_selected_allergen_ids?: string[]
          p_user_id: string
        }
        Returns: {
          credit_consumed_type: string
          scan_id: string
        }[]
      }
      consume_scan_credit_and_insert_scan: {
        Args: {
          p_certified_raw_text?: string
          p_gemini_request_count?: number
          p_ocr_request_count?: number
          p_phase09_executed?: boolean
          p_pipeline_version?: string
          p_product_status: string
          p_result_json: Json
          p_selected_allergen_ids?: string[]
          p_user_id: string
        }
        Returns: {
          credit_consumed_type: string
          scan_id: string
        }[]
      }
      sentry_get_discord_thread: {
        Args: { p_sentry_issue_id: string }
        Returns: string
      }
      sentry_register_webhook_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      sentry_upsert_discord_thread: {
        Args: {
          p_discord_thread_id: string
          p_sentry_issue_id: string
          p_sentry_issue_url: string
          p_status: string
          p_updated_at: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
