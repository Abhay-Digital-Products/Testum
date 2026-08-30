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
      analysis: {
        Row: {
          ai_summary: string | null
          attempt_id: string
          created_at: string
          strong_topics: string[] | null
          study_plan: string | null
          subject_breakdown: Json
          updated_at: string
          weak_topics: string[] | null
        }
        Insert: {
          ai_summary?: string | null
          attempt_id: string
          created_at?: string
          strong_topics?: string[] | null
          study_plan?: string | null
          subject_breakdown?: Json
          updated_at?: string
          weak_topics?: string[] | null
        }
        Update: {
          ai_summary?: string | null
          attempt_id?: string
          created_at?: string
          strong_topics?: string[] | null
          study_plan?: string | null
          subject_breakdown?: Json
          updated_at?: string
          weak_topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option: string | null
          status: Database["public"]["Enums"]["answer_status"]
          time_spent_seconds: number
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option?: string | null
          status?: Database["public"]["Enums"]["answer_status"]
          time_spent_seconds?: number
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option?: string | null
          status?: Database["public"]["Enums"]["answer_status"]
          time_spent_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          score: number
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submitted_at: string | null
          test_id: string
          time_spent_seconds: number
          unattempted_count: number
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          test_id: string
          time_spent_seconds?: number
          unattempted_count?: number
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          score?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submitted_at?: string | null
          test_id?: string
          time_spent_seconds?: number
          unattempted_count?: number
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          plan_code: Database["public"]["Enums"]["plan_code"]
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          plan_code: Database["public"]["Enums"]["plan_code"]
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          plan_code?: Database["public"]["Enums"]["plan_code"]
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_popups: {
        Row: {
          button_text: string | null
          coupon_code: string | null
          created_at: string
          display_frequency: string
          id: string
          image_url: string
          is_active: boolean
          target_audience: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          button_text?: string | null
          coupon_code?: string | null
          created_at?: string
          display_frequency?: string
          id?: string
          image_url: string
          is_active?: boolean
          target_audience?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          button_text?: string | null
          coupon_code?: string | null
          created_at?: string
          display_frequency?: string
          id?: string
          image_url?: string
          is_active?: boolean
          target_audience?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_inr: number
          cf_order_id: string | null
          cf_payment_session_id: string | null
          created_at: string
          id: string
          plan_code: Database["public"]["Enums"]["plan_code"]
          raw: Json | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          cf_order_id?: string | null
          cf_payment_session_id?: string | null
          created_at?: string
          id?: string
          plan_code: Database["public"]["Enums"]["plan_code"]
          raw?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          cf_order_id?: string | null
          cf_payment_session_id?: string | null
          created_at?: string
          id?: string
          plan_code?: Database["public"]["Enums"]["plan_code"]
          raw?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: Database["public"]["Enums"]["plan_code"]
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          price_inr: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          price_inr: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          price_inr?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          mobile: string | null
          student_class: Database["public"]["Enums"]["student_class"] | null
          target_year: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          mobile?: string | null
          student_class?: Database["public"]["Enums"]["student_class"] | null
          target_year?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          mobile?: string | null
          student_class?: Database["public"]["Enums"]["student_class"] | null
          target_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          chapter: string | null
          correct_option: string
          created_at: string
          id: string
          option_type: Database["public"]["Enums"]["option_type"]
          options: Json
          order_index: number
          question_image_url: string | null
          question_text: string | null
          solution_image_url: string | null
          solution_text: string | null
          solution_video_url: string | null
          subject: Database["public"]["Enums"]["subject"]
          test_id: string
          updated_at: string
        }
        Insert: {
          chapter?: string | null
          correct_option: string
          created_at?: string
          id?: string
          option_type?: Database["public"]["Enums"]["option_type"]
          options?: Json
          order_index: number
          question_image_url?: string | null
          question_text?: string | null
          solution_image_url?: string | null
          solution_text?: string | null
          solution_video_url?: string | null
          subject: Database["public"]["Enums"]["subject"]
          test_id: string
          updated_at?: string
        }
        Update: {
          chapter?: string | null
          correct_option?: string
          created_at?: string
          id?: string
          option_type?: Database["public"]["Enums"]["option_type"]
          options?: Json
          order_index?: number
          question_image_url?: string | null
          question_text?: string | null
          solution_image_url?: string | null
          solution_text?: string | null
          solution_video_url?: string | null
          subject?: Database["public"]["Enums"]["subject"]
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_series: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["series_kind"]
          plan_code: Database["public"]["Enums"]["plan_code"] | null
          planner_pdf_url: string | null
          subject: Database["public"]["Enums"]["subject"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["series_kind"]
          plan_code?: Database["public"]["Enums"]["plan_code"] | null
          planner_pdf_url?: string | null
          subject?: Database["public"]["Enums"]["subject"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["series_kind"]
          plan_code?: Database["public"]["Enums"]["plan_code"] | null
          planner_pdf_url?: string | null
          subject?: Database["public"]["Enums"]["subject"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          marks_correct: number
          marks_wrong: number
          opens_at: string
          series_id: string
          subject_scope: string[]
          title: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          marks_correct?: number
          marks_wrong?: number
          opens_at?: string
          series_id: string
          subject_scope?: string[]
          title: string
          total_questions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          marks_correct?: number
          marks_wrong?: number
          opens_at?: string
          series_id?: string
          subject_scope?: string[]
          title?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
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
      has_access: {
        Args: {
          _plan: Database["public"]["Enums"]["plan_code"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      answer_status:
        | "not_visited"
        | "not_answered"
        | "answered"
        | "marked"
        | "answered_marked"
      app_role: "admin" | "student"
      attempt_status: "in_progress" | "submitted" | "expired"
      option_type: "image" | "text"
      order_status: "created" | "paid" | "failed" | "cancelled"
      plan_code: "chapter" | "part" | "full" | "combo"
      series_kind: "chapter" | "part" | "full"
      student_class: "11th" | "12th" | "dropper"
      subject: "physics" | "chemistry" | "biology" | "mixed"
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
      answer_status: [
        "not_visited",
        "not_answered",
        "answered",
        "marked",
        "answered_marked",
      ],
      app_role: ["admin", "student"],
      attempt_status: ["in_progress", "submitted", "expired"],
      option_type: ["image", "text"],
      order_status: ["created", "paid", "failed", "cancelled"],
      plan_code: ["chapter", "part", "full", "combo"],
      series_kind: ["chapter", "part", "full"],
      student_class: ["11th", "12th", "dropper"],
      subject: ["physics", "chemistry", "biology", "mixed"],
    },
  },
} as const
