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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_activity: {
        Row: {
          generation: number
          last_activity_at: string
          revoked_before: string
          user_id: string
        }
        Insert: {
          generation?: number
          last_activity_at?: string
          revoked_before?: string
          user_id: string
        }
        Update: {
          generation?: number
          last_activity_at?: string
          revoked_before?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_memberships: {
        Row: {
          granted_at: string
          singleton: boolean
          user_id: string
        }
        Insert: {
          granted_at?: string
          singleton?: boolean
          user_id: string
        }
        Update: {
          granted_at?: string
          singleton?: boolean
          user_id?: string
        }
        Relationships: []
      }
      booking_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          reservation_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details: Json
          id?: string
          reservation_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_audit_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_mutation_keys: {
        Row: {
          created_at: string
          payload: Json
          request_key: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          payload: Json
          request_key: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          request_key?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_mutation_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          reservation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
          reservation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          reservation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          booking_blocked: boolean
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          booking_blocked?: boolean
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          booking_blocked?: boolean
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          attendee_name: string
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          duration_minutes: number
          ends_at: string
          guest_name: string | null
          guest_phone: string | null
          id: string
          location_id: string
          service_id: string
          service_name: string
          staff_id: string
          starts_at: string
          status: string
          user_id: string | null
          version: number
        }
        Insert: {
          attendee_name: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_minutes: number
          ends_at: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id: string
          service_id: string
          service_name: string
          staff_id: string
          starts_at: string
          status?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          attendee_name?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          ends_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id?: string
          service_id?: string
          service_name?: string
          staff_id?: string
          starts_at?: string
          status?: string
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_template_settings: {
        Row: {
          revision: number
          singleton: boolean
          travel_gap_minutes: number
        }
        Insert: {
          revision?: number
          singleton?: boolean
          travel_gap_minutes?: number
        }
        Update: {
          revision?: number
          singleton?: boolean
          travel_gap_minutes?: number
        }
        Relationships: []
      }
      schedule_templates: {
        Row: {
          breaks: Json
          end_minute: number
          location_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          breaks?: Json
          end_minute: number
          location_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          breaks?: Json
          end_minute?: number
          location_id?: string
          start_minute?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_weeks: {
        Row: {
          draft: Json
          draft_revision: number
          published: Json | null
          published_at: string | null
          published_gap_minutes: number | null
          published_revision: number
          travel_gap_minutes: number
          updated_at: string
          week_start: string
        }
        Insert: {
          draft?: Json
          draft_revision?: number
          published?: Json | null
          published_at?: string | null
          published_gap_minutes?: number | null
          published_revision?: number
          travel_gap_minutes?: number
          updated_at?: string
          week_start: string
        }
        Update: {
          draft?: Json
          draft_revision?: number
          published?: Json | null
          published_at?: string | null
          published_gap_minutes?: number | null
          published_revision?: number
          travel_gap_minutes?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      session_access: {
        Row: {
          generation: number
          granted_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          generation: number
          granted_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          generation?: number
          granted_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      availability_context: {
        Args: { p_date: string; p_location: string; p_service: string }
        Returns: Json
      }
      cancel_reservation: {
        Args: { p_request_key: string; p_reservation: string }
        Returns: Json
      }
      confirm_reservation: {
        Args: {
          p_attendee?: string
          p_expected_revision: number
          p_location: string
          p_request_key: string
          p_service: string
          p_start: string
        }
        Returns: Json
      }
      confirm_reviewed_reservation: {
        Args: {
          p_attendee?: string
          p_expected_duration: number
          p_expected_name: string
          p_expected_revision: number
          p_location: string
          p_request_key: string
          p_service: string
          p_start: string
        }
        Returns: Json
      }
      ensure_session_access: { Args: never; Returns: boolean }
      get_my_appointments: { Args: never; Returns: Json }
      get_owner_reservations: {
        Args: { p_from: string; p_location?: string; p_to: string }
        Returns: Json
      }
      get_owner_schedule: { Args: { p_week: string }; Returns: Json }
      get_owner_schedule_template: { Args: never; Returns: Json }
      mark_booking_notification_read: {
        Args: { p_notification: string }
        Returns: string
      }
      owner_cancel_reservation: {
        Args: { p_request_key: string; p_reservation: string }
        Returns: Json
      }
      owner_create_reservation: {
        Args: {
          p_expected_duration: number
          p_expected_name: string
          p_expected_revision: number
          p_location: string
          p_name: string
          p_phone?: string
          p_request_key: string
          p_service: string
          p_start: string
        }
        Returns: Json
      }
      owner_reservation_context: {
        Args: { p_date: string; p_location: string; p_reservation: string }
        Returns: Json
      }
      owner_update_reservation: {
        Args: {
          p_expected_revision: number
          p_expected_version: number
          p_location: string
          p_name: string
          p_phone?: string
          p_request_key: string
          p_reservation: string
          p_start: string
        }
        Returns: Json
      }
      prepare_schedule_week: { Args: { p_week: string }; Returns: Json }
      publish_schedule_week: {
        Args: { p_expected_revision: number; p_week: string }
        Returns: number
      }
      published_schedule: { Args: { p_week: string }; Returns: Json }
      record_user_activity: { Args: never; Returns: boolean }
      save_owner_schedule_template: {
        Args: { p_entries: Json; p_expected_revision: number; p_gap: number }
        Returns: Json
      }
      save_schedule_draft: {
        Args: {
          p_entries: Json
          p_expected_revision: number
          p_gap: number
          p_week: string
        }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
