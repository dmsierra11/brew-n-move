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
      partners: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          partner_id: string;
          name: string;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          name: string;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
        };
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          location_id: string;
          slug: string;
          title: string;
          value_label: string;
          points_cost: number;
          description: string;
          list_price_cents: number;
          pay_price_cents: number;
          collect_start: string | null;
          collect_end: string | null;
          image_url: string | null;
          quantity: number | null;
          expires_at: string | null;
          status: 'active' | 'paused' | 'removed';
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          slug: string;
          title: string;
          value_label: string;
          points_cost: number;
          description: string;
          list_price_cents: number;
          pay_price_cents: number;
          collect_start?: string | null;
          collect_end?: string | null;
          image_url?: string | null;
          quantity?: number | null;
          expires_at?: string | null;
          status?: 'active' | 'paused' | 'removed';
          created_at?: string;
        };
        Update: {
          title?: string;
          value_label?: string;
          points_cost?: number;
          description?: string;
          list_price_cents?: number;
          pay_price_cents?: number;
          collect_start?: string | null;
          collect_end?: string | null;
          image_url?: string | null;
          quantity?: number | null;
          expires_at?: string | null;
          status?: 'active' | 'paused' | 'removed';
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          member_id: string;
          partner_id: string;
          location_id: string;
          offer_id: string;
          partner_name: string;
          location_name: string;
          offer_title: string;
          points_spent: number;
          value_label: string;
          redeemed_at: string;
          till_confirmed_at: string | null;
          client_request_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      step_validations: {
        Row: {
          id: string;
          member_id: string;
          local_date: string;
          timezone: string;
          step_total: number | null;
          source_platform: 'apple_health' | 'health_connect';
          awarded_points: number;
          validated_at: string;
          window_start: string;
          window_end: string;
          anchor_id: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          local_date: string;
          timezone: string;
          step_total?: number | null;
          source_platform: 'apple_health' | 'health_connect';
          awarded_points: number;
          validated_at?: string;
          window_start: string;
          window_end: string;
          anchor_id?: string;
        };
        Update: {
          step_total?: number | null;
          source_platform?: 'apple_health' | 'health_connect';
          awarded_points?: number;
          validated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      catalog_offers: {
        Row: {
          id: string;
          slug: string;
          partner_name: string;
          location_name: string;
          title: string;
          value_label: string;
          points_cost: number;
          location_address: string | null;
          description: string;
          list_price_cents: number;
          pay_price_cents: number;
          collect_start: string | null;
          collect_end: string | null;
          image_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
