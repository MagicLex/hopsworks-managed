export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; // Auth0 user ID (sub)
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
          registration_source: string | null; // 'organic', 'campaign', etc.
          registration_ip: string | null;
          last_login_at: string | null;
          login_count: number;
          status: 'active' | 'suspended' | 'deleted';
          metadata: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      user_credits: {
        Row: {
          id: string;
          user_id: string;
          total_purchased: number;
          total_used: number;
          cpu_hours_used: number;
          gpu_hours_used: number;
          storage_gb_months: number;
          last_purchase_at: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_credits']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_credits']['Insert']>;
      };
      usage_daily: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          cpu_hours: number;
          gpu_hours: number;
          storage_gb: number;
          feature_store_api_calls: number;
          model_inference_calls: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['usage_daily']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['usage_daily']['Insert']>;
      };
      billing_history: {
        Row: {
          id: string;
          user_id: string;
          invoice_id: string;
          amount: number;
          currency: string;
          status: 'pending' | 'paid' | 'failed' | 'refunded';
          description: string;
          stripe_payment_intent_id: string | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['billing_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['billing_history']['Insert']>;
      };
      instances: {
        Row: {
          id: string;
          user_id: string;
          instance_name: string;
          hopsworks_url: string | null;
          status: 'provisioning' | 'active' | 'stopped' | 'deleted';
          created_at: string;
          activated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['instances']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['instances']['Insert']>;
      };
      clusters: {
        Row: {
          id: string;
          name: string;
          api_url: string;
          api_key: string | null;
          max_users: number;
          current_users: number;
          status: 'active' | 'maintenance' | 'full' | 'inactive';
          created_at: string;
          updated_at: string;
          metadata: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['clusters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['clusters']['Insert']>;
      };
      user_cluster_assignments: {
        Row: {
          id: string;
          user_id: string;
          cluster_id: string;
          assigned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_cluster_assignments']['Row'], 'id' | 'assigned_at'>;
        Update: Partial<Database['public']['Tables']['user_cluster_assignments']['Insert']>;
      };
    };
  };
}