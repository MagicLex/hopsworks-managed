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
          account_owner_id?: string | null;
          hopsworks_project_id?: number | null;
          stripe_test_customer_id?: string | null;
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
          account_owner_id?: string | null;
          date: string;
          opencost_cpu_hours: number;
          opencost_gpu_hours: number;
          opencost_ram_gb_hours: number;
          opencost_cpu_cost: number;
          opencost_gpu_cost: number;
          opencost_ram_cost: number;
          opencost_storage_cost: number;
          opencost_total_cost: number;
          online_storage_gb: number;
          offline_storage_gb: number;
          online_storage_cost: number;
          offline_storage_cost: number;
          network_egress_gb: number;
          network_egress_cost: number;
          project_breakdown?: any;
          instance_types?: any;
          resource_efficiency?: any;
          total_cost: number;
          hopsworks_cluster_id?: string | null;
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
          user_id: string;
          deployment_type: string;
          zone: string;
          status: string;
          hopsworks_project_id: string | null;
          hopsworks_api_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clusters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['clusters']['Insert']>;
      };
      hopsworks_clusters: {
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
        Insert: Omit<Database['public']['Tables']['hopsworks_clusters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['hopsworks_clusters']['Insert']>;
      };
      user_hopsworks_assignments: {
        Row: {
          id: string;
          user_id: string;
          hopsworks_cluster_id: string;
          assigned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_hopsworks_assignments']['Row'], 'id' | 'assigned_at'>;
        Update: Partial<Database['public']['Tables']['user_hopsworks_assignments']['Insert']>;
      };
      team_invites: {
        Row: {
          id: string;
          account_owner_id: string;
          email: string;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by_user_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['team_invites']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['team_invites']['Insert']>;
      };
    };
  };
}