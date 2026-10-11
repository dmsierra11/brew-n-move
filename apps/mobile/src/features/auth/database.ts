export type Database = {
  public: {
    Tables: {
      legal_documents: {
        Row: {
          id: string;
          kind: 'terms' | 'privacy';
          version: string;
          title: string;
          body: string;
          is_current: boolean;
          published_at: string;
        };
        Insert: {
          id?: string;
          kind: 'terms' | 'privacy';
          version: string;
          title: string;
          body: string;
          is_current?: boolean;
          published_at?: string;
        };
        Update: {
          id?: string;
          kind?: 'terms' | 'privacy';
          version?: string;
          title?: string;
          body?: string;
          is_current?: boolean;
          published_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          first_name: string;
          display_name: string;
          terms_version: string;
          privacy_version: string;
          terms_accepted_at: string;
          privacy_acknowledged_at: string;
          timezone: string;
          region: string;
          email_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          display_name: string;
          terms_version: string;
          privacy_version: string;
          terms_accepted_at?: string;
          privacy_acknowledged_at?: string;
          timezone: string;
          region: string;
          email_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
      member_balances: {
        Row: {
          member_id: string;
          balance: number;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          balance?: number;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      step_validations: {
        Row: {
          id: string;
          member_id: string;
          local_date: string;
          timezone: string;
          step_total: number;
          source_platform: 'apple_health' | 'health_connect';
          awarded_points: number;
          validated_at: string;
          window_start: string;
          window_end: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          local_date: string;
          timezone: string;
          step_total: number;
          source_platform: 'apple_health' | 'health_connect';
          awarded_points: number;
          validated_at?: string;
          window_start: string;
          window_end: string;
        };
        Update: {
          step_total?: number;
          source_platform?: 'apple_health' | 'health_connect';
          awarded_points?: number;
          validated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
