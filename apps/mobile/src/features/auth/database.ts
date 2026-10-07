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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
