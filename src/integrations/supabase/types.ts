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
      bom_headers: {
        Row: {
          bom_type: string
          company_id: string
          created_at: string
          id: string
          order_id: string | null
          remarks: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          bom_type?: string
          company_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          remarks?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          bom_type?: string
          company_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          remarks?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          avg_consumption: number | null
          bom_id: string
          category: string
          created_at: string
          extra_pct: number | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          rate: number | null
          remarks: string | null
          sort_order: number | null
          total_amount: number | null
          uom: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          avg_consumption?: number | null
          bom_id: string
          category?: string
          created_at?: string
          extra_pct?: number | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          rate?: number | null
          remarks?: string | null
          sort_order?: number | null
          total_amount?: number | null
          uom?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          avg_consumption?: number | null
          bom_id?: string
          category?: string
          created_at?: string
          extra_pct?: number | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          rate?: number | null
          remarks?: string | null
          sort_order?: number | null
          total_amount?: number | null
          uom?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          address: string | null
          code: string
          company_id: string
          contact_person: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          contact_person?: string | null
          country: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          contact_person?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      dispatch_records: {
        Row: {
          buyer_id: string | null
          challan_number: string | null
          colour: string | null
          company_id: string
          created_at: string
          dispatch_date: string
          dispatch_type: string
          id: string
          order_id: string | null
          product_name: string | null
          qty: number
          remarks: string | null
          size: string | null
          uom: string | null
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          buyer_id?: string | null
          challan_number?: string | null
          colour?: string | null
          company_id: string
          created_at?: string
          dispatch_date?: string
          dispatch_type?: string
          id?: string
          order_id?: string | null
          product_name?: string | null
          qty?: number
          remarks?: string | null
          size?: string | null
          uom?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          buyer_id?: string | null
          challan_number?: string | null
          colour?: string | null
          company_id?: string
          created_at?: string
          dispatch_date?: string
          dispatch_type?: string
          id?: string
          order_id?: string | null
          product_name?: string | null
          qty?: number
          remarks?: string | null
          size?: string | null
          uom?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_records_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrics: {
        Row: {
          company_id: string
          created_at: string
          gsm: number | null
          id: string
          is_active: boolean
          name: string
          short_form: string | null
          updated_at: string
          width: number | null
          width_unit: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          gsm?: number | null
          id?: string
          is_active?: boolean
          name: string
          short_form?: string | null
          updated_at?: string
          width?: number | null
          width_unit?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          gsm?: number | null
          id?: string
          is_active?: boolean
          name?: string
          short_form?: string | null
          updated_at?: string
          width?: number | null
          width_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      factories: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_headers: {
        Row: {
          company_id: string
          created_at: string
          grn_date: string
          grn_number: string
          id: string
          po_id: string | null
          remarks: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          grn_date?: string
          grn_number: string
          id?: string
          po_id?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          grn_date?: string
          grn_number?: string
          id?: string
          po_id?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_headers_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_headers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_lines: {
        Row: {
          batch_number: string | null
          created_at: string
          grn_id: string
          id: string
          item_id: string | null
          item_name: string
          lot_number: string | null
          po_line_id: string | null
          qty_received: number
          remarks: string | null
          roll_number: string | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          grn_id: string
          id?: string
          item_id?: string | null
          item_name: string
          lot_number?: string | null
          po_line_id?: string | null
          qty_received?: number
          remarks?: string | null
          roll_number?: string | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          grn_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          lot_number?: string | null
          po_line_id?: string | null
          qty_received?: number
          remarks?: string | null
          roll_number?: string | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          code: string
          company_id: string
          created_at: string
          fabric_id: string | null
          id: string
          is_active: boolean
          name: string
          opening_stock: number
          reorder_level: number | null
          uom: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          company_id: string
          created_at?: string
          fabric_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          opening_stock?: number
          reorder_level?: number | null
          uom?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          company_id?: string
          created_at?: string
          fabric_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opening_stock?: number
          reorder_level?: number | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          buyers_done: boolean
          company_done: boolean
          company_id: string
          created_at: string
          fabrics_done: boolean
          factories_done: boolean
          id: string
          printing_products_done: boolean
          printing_tables_done: boolean
          stitching_lines_done: boolean
          stitching_products_done: boolean
          updated_at: string
          wizard_completed: boolean
        }
        Insert: {
          buyers_done?: boolean
          company_done?: boolean
          company_id: string
          created_at?: string
          fabrics_done?: boolean
          factories_done?: boolean
          id?: string
          printing_products_done?: boolean
          printing_tables_done?: boolean
          stitching_lines_done?: boolean
          stitching_products_done?: boolean
          updated_at?: string
          wizard_completed?: boolean
        }
        Update: {
          buyers_done?: boolean
          company_done?: boolean
          company_id?: string
          created_at?: string
          fabrics_done?: boolean
          factories_done?: boolean
          id?: string
          printing_products_done?: boolean
          printing_tables_done?: boolean
          stitching_lines_done?: boolean
          stitching_products_done?: boolean
          updated_at?: string
          wizard_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_colourways: {
        Row: {
          colour_name: string
          created_at: string
          id: string
          notes: string | null
          order_row_id: string
          ordered_qty: number
          size: string | null
          sort_order: number | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          colour_name: string
          created_at?: string
          id?: string
          notes?: string | null
          order_row_id: string
          ordered_qty?: number
          size?: string | null
          sort_order?: number | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          colour_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_row_id?: string
          ordered_qty?: number
          size?: string | null
          sort_order?: number | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_colourways_order_row_id_fkey"
            columns: ["order_row_id"]
            isOneToOne: false
            referencedRelation: "order_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      order_headers: {
        Row: {
          buyer_delivery_date: string | null
          buyer_id: string | null
          buyer_p_o: string | null
          buyer_po: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          internal_po: string
          module: string
          remarks: string | null
          status: string
          style: string | null
          target_end_date: string | null
          updated_at: string
        }
        Insert: {
          buyer_delivery_date?: string | null
          buyer_id?: string | null
          buyer_p_o?: string | null
          buyer_po?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          internal_po: string
          module: string
          remarks?: string | null
          status?: string
          style?: string | null
          target_end_date?: string | null
          updated_at?: string
        }
        Update: {
          buyer_delivery_date?: string | null
          buyer_id?: string | null
          buyer_p_o?: string | null
          buyer_po?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          internal_po?: string
          module?: string
          remarks?: string | null
          status?: string
          style?: string | null
          target_end_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_headers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_rows: {
        Row: {
          chart_qty: number
          created_at: string
          fabric_id: string | null
          fabric_width: string | null
          id: string
          no_of_colours: number | null
          order_id: string
          order_qty: number
          product_id: string | null
          rate_per_item: number | null
          sort_order: number | null
          uom: string
          updated_at: string
        }
        Insert: {
          chart_qty?: number
          created_at?: string
          fabric_id?: string | null
          fabric_width?: string | null
          id?: string
          no_of_colours?: number | null
          order_id: string
          order_qty?: number
          product_id?: string | null
          rate_per_item?: number | null
          sort_order?: number | null
          uom?: string
          updated_at?: string
        }
        Update: {
          chart_qty?: number
          created_at?: string
          fabric_id?: string | null
          fabric_width?: string | null
          id?: string
          no_of_colours?: number | null
          order_id?: string
          order_qty?: number
          product_id?: string | null
          rate_per_item?: number | null
          sort_order?: number | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_rows_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_rows_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      printing_product_fabrics: {
        Row: {
          fabric_id: string
          id: string
          printing_product_id: string
        }
        Insert: {
          fabric_id: string
          id?: string
          printing_product_id: string
        }
        Update: {
          fabric_id?: string
          id?: string
          printing_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printing_product_fabrics_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printing_product_fabrics_printing_product_id_fkey"
            columns: ["printing_product_id"]
            isOneToOne: false
            referencedRelation: "printing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      printing_products: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          size: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          size?: string | null
          uom?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          size?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printing_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      printing_tables: {
        Row: {
          code: string | null
          created_at: string
          factory_id: string
          id: string
          is_active: boolean
          name: string
          operators: number | null
          size: string | null
          supervisor_name: string | null
          table_number: number | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          factory_id: string
          id?: string
          is_active?: boolean
          name: string
          operators?: number | null
          size?: string | null
          supervisor_name?: string | null
          table_number?: number | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          factory_id?: string
          id?: string
          is_active?: boolean
          name?: string
          operators?: number | null
          size?: string | null
          supervisor_name?: string | null
          table_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printing_tables_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entries: {
        Row: {
          colourway_id: string | null
          company_id: string
          cost_amount: number
          created_at: string
          date: string
          factory_id: string | null
          id: string
          module: string
          notes: string | null
          order_id: string | null
          order_row_id: string | null
          output_qty: number
          output_uom: string | null
          persons_used: number
          rate_basis: string | null
          rate_master_id: string | null
          rate_value: number | null
          resource_id: string | null
          shift_id: string | null
          updated_at: string
          worker_type_id: string | null
        }
        Insert: {
          colourway_id?: string | null
          company_id: string
          cost_amount?: number
          created_at?: string
          date: string
          factory_id?: string | null
          id?: string
          module: string
          notes?: string | null
          order_id?: string | null
          order_row_id?: string | null
          output_qty?: number
          output_uom?: string | null
          persons_used?: number
          rate_basis?: string | null
          rate_master_id?: string | null
          rate_value?: number | null
          resource_id?: string | null
          shift_id?: string | null
          updated_at?: string
          worker_type_id?: string | null
        }
        Update: {
          colourway_id?: string | null
          company_id?: string
          cost_amount?: number
          created_at?: string
          date?: string
          factory_id?: string | null
          id?: string
          module?: string
          notes?: string | null
          order_id?: string | null
          order_row_id?: string | null
          output_qty?: number
          output_uom?: string | null
          persons_used?: number
          rate_basis?: string | null
          rate_master_id?: string | null
          rate_value?: number | null
          resource_id?: string | null
          shift_id?: string | null
          updated_at?: string
          worker_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_colourway_id_fkey"
            columns: ["colourway_id"]
            isOneToOne: false
            referencedRelation: "order_colourways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_order_row_id_fkey"
            columns: ["order_row_id"]
            isOneToOne: false
            referencedRelation: "order_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_rate_master_id_fkey"
            columns: ["rate_master_id"]
            isOneToOne: false
            referencedRelation: "rate_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_worker_type_id_fkey"
            columns: ["worker_type_id"]
            isOneToOne: false
            referencedRelation: "worker_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          company_id: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          company_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          company_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          po_id: string
          qty_ordered: number
          qty_received: number
          rate: number | null
          remarks: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          po_id: string
          qty_ordered?: number
          qty_received?: number
          rate?: number | null
          remarks?: string | null
          uom?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          rate?: number | null
          remarks?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          id: string
          invoice_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          order_id: string | null
          payment_status: string | null
          po_date: string
          po_number: string
          remarks: string | null
          source_type: string
          status: string
          total_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          order_id?: string | null
          payment_status?: string | null
          po_date?: string
          po_number: string
          remarks?: string | null
          source_type?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          order_id?: string | null
          payment_status?: string | null
          po_date?: string
          po_number?: string
          remarks?: string | null
          source_type?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_masters: {
        Row: {
          company_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          factory_id: string | null
          id: string
          is_active: boolean
          rate_basis: string
          rate_value: number
          shift_id: string | null
          updated_at: string
          worker_type_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          factory_id?: string | null
          id?: string
          is_active?: boolean
          rate_basis?: string
          rate_value?: number
          shift_id?: string | null
          updated_at?: string
          worker_type_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          factory_id?: string | null
          id?: string
          is_active?: boolean
          rate_basis?: string
          rate_value?: number
          shift_id?: string | null
          updated_at?: string
          worker_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_masters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_masters_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_masters_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_masters_worker_type_id_fkey"
            columns: ["worker_type_id"]
            isOneToOne: false
            referencedRelation: "worker_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          code: string
          created_at: string
          end_time: string | null
          factory_id: string
          id: string
          is_active: boolean
          name: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          end_time?: string | null
          factory_id: string
          id?: string
          is_active?: boolean
          name: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          end_time?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      stitching_lines: {
        Row: {
          code: string | null
          created_at: string
          factory_id: string
          id: string
          is_active: boolean
          line_number: number | null
          machines: number | null
          name: string
          operators: number | null
          supervisor_name: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          factory_id: string
          id?: string
          is_active?: boolean
          line_number?: number | null
          machines?: number | null
          name: string
          operators?: number | null
          supervisor_name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          factory_id?: string
          id?: string
          is_active?: boolean
          line_number?: number | null
          machines?: number | null
          name?: string
          operators?: number | null
          supervisor_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stitching_lines_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      stitching_products: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          short_form: string | null
          size_spec: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          short_form?: string | null
          size_spec?: string | null
          uom?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          short_form?: string | null
          size_spec?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stitching_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_jobs: {
        Row: {
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          job_number: string
          module: string
          produced_qty: number
          product_name: string
          remarks: string | null
          start_date: string | null
          status: string
          target_qty: number
          uom: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          job_number: string
          module?: string
          produced_qty?: number
          product_name: string
          remarks?: string | null
          start_date?: string | null
          status?: string
          target_qty?: number
          uom?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          job_number?: string
          module?: string
          produced_qty?: number
          product_name?: string
          remarks?: string | null
          start_date?: string | null
          status?: string
          target_qty?: number
          uom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          batch_number: string | null
          company_id: string
          created_at: string
          grn_id: string | null
          id: string
          item_id: string
          lot_number: string | null
          order_id: string | null
          qty: number
          remarks: string | null
          roll_number: string | null
          stock_job_id: string | null
          txn_date: string
          txn_type: string
          uom: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          batch_number?: string | null
          company_id: string
          created_at?: string
          grn_id?: string | null
          id?: string
          item_id: string
          lot_number?: string | null
          order_id?: string | null
          qty?: number
          remarks?: string | null
          roll_number?: string | null
          stock_job_id?: string | null
          txn_date?: string
          txn_type?: string
          uom?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          batch_number?: string | null
          company_id?: string
          created_at?: string
          grn_id?: string | null
          id?: string
          item_id?: string
          lot_number?: string | null
          order_id?: string | null
          qty?: number
          remarks?: string | null
          roll_number?: string | null
          stock_job_id?: string | null
          txn_date?: string
          txn_type?: string
          uom?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_stock_job_id_fkey"
            columns: ["stock_job_id"]
            isOneToOne: false
            referencedRelation: "stock_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      uom_master: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          code: string
          company_id: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          payment_terms: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_types: {
        Row: {
          company_id: string
          created_at: string
          factory_id: string | null
          id: string
          is_active: boolean
          module: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          factory_id?: string | null
          id?: string
          is_active?: boolean
          module?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          factory_id?: string | null
          id?: string
          is_active?: boolean
          module?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_types_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
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
      app_role: ["admin", "staff", "viewer"],
    },
  },
} as const
