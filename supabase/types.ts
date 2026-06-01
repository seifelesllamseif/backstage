// Generated via `mcp__supabase__generate_typescript_types` against project
// nkvgvfdmtvdabtpppanj. Regenerate when the public schema changes.

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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          company_id: string
          created_at: string
          current_status: string | null
          done_so_far: string | null
          file_links: string | null
          from_member_id: string | null
          gotchas: string | null
          id: string
          status: Database["public"]["Enums"]["handoff_status"]
          still_left: string | null
          task_id: string
          to_member_id: string | null
          updated_at: string
          what_it_is: string | null
          who_to_ask: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_status?: string | null
          done_so_far?: string | null
          file_links?: string | null
          from_member_id?: string | null
          gotchas?: string | null
          id?: string
          status?: Database["public"]["Enums"]["handoff_status"]
          still_left?: string | null
          task_id: string
          to_member_id?: string | null
          updated_at?: string
          what_it_is?: string | null
          who_to_ask?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_status?: string | null
          done_so_far?: string | null
          file_links?: string | null
          from_member_id?: string | null
          gotchas?: string | null
          id?: string
          status?: Database["public"]["Enums"]["handoff_status"]
          still_left?: string | null
          task_id?: string
          to_member_id?: string | null
          updated_at?: string
          what_it_is?: string | null
          who_to_ask?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string | null
          company_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_external_refs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["external_ref_kind"]
          label: string | null
          project_id: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["external_ref_kind"]
          label?: string | null
          project_id: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["external_ref_kind"]
          label?: string | null
          project_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_external_ref_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_external_ref_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_external_ref_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          github_repo: string | null
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["project_kind"]
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          github_repo?: string | null
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["project_kind"]
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          github_repo?: string | null
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["project_kind"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          last_used_at: string | null
          member_id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          last_used_at?: string | null
          member_id: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          last_used_at?: string | null
          member_id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_tasks: {
        Row: {
          sprint_id: string
          task_id: string
        }
        Insert: {
          sprint_id: string
          task_id: string
        }
        Update: {
          sprint_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_task_cycle_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_task_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          doc_url: string | null
          from_date: string
          id: string
          name: string
          number: number
          project_id: string
          status: Database["public"]["Enums"]["sprint_status"]
          to_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          doc_url?: string | null
          from_date: string
          id?: string
          name: string
          number: number
          project_id: string
          status?: Database["public"]["Enums"]["sprint_status"]
          to_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          doc_url?: string | null
          from_date?: string
          id?: string
          name?: string
          number?: number
          project_id?: string
          status?: Database["public"]["Enums"]["sprint_status"]
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          id: string
          is_done: boolean
          sort_order: number
          task_id: string
          text: string
        }
        Insert: {
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id: string
          text: string
        }
        Update: {
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_item_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comment_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comment_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          company_id: string
          created_at: string
          depends_on_task_id: string
          id: string
          kind: Database["public"]["Enums"]["relation_kind"]
          task_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          depends_on_task_id: string
          id?: string
          kind: Database["public"]["Enums"]["relation_kind"]
          task_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          depends_on_task_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["relation_kind"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependency_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependency_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_external_refs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["external_ref_kind"]
          label: string | null
          task_id: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["external_ref_kind"]
          label?: string | null
          task_id: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["external_ref_kind"]
          label?: string | null
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_external_ref_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_external_ref_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_external_ref_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          label_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_watchers: {
        Row: {
          invited_at: string
          invited_by: string | null
          member_id: string
          task_id: string
        }
        Insert: {
          invited_at?: string
          invited_by?: string | null
          member_id: string
          task_id: string
        }
        Update: {
          invited_at?: string
          invited_by?: string | null
          member_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_watchers_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_watchers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_watchers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          ref: string | null
          seq_number: number | null
          sort_order: number | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          ref?: string | null
          seq_number?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          ref?: string | null
          seq_number?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          access_tier: Database["public"]["Enums"]["access_tier"]
          activity_status: Database["public"]["Enums"]["activity_status"]
          avatar_url: string | null
          bio: string | null
          company_id: string
          contact_email: string | null
          created_at: string
          email: string
          full_name: string
          headline: string | null
          id: string
          languages: string[]
          last_seen_at: string | null
          onboarding_step: number
          profile_theme: string | null
          role_focus: string | null
          skills: Json | null
          slug: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_whatsapp: string | null
          timezone: string | null
          work_links: Json | null
          work_style: string | null
        }
        Insert: {
          access_tier?: Database["public"]["Enums"]["access_tier"]
          activity_status?: Database["public"]["Enums"]["activity_status"]
          avatar_url?: string | null
          bio?: string | null
          company_id: string
          contact_email?: string | null
          created_at?: string
          email: string
          full_name: string
          headline?: string | null
          id: string
          languages?: string[]
          last_seen_at?: string | null
          onboarding_step?: number
          profile_theme?: string | null
          role_focus?: string | null
          skills?: Json | null
          slug?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          timezone?: string | null
          work_links?: Json | null
          work_style?: string | null
        }
        Update: {
          access_tier?: Database["public"]["Enums"]["access_tier"]
          activity_status?: Database["public"]["Enums"]["activity_status"]
          avatar_url?: string | null
          bio?: string | null
          company_id?: string
          contact_email?: string | null
          created_at?: string
          email?: string
          full_name?: string
          headline?: string | null
          id?: string
          languages?: string[]
          last_seen_at?: string | null
          onboarding_step?: number
          profile_theme?: string | null
          role_focus?: string | null
          skills?: Json | null
          slug?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          timezone?: string | null
          work_links?: Json | null
          work_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_member_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      access_tier: "admin" | "lead" | "member"
      activity_status: "active" | "away" | "on_vacation" | "left"
      external_ref_kind:
        | "issue"
        | "pr"
        | "commit"
        | "doc"
        | "link"
        | "supabase"
        | "github"
        | "figma"
        | "verbivore"
        | "vercel"
        | "bunny"
        | "sentry"
        | "gcloud"
        | "stripe"
      handoff_status: "in_progress" | "blocked" | "ready_for_review" | "done"
      project_kind: "standard" | "operations"
      relation_kind: "blocked_by" | "blocks" | "parent" | "sub_issue" | "triage"
      sprint_status: "completed" | "current" | "upcoming"
      task_priority: "urgent" | "high" | "medium" | "low" | "none"
      task_status:
        | "backlog"
        | "unscoped"
        | "todo"
        | "in_progress"
        | "in_review"
        | "done"
        | "canceled"
        | "duplicate"
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
      access_tier: ["admin", "lead", "member"],
      activity_status: ["active", "away", "on_vacation", "left"],
      external_ref_kind: [
        "issue",
        "pr",
        "commit",
        "doc",
        "link",
        "supabase",
        "github",
        "figma",
        "verbivore",
        "vercel",
        "bunny",
        "sentry",
        "gcloud",
        "stripe",
      ],
      handoff_status: ["in_progress", "blocked", "ready_for_review", "done"],
      project_kind: ["standard", "operations"],
      relation_kind: ["blocked_by", "blocks", "parent", "sub_issue", "triage"],
      sprint_status: ["completed", "current", "upcoming"],
      task_priority: ["urgent", "high", "medium", "low", "none"],
      task_status: [
        "backlog",
        "unscoped",
        "todo",
        "in_progress",
        "in_review",
        "done",
        "canceled",
        "duplicate",
      ],
    },
  },
} as const
