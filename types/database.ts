// Database types mirroring supabase/migrations, in the shape produced by
// `supabase gen types typescript`. Regenerate with that command after schema
// changes (see README.md) — or update this file by hand to match.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus = "new" | "confirmed" | "preparing" | "out_for_delivery" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cash_on_delivery" | "card";
export type Locale = "hy" | "ru" | "en";

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      admin_profiles: {
        Row: { user_id: string; role: "admin"; created_at: string };
        Insert: { user_id: string; role?: "admin"; created_at?: string };
        Update: { user_id?: string; role?: "admin"; created_at?: string };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name_hy: string;
          name_ru: string | null;
          name_en: string | null;
          sort_order: number;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          name_hy: string;
          name_ru?: string | null;
          name_en?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          name_hy?: string;
          name_ru?: string | null;
          name_en?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name_hy: string;
          name_ru: string | null;
          name_en: string | null;
          description_hy: string | null;
          description_ru: string | null;
          description_en: string | null;
          price_amd: number;
          category_id: string | null;
          is_available: boolean;
          stock_quantity: number | null;
          is_featured: boolean;
          is_published: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          name_hy: string;
          name_ru?: string | null;
          name_en?: string | null;
          description_hy?: string | null;
          description_ru?: string | null;
          description_en?: string | null;
          price_amd: number;
          category_id?: string | null;
          is_available?: boolean;
          stock_quantity?: number | null;
          is_featured?: boolean;
          is_published?: boolean;
        };
        Update: {
          slug?: string;
          name_hy?: string;
          name_ru?: string | null;
          name_en?: string | null;
          description_hy?: string | null;
          description_ru?: string | null;
          description_en?: string | null;
          price_amd?: number;
          category_id?: string | null;
          is_available?: boolean;
          stock_quantity?: number | null;
          is_featured?: boolean;
          is_published?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: { id: string; product_id: string; storage_path: string; sort_order: number; created_at: string };
        Insert: { id?: string; product_id: string; storage_path: string; sort_order?: number };
        Update: { sort_order?: number };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_settings: {
        Row: {
          id: number;
          delivery_fee_amd: number;
          free_delivery_threshold_amd: number | null;
          contact_phone: string | null;
          contact_email: string | null;
          instagram_url: string | null;
          facebook_url: string | null;
          pickup_location_hy: string | null;
          pickup_location_ru: string | null;
          pickup_location_en: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          delivery_fee_amd?: number;
          free_delivery_threshold_amd?: number | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          instagram_url?: string | null;
          facebook_url?: string | null;
          pickup_location_hy?: string | null;
          pickup_location_ru?: string | null;
          pickup_location_en?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          public_token: string;
          idempotency_key: string;
          locale: Locale;
          customer_name: string;
          customer_phone: string;
          delivery_address: string;
          delivery_notes: string | null;
          customer_note: string | null;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          order_status: OrderStatus;
          subtotal_amd: number;
          delivery_fee_amd: number;
          total_amd: number;
          admin_note: string | null;
          telegram_sent_at: string | null;
          telegram_claimed_at: string | null;
          telegram_attempts: number;
          telegram_last_error: string | null;
        } & Timestamps;
        Insert: never;
        // Admin sessions hold UPDATE privilege on these columns only.
        Update: {
          order_status?: OrderStatus;
          payment_status?: PaymentStatus;
          admin_note?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_slug_snapshot: string;
          product_name_snapshot: string;
          product_name_i18n: Json;
          unit_price_amd: number;
          quantity: number;
          line_total_amd: number;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          id: number;
          order_id: string;
          event_type: "created" | "order_status" | "payment_status" | "admin_note" | "telegram" | "payment";
          from_value: string | null;
          to_value: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: "arca";
          provider_order_id: string | null;
          attempt_reference: string;
          amount_amd: number;
          status: "created" | "pending" | "paid" | "failed" | "refunded";
          last_gateway_status: string | null;
        } & Timestamps;
        Insert: {
          order_id: string;
          provider: "arca";
          provider_order_id?: string | null;
          attempt_reference: string;
          amount_amd: number;
          status?: "created" | "pending" | "paid" | "failed" | "refunded";
        };
        Update: {
          provider_order_id?: string | null;
          status?: "created" | "pending" | "paid" | "failed" | "refunded";
          last_gateway_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      create_order: {
        Args: {
          p_idempotency_key: string;
          p_locale: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_delivery_address: string;
          p_delivery_notes: string | null;
          p_customer_note: string | null;
          p_payment_method: string;
          p_items: Json;
          p_expected_total_amd: number;
        };
        Returns: Json;
      };
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      claim_telegram_notification: { Args: { p_order_id: string }; Returns: boolean };
      complete_telegram_notification: { Args: { p_order_id: string; p_error: string | null }; Returns: undefined };
      record_payment_result: {
        Args: { p_payment_id: string; p_status: string; p_gateway_status: string };
        Returns: boolean;
      };
      admin_dashboard_stats: { Args: Record<string, never>; Returns: Json };
      admin_save_product: { Args: { p_id: string | null; p_data: Json; p_images: string[] }; Returns: Json };
      admin_delete_product: { Args: { p_id: string }; Returns: Json };
      admin_unreferenced_paths: { Args: { p_paths: string[] }; Returns: string[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
