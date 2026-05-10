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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      business_hours: {
        Row: {
          settings: Json | null
          user_id: string
        }
        Insert: {
          settings?: Json | null
          user_id: string
        }
        Update: {
          settings?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      buy_items: {
        Row: {
          cost: number | null
          current_qty: number | null
          days_cover: number | null
          done: boolean | null
          emoji: string | null
          id: string
          name: string | null
          note: string | null
          reason: string | null
          rec_qty: number | null
          source: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          current_qty?: number | null
          days_cover?: number | null
          done?: boolean | null
          emoji?: string | null
          id: string
          name?: string | null
          note?: string | null
          reason?: string | null
          rec_qty?: number | null
          source?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          cost?: number | null
          current_qty?: number | null
          days_cover?: number | null
          done?: boolean | null
          emoji?: string | null
          id?: string
          name?: string | null
          note?: string | null
          reason?: string | null
          rec_qty?: number | null
          source?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          created_at: string
          from: string | null
          id: number
          text: string | null
          ts: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          from?: string | null
          id: number
          text?: string | null
          ts?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          from?: string | null
          id?: number
          text?: string | null
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cooking_logs: {
        Row: {
          batch_unit: string | null
          batches: number | null
          created_at: string
          id: number
          product_emoji: string | null
          product_id: string | null
          product_name: string | null
          ts: number | null
          user_id: string
        }
        Insert: {
          batch_unit?: string | null
          batches?: number | null
          created_at?: string
          id: number
          product_emoji?: string | null
          product_id?: string | null
          product_name?: string | null
          ts?: number | null
          user_id: string
        }
        Update: {
          batch_unit?: string | null
          batches?: number | null
          created_at?: string
          id?: number
          product_emoji?: string | null
          product_id?: string | null
          product_name?: string | null
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      opex_entries: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string
          desc: string | null
          id: number
          paid_from_petty: boolean | null
          time: string | null
          ts: number | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string
          desc?: string | null
          id: number
          paid_from_petty?: boolean | null
          time?: string | null
          ts?: number | null
          user_id: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string
          desc?: string | null
          id?: number
          paid_from_petty?: boolean | null
          time?: string | null
          ts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      outlet_settings: {
        Row: {
          settings: Json | null
          user_id: string
        }
        Insert: {
          settings?: Json | null
          user_id: string
        }
        Update: {
          settings?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      petty_entries: {
        Row: {
          amount: number | null
          balance: number | null
          created_at: string
          desc: string | null
          emoji: string | null
          id: number
          time: string | null
          ts: number | null
          type: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          balance?: number | null
          created_at?: string
          desc?: string | null
          emoji?: string | null
          id: number
          time?: string | null
          ts?: number | null
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          balance?: number | null
          created_at?: string
          desc?: string | null
          emoji?: string | null
          id?: number
          time?: string | null
          ts?: number | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      petty_settings: {
        Row: {
          monthly_limit: number | null
          user_id: string
        }
        Insert: {
          monthly_limit?: number | null
          user_id: string
        }
        Update: {
          monthly_limit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          batches_from_ingredients: number | null
          category: string | null
          cooking_frequency_days: number | null
          cost_per_unit: number | null
          description: string | null
          emoji: string | null
          id: string
          ingredients: Json | null
          margin: number | null
          name: string | null
          note: string | null
          packaging: Json | null
          serving_unit: string | null
          servings_per_batch: number | null
          suggested_price: number | null
          target_profit_scale: number | null
          total_cost: number | null
          user_id: string
        }
        Insert: {
          batches_from_ingredients?: number | null
          category?: string | null
          cooking_frequency_days?: number | null
          cost_per_unit?: number | null
          description?: string | null
          emoji?: string | null
          id: string
          ingredients?: Json | null
          margin?: number | null
          name?: string | null
          note?: string | null
          packaging?: Json | null
          serving_unit?: string | null
          servings_per_batch?: number | null
          suggested_price?: number | null
          target_profit_scale?: number | null
          total_cost?: number | null
          user_id: string
        }
        Update: {
          batches_from_ingredients?: number | null
          category?: string | null
          cooking_frequency_days?: number | null
          cost_per_unit?: number | null
          description?: string | null
          emoji?: string | null
          id?: string
          ingredients?: Json | null
          margin?: number | null
          name?: string | null
          note?: string | null
          packaging?: Json | null
          serving_unit?: string | null
          servings_per_batch?: number | null
          suggested_price?: number | null
          target_profit_scale?: number | null
          total_cost?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_cards: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          ewallet_phone: string | null
          ewallet_provider: string | null
          id: string
          is_primary: boolean | null
          nickname: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          ewallet_phone?: string | null
          ewallet_provider?: string | null
          id: string
          is_primary?: boolean | null
          nickname?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          ewallet_phone?: string | null
          ewallet_provider?: string | null
          id?: string
          is_primary?: boolean | null
          nickname?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          category: string | null
          emoji: string | null
          id: string
          last_restocked_at: string | null
          last_used_at: string | null
          max_qty: number | null
          min_qty: number | null
          name: string | null
          qty: number | null
          restock_qty: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          emoji?: string | null
          id: string
          last_restocked_at?: string | null
          last_used_at?: string | null
          max_qty?: number | null
          min_qty?: number | null
          name?: string | null
          qty?: number | null
          restock_qty?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          emoji?: string | null
          id?: string
          last_restocked_at?: string | null
          last_used_at?: string | null
          max_qty?: number | null
          min_qty?: number | null
          name?: string | null
          qty?: number | null
          restock_qty?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number | null
          created_at: string
          emoji: string | null
          id: number
          label: string | null
          time: string | null
          ts: number | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          emoji?: string | null
          id: number
          label?: string | null
          time?: string | null
          ts?: number | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          emoji?: string | null
          id?: number
          label?: string | null
          time?: string | null
          ts?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
