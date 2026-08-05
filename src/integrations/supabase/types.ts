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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          fiscal_year: number
          id: string
          name: string
          period_no: number
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          name: string
          period_no: number
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          name?: string
          period_no?: number
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          created_by: string | null
          employee_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number
          status: string
          time_in: string | null
          time_out: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number
          status?: string
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attendance_date?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number
          status?: string
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          module: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          record_id: string | null
          session_id: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          module: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          module?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id?: string | null
          session_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string
          branch_id: string | null
          branch_name: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          is_default: boolean
          ledger_account_id: string
          name: string
          notes: string | null
          opening_balance: number
          status: string
          swift_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_number?: string | null
          bank_name: string
          branch_id?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_default?: boolean
          ledger_account_id: string
          name: string
          notes?: string | null
          opening_balance?: number
          status?: string
          swift_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_number?: string | null
          bank_name?: string
          branch_id?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_default?: boolean
          ledger_account_id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          status?: string
          swift_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          book_balance: number
          created_at: string
          created_by: string | null
          difference: number
          finalised_at: string | null
          finalised_by: string | null
          id: string
          notes: string | null
          reference_no: string
          statement_balance: number
          statement_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_id: string
          book_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          notes?: string | null
          reference_no: string
          statement_balance: number
          statement_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_id?: string
          book_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          finalised_at?: string | null
          finalised_by?: string | null
          id?: string
          notes?: string | null
          reference_no?: string
          statement_balance?: number
          statement_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_finalised_by_fkey"
            columns: ["finalised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          journal_entry_id: string | null
          reconciled: boolean
          reconciliation_id: string | null
          reference: string | null
          reference_no: string
          source_document_id: string | null
          source_document_type: string | null
          source_module: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          journal_entry_id?: string | null
          reconciled?: boolean
          reconciliation_id?: string | null
          reference?: string | null
          reference_no: string
          source_document_id?: string | null
          source_document_type?: string | null
          source_module?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          journal_entry_id?: string | null
          reconciled?: boolean
          reconciliation_id?: string | null
          reference?: string | null
          reference_no?: string
          source_document_id?: string | null
          source_document_type?: string | null
          source_module?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_txn_reconciliation_fk"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string
          country: string
          created_at: string
          created_by: string | null
          currency_code: string
          email: string | null
          id: string
          is_head_office: boolean
          name: string
          notes: string | null
          phone: string | null
          status: string
          tax_number: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code: string
          country?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          email?: string | null
          id?: string
          is_head_office?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string
          country?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          email?: string | null
          id?: string
          is_head_office?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_postable: boolean
          is_system: boolean
          name: string
          parent_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_code: string
          account_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_postable?: boolean
          is_system?: boolean
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_code?: string
          account_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_postable?: boolean
          is_system?: boolean
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_receipt_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "customer_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_receipts: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          payment_method: string
          posted_at: string | null
          receipt_date: string
          receipt_no: string
          received_by: string | null
          reference: string | null
          status: string
          unallocated: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          posted_at?: string | null
          receipt_date?: string
          receipt_no: string
          received_by?: string | null
          reference?: string | null
          status?: string
          unallocated?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          posted_at?: string | null
          receipt_date?: string
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
          status?: string
          unallocated?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          branch_id: string | null
          city: string | null
          code: string
          contact_person: string | null
          country: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency_code: string
          customer_type: string
          email: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          registration_number: string | null
          salesperson_id: string | null
          status: string
          tax_number: string | null
          trading_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          code: string
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency_code?: string
          customer_type?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          salesperson_id?: string | null
          status?: string
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          code?: string
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency_code?: string
          customer_type?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          salesperson_id?: string | null
          status?: string
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          doc_type: string
          next_number: number
          padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          doc_type: string
          next_number?: number
          padding?: number
          prefix: string
          updated_at?: string
        }
        Update: {
          doc_type?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_components: {
        Row: {
          amount: number | null
          component_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          rate: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          component_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          rate?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          component_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          rate?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "payroll_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number
          branch_id: string | null
          contract_end: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_no: string
          employment_type: string
          first_name: string
          gender: string | null
          hire_date: string
          id: string
          last_name: string
          manager_id: string | null
          national_id: string | null
          notes: string | null
          nssa_number: string | null
          other_names: string | null
          pay_frequency: string
          phone: string | null
          position_id: string | null
          probation_end: string | null
          profile_id: string | null
          status: string
          tax_number: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number
          branch_id?: string | null
          contract_end?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no: string
          employment_type?: string
          first_name: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name: string
          manager_id?: string | null
          national_id?: string | null
          notes?: string | null
          nssa_number?: string | null
          other_names?: string | null
          pay_frequency?: string
          phone?: string | null
          position_id?: string | null
          probation_end?: string | null
          profile_id?: string | null
          status?: string
          tax_number?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number
          branch_id?: string | null
          contract_end?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string
          employment_type?: string
          first_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          last_name?: string
          manager_id?: string | null
          national_id?: string | null
          notes?: string | null
          nssa_number?: string | null
          other_names?: string | null
          pay_frequency?: string
          phone?: string | null
          position_id?: string | null
          probation_end?: string | null
          profile_id?: string | null
          status?: string
          tax_number?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          account_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          bank_account_id: string | null
          branch_id: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          expense_no: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          payment_method: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: string
          submitted_at: string | null
          supplier_id: string | null
          tax_amount: number
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          bank_account_id?: string | null
          branch_id?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          expense_no: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string | null
          tax_amount?: number
          total: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          bank_account_id?: string | null
          branch_id?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_no?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string | null
          tax_amount?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_received_note_lines: {
        Row: {
          created_at: string
          grn_id: string
          id: string
          line_no: number
          notes: string | null
          product_id: string
          purchase_order_line_id: string | null
          quantity_accepted: number
          quantity_delivered: number
          quantity_ordered: number
          quantity_rejected: number
          rejection_reason: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          grn_id: string
          id?: string
          line_no: number
          notes?: string | null
          product_id: string
          purchase_order_line_id?: string | null
          quantity_accepted?: number
          quantity_delivered: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          grn_id?: string
          id?: string
          line_no?: number
          notes?: string | null
          product_id?: string
          purchase_order_line_id?: string | null
          quantity_accepted?: number
          quantity_delivered?: number
          quantity_ordered?: number
          quantity_rejected?: number
          rejection_reason?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_note_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_note_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_received_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          delivery_note_ref: string | null
          grn_no: string
          id: string
          inspected_by: string | null
          inspection_notes: string | null
          journal_entry_id: string | null
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          purchase_order_id: string | null
          received_by: string | null
          received_date: string
          status: string
          supplier_id: string
          total_cost: number
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note_ref?: string | null
          grn_no: string
          id?: string
          inspected_by?: string | null
          inspection_notes?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          purchase_order_id?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id: string
          total_cost?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note_ref?: string | null
          grn_no?: string
          id?: string
          inspected_by?: string | null
          inspection_notes?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          purchase_order_id?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id?: string
          total_cost?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_notes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          average_cost: number
          last_movement_at: string | null
          product_id: string
          quantity: number
          total_value: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          average_cost?: number
          last_movement_at?: string | null
          product_id: string
          quantity?: number
          total_value?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          average_cost?: number
          last_movement_at?: string | null
          product_id?: string
          quantity?: number
          total_value?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          balance_average_cost: number
          balance_quantity: number
          balance_value: number
          created_at: string
          created_by: string | null
          direction: number
          id: string
          movement_date: string
          movement_no: number
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reason: string | null
          source_document_id: string | null
          source_document_number: string | null
          source_document_type: string | null
          source_module: string | null
          total_cost: number
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          balance_average_cost: number
          balance_quantity: number
          balance_value: number
          created_at?: string
          created_by?: string | null
          direction: number
          id?: string
          movement_date?: string
          movement_no?: number
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          source_module?: string | null
          total_cost: number
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          balance_average_cost?: number
          balance_quantity?: number
          balance_value?: number
          created_at?: string
          created_by?: string | null
          direction?: number
          id?: string
          movement_date?: string
          movement_no?: number
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          source_module?: string | null
          total_cost?: number
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_system: boolean
          journal_date: string
          journal_no: number
          period_id: string | null
          posting_date: string
          reference: string
          reversed_by_journal_id: string | null
          reverses_journal_id: string | null
          source_document_id: string | null
          source_document_number: string | null
          source_document_type: string | null
          source_module: string | null
          status: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_system?: boolean
          journal_date?: string
          journal_no?: number
          period_id?: string | null
          posting_date?: string
          reference: string
          reversed_by_journal_id?: string | null
          reverses_journal_id?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          source_module?: string | null
          status?: string
          total_credit: number
          total_debit: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_system?: boolean
          journal_date?: string
          journal_no?: number
          period_id?: string | null
          posting_date?: string
          reference?: string
          reversed_by_journal_id?: string | null
          reverses_journal_id?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          source_module?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_journal_id_fkey"
            columns: ["reversed_by_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_journal_id_fkey"
            columns: ["reverses_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          branch_id: string | null
          created_at: string
          credit: number
          customer_id: string | null
          debit: number
          description: string | null
          id: string
          journal_id: string
          line_no: number
          product_id: string | null
          supplier_id: string | null
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
          line_no: number
          product_id?: string | null
          supplier_id?: string | null
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
          line_no?: number
          product_id?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          days: number
          document_url: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          rejected_reason: string | null
          request_no: string
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          days: number
          document_url?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          rejected_reason?: string | null
          request_no: string
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          days?: number
          document_url?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          rejected_reason?: string | null
          request_no?: string
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          carry_forward: boolean
          code: string
          created_at: string
          created_by: string | null
          days_per_year: number
          id: string
          is_paid: boolean
          max_carry_days: number
          name: string
          requires_document: boolean
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          carry_forward?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          days_per_year?: number
          id?: string
          is_paid?: boolean
          max_carry_days?: number
          name: string
          requires_document?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          carry_forward?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          days_per_year?: number
          id?: string
          is_paid?: boolean
          max_carry_days?: number
          name?: string
          requires_document?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown
          succeeded: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          succeeded: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          succeeded?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          permission_code: string | null
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          permission_code?: string | null
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          permission_code?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_components: {
        Row: {
          account_id: string | null
          calculation: string
          ceiling_amount: number | null
          code: string
          component_type: string
          created_at: string
          created_by: string | null
          default_amount: number
          default_rate: number
          id: string
          is_employer_contribution: boolean
          is_statutory: boolean
          is_taxable: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          calculation?: string
          ceiling_amount?: number | null
          code: string
          component_type: string
          created_at?: string
          created_by?: string | null
          default_amount?: number
          default_rate?: number
          id?: string
          is_employer_contribution?: boolean
          is_statutory?: boolean
          is_taxable?: boolean
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          calculation?: string
          ceiling_amount?: number | null
          code?: string
          component_type?: string
          created_at?: string
          created_by?: string | null
          default_amount?: number
          default_rate?: number
          id?: string
          is_employer_contribution?: boolean
          is_statutory?: boolean
          is_taxable?: boolean
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_components_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          fiscal_year: number
          id: string
          name: string
          pay_date: string
          pay_frequency: string
          period_no: number
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          name: string
          pay_date: string
          pay_frequency?: string
          period_no: number
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          name?: string
          pay_date?: string
          pay_frequency?: string
          period_no?: number
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          calculated_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          employee_count: number
          id: string
          journal_entry_id: string | null
          paid_at: string | null
          period_id: string
          posted_at: string | null
          posted_by: string | null
          run_no: string
          status: string
          total_deductions: number
          total_employer_cost: number
          total_gross: number
          total_net: number
          total_paye: number
          total_statutory: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_count?: number
          id?: string
          journal_entry_id?: string | null
          paid_at?: string | null
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          run_no: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_gross?: number
          total_net?: number
          total_paye?: number
          total_statutory?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_count?: number
          id?: string
          journal_entry_id?: string | null
          paid_at?: string | null
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          run_no?: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_gross?: number
          total_net?: number
          total_paye?: number
          total_statutory?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_tax_bands: {
        Row: {
          created_at: string
          created_by: string | null
          cumulative_tax: number
          currency_code: string
          description: string | null
          effective_from: string
          id: string
          lower_limit: number
          pay_frequency: string
          rate: number
          updated_at: string
          updated_by: string | null
          upper_limit: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cumulative_tax?: number
          currency_code?: string
          description?: string | null
          effective_from: string
          id?: string
          lower_limit: number
          pay_frequency?: string
          rate: number
          updated_at?: string
          updated_by?: string | null
          upper_limit?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cumulative_tax?: number
          currency_code?: string
          description?: string | null
          effective_from?: string
          id?: string
          lower_limit?: number
          pay_frequency?: string
          rate?: number
          updated_at?: string
          updated_by?: string | null
          upper_limit?: number | null
        }
        Relationships: []
      }
      payslip_lines: {
        Row: {
          amount: number
          component_id: string | null
          created_at: string
          description: string
          id: string
          is_employer_contribution: boolean
          line_no: number
          line_type: string
          payslip_id: string
        }
        Insert: {
          amount: number
          component_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_employer_contribution?: boolean
          line_no?: number
          line_type: string
          payslip_id: string
        }
        Update: {
          amount?: number
          component_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_employer_contribution?: boolean
          line_no?: number
          line_type?: string
          payslip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "payroll_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_lines_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          basic_salary: number
          created_at: string
          created_by: string | null
          currency_code: string
          days_absent: number
          days_worked: number | null
          employee_id: string
          employer_contributions: number
          gross_pay: number
          id: string
          net_pay: number
          other_deductions: number
          paye: number
          payslip_no: string
          run_id: string
          statutory_deductions: number
          taxable_income: number
          total_deductions: number
          total_earnings: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          days_absent?: number
          days_worked?: number | null
          employee_id: string
          employer_contributions?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          other_deductions?: number
          paye?: number
          payslip_no: string
          run_id: string
          statutory_deductions?: number
          taxable_income?: number
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          days_absent?: number
          days_worked?: number | null
          employee_id?: string
          employer_contributions?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          other_deductions?: number
          paye?: number
          payslip_no?: string
          run_id?: string
          statutory_deductions?: number
          taxable_income?: number
          total_deductions?: number
          total_earnings?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      pos_sessions: {
        Row: {
          branch_id: string | null
          closed_at: string | null
          closed_by: string | null
          counted_cash: number | null
          created_at: string
          created_by: string | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_float: number
          session_no: string
          status: string
          updated_at: string
          updated_by: string | null
          variance: number | null
          warehouse_id: string
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float?: number
          session_no: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variance?: number | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float?: number
          session_no?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variance?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          grade: string | null
          id: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          label: string | null
          product_id: string
        }
        Insert: {
          barcode: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          product_id: string
        }
        Update: {
          barcode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          label?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          default_supplier_id: string | null
          description: string | null
          id: string
          image_url: string | null
          max_stock_level: number | null
          min_stock_level: number
          name: string
          notes: string | null
          reorder_level: number
          selling_price: number
          sku: string
          standard_cost: number
          status: string
          stock_code: string | null
          tax_rate: number
          track_expiry: boolean
          track_stock: boolean
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          max_stock_level?: number | null
          min_stock_level?: number
          name: string
          notes?: string | null
          reorder_level?: number
          selling_price?: number
          sku: string
          standard_cost?: number
          status?: string
          stock_code?: string | null
          tax_rate?: number
          track_expiry?: boolean
          track_stock?: boolean
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          max_stock_level?: number | null
          min_stock_level?: number
          name?: string
          notes?: string | null
          reorder_level?: number
          selling_price?: number
          sku?: string
          standard_cost?: number
          status?: string
          stock_code?: string | null
          tax_rate?: number
          track_expiry?: boolean
          track_stock?: boolean
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_supplier_fk"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_supplier_fk"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          default_branch_id: string | null
          default_warehouse_id: string | null
          email: string
          employee_code: string | null
          failed_login_count: number
          full_name: string
          id: string
          job_title: string | null
          last_login_at: string | null
          locked_until: string | null
          must_change_password: boolean
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          default_branch_id?: string | null
          default_warehouse_id?: string | null
          email: string
          employee_code?: string | null
          failed_login_count?: number
          full_name: string
          id: string
          job_title?: string | null
          last_login_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          default_branch_id?: string | null
          default_warehouse_id?: string | null
          email?: string
          employee_code?: string | null
          failed_login_count?: number
          full_name?: string
          id?: string
          job_title?: string | null
          last_login_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_warehouse_fk"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          line_no: number
          line_total: number
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_no: number
          line_total?: number
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_no?: number
          line_total?: number
          product_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          cancelled_reason: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          discount_total: number
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          payment_terms_days: number
          po_no: string
          quotation_ref: string | null
          requisition_id: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax_total: number
          total: number
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms_days?: number
          po_no: string
          quotation_ref?: string | null
          requisition_id?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms_days?: number
          po_no?: string
          quotation_ref?: string | null
          requisition_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisition_lines: {
        Row: {
          created_at: string
          estimated_unit_price: number
          id: string
          line_no: number
          notes: string | null
          product_id: string
          quantity: number
          requisition_id: string
        }
        Insert: {
          created_at?: string
          estimated_unit_price?: number
          id?: string
          line_no: number
          notes?: string | null
          product_id: string
          quantity: number
          requisition_id: string
        }
        Update: {
          created_at?: string
          estimated_unit_price?: number
          id?: string
          line_no?: number
          notes?: string | null
          product_id?: string
          quantity?: number
          requisition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          notes: string | null
          reason: string | null
          rejected_reason: string | null
          requested_by: string | null
          required_date: string | null
          requisition_no: string
          status: string
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          required_date?: string | null
          requisition_no: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          required_date?: string | null
          requisition_no?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          rank: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          rank?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          rank?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sales_invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          invoice_id: string
          line_cost: number
          line_no: number
          line_total: number
          product_id: string
          quantity: number
          tax_rate: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id: string
          line_cost?: number
          line_no: number
          line_total?: number
          product_id: string
          quantity: number
          tax_rate?: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id?: string
          line_cost?: number
          line_no?: number
          line_total?: number
          product_id?: string
          quantity?: number
          tax_rate?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_paid: number
          branch_id: string | null
          cancelled_reason: string | null
          cost_of_sales: number
          created_at: string
          created_by: string | null
          currency_code: string
          customer_id: string | null
          customer_name: string | null
          discount_total: number
          due_date: string | null
          id: string
          invoice_date: string
          invoice_no: string
          journal_entry_id: string | null
          notes: string | null
          payment_type: string
          pos_session_id: string | null
          posted_at: string | null
          posted_by: string | null
          quotation_id: string | null
          salesperson_id: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          cancelled_reason?: string | null
          cost_of_sales?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_type?: string
          pos_session_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          quotation_id?: string | null
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          cancelled_reason?: string | null
          cost_of_sales?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_type?: string
          pos_session_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          quotation_id?: string | null
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_pos_session_id_fkey"
            columns: ["pos_session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotation_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          line_no: number
          line_total: number
          product_id: string
          quantity: number
          quotation_id: string
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_no: number
          line_total?: number
          product_id: string
          quantity: number
          quotation_id: string
          tax_rate?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_no?: number
          line_total?: number
          product_id?: string
          quantity?: number
          quotation_id?: string
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotations: {
        Row: {
          branch_id: string | null
          converted_invoice_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          customer_id: string | null
          customer_name: string | null
          discount_total: number
          id: string
          notes: string | null
          quotation_date: string
          quotation_no: string
          salesperson_id: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          quotation_date?: string
          quotation_no: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          quotation_date?: string
          quotation_no?: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_lines: {
        Row: {
          created_at: string
          id: string
          invoice_line_id: string | null
          line_cost: number
          line_no: number
          line_total: number
          product_id: string
          quantity: number
          return_id: string
          tax_rate: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_line_id?: string | null
          line_cost?: number
          line_no: number
          line_total?: number
          product_id: string
          quantity: number
          return_id: string
          tax_rate?: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_line_id?: string | null
          line_cost?: number
          line_no?: number
          line_total?: number
          product_id?: string
          quantity?: number
          return_id?: string
          tax_rate?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_lines_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          branch_id: string | null
          cost_of_sales: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          reason: string
          restock: boolean
          return_date: string
          return_no: string
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          branch_id?: string | null
          cost_of_sales?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason: string
          restock?: boolean
          return_date?: string
          return_no: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string | null
          cost_of_sales?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string
          restock?: boolean
          return_date?: string
          return_no?: string
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          city: string | null
          code: string
          contact_person: string | null
          country: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency_code: string
          email: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          registration_number: string | null
          status: string
          swift_code: string | null
          tax_number: string | null
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          code: string
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency_code?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          status?: string
          swift_code?: string | null
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          city?: string | null
          code?: string
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency_code?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          registration_number?: string | null
          status?: string
          swift_code?: string | null
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          adjustment_prefix: string
          base_currency: string
          city: string | null
          company_name: string
          country: string
          created_at: string
          created_by: string | null
          date_format: string
          default_tax_rate: number
          email: string | null
          fiscal_year_start_month: number
          grn_prefix: string
          id: boolean
          invoice_prefix: string
          journal_prefix: string
          logo_url: string | null
          phone: string | null
          po_prefix: string
          quotation_prefix: string
          receipt_prefix: string
          registration_number: string | null
          requisition_prefix: string
          tax_number: string | null
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          adjustment_prefix?: string
          base_currency?: string
          city?: string | null
          company_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          date_format?: string
          default_tax_rate?: number
          email?: string | null
          fiscal_year_start_month?: number
          grn_prefix?: string
          id?: boolean
          invoice_prefix?: string
          journal_prefix?: string
          logo_url?: string | null
          phone?: string | null
          po_prefix?: string
          quotation_prefix?: string
          receipt_prefix?: string
          registration_number?: string | null
          requisition_prefix?: string
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          adjustment_prefix?: string
          base_currency?: string
          city?: string | null
          company_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          date_format?: string
          default_tax_rate?: number
          email?: string | null
          fiscal_year_start_month?: number
          grn_prefix?: string
          id?: boolean
          invoice_prefix?: string
          journal_prefix?: string
          logo_url?: string | null
          phone?: string | null
          po_prefix?: string
          quotation_prefix?: string
          receipt_prefix?: string
          registration_number?: string | null
          requisition_prefix?: string
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      units_of_measure: {
        Row: {
          allow_decimal: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_decimal?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_decimal?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          type: string
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          manager_id: string | null
          name: string
          notes: string | null
          status: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          manager_id?: string | null
          name: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          manager_id?: string | null
          name?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees_secure: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number | null
          branch_id: string | null
          contract_end: string | null
          created_at: string | null
          currency_code: string | null
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_no: string | null
          employment_type: string | null
          first_name: string | null
          gender: string | null
          hire_date: string | null
          id: string | null
          last_name: string | null
          manager_id: string | null
          national_id: string | null
          notes: string | null
          nssa_number: string | null
          other_names: string | null
          pay_frequency: string | null
          phone: string | null
          position_id: string | null
          probation_end: string | null
          profile_id: string | null
          status: string | null
          tax_number: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: never
          bank_branch?: never
          bank_name?: never
          basic_salary?: never
          branch_id?: string | null
          contract_end?: string | null
          created_at?: string | null
          currency_code?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string | null
          employment_type?: string | null
          first_name?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string | null
          last_name?: string | null
          manager_id?: string | null
          national_id?: string | null
          notes?: string | null
          nssa_number?: string | null
          other_names?: string | null
          pay_frequency?: string | null
          phone?: string | null
          position_id?: string | null
          probation_end?: string | null
          profile_id?: string | null
          status?: string | null
          tax_number?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: never
          bank_branch?: never
          bank_name?: never
          basic_salary?: never
          branch_id?: string | null
          contract_end?: string | null
          created_at?: string | null
          currency_code?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string | null
          employment_type?: string | null
          first_name?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string | null
          last_name?: string | null
          manager_id?: string | null
          national_id?: string | null
          notes?: string | null
          nssa_number?: string | null
          other_names?: string | null
          pay_frequency?: string | null
          phone?: string | null
          position_id?: string | null
          probation_end?: string | null
          profile_id?: string | null
          status?: string | null
          tax_number?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products_catalogue: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          name: string | null
          reorder_level: number | null
          selling_price: number | null
          sku: string | null
          standard_cost: number | null
          status: string | null
          stock_code: string | null
          tax_rate: number | null
          track_expiry: boolean | null
          track_stock: boolean | null
          uom_id: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name?: string | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          standard_cost?: never
          status?: string | null
          stock_code?: string | null
          tax_rate?: number | null
          track_expiry?: boolean | null
          track_stock?: boolean | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name?: string | null
          reorder_level?: number | null
          selling_price?: number | null
          sku?: string | null
          standard_cost?: never
          status?: string | null
          stock_code?: string | null
          tax_rate?: number | null
          track_expiry?: boolean | null
          track_stock?: boolean | null
          uom_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers_directory: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          city: string | null
          code: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          currency_code: string | null
          email: string | null
          id: string | null
          name: string | null
          notes: string | null
          opening_balance: number | null
          payment_terms_days: number | null
          phone: string | null
          registration_number: string | null
          status: string | null
          swift_code: string | null
          tax_number: string | null
          trading_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: never
          bank_account_number?: never
          bank_branch?: never
          bank_name?: never
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          currency_code?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          opening_balance?: number | null
          payment_terms_days?: number | null
          phone?: string | null
          registration_number?: string | null
          status?: string | null
          swift_code?: never
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: never
          bank_account_number?: never
          bank_branch?: never
          bank_name?: never
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          currency_code?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          opening_balance?: number | null
          payment_terms_days?: number | null
          phone?: string | null
          registration_number?: string | null
          status?: string | null
          swift_code?: never
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_normal_balance: { Args: { p_type: string }; Returns: string }
      bank_balance: {
        Args: { p_as_at?: string; p_bank_account_id: string }
        Returns: number
      }
      calculate_paye: {
        Args: {
          p_as_at?: string
          p_currency?: string
          p_frequency?: string
          p_taxable: number
        }
        Returns: number
      }
      calculate_payroll_run: { Args: { p_run_id: string }; Returns: number }
      can_post_invoice: { Args: { p_invoice_id: string }; Returns: boolean }
      close_pos_session: {
        Args: { p_counted_cash: number; p_notes?: string; p_session_id: string }
        Returns: number
      }
      customer_balance: { Args: { p_customer_id: string }; Returns: number }
      find_product_by_scan: {
        Args: { p_code: string }
        Returns: {
          name: string
          product_id: string
          selling_price: number
          sku: string
          status: string
          tax_rate: number
          track_stock: boolean
          uom_code: string
        }[]
      }
      has_any_permission: { Args: { p_codes: string[] }; Returns: boolean }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      inventory_movement_direction: {
        Args: { p_type: string }
        Returns: number
      }
      inventory_valuation_as_at: {
        Args: { p_as_at?: string; p_warehouse_id?: string }
        Returns: {
          average_cost: number
          product_id: string
          quantity: number
          total_value: number
          warehouse_id: string
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      leave_days_taken: {
        Args: {
          p_employee_id: string
          p_leave_type_id: string
          p_year?: number
        }
        Returns: number
      }
      my_permissions: {
        Args: never
        Returns: {
          code: string
        }[]
      }
      my_roles: {
        Args: never
        Returns: {
          code: string
          name: string
          rank: number
        }[]
      }
      next_document_number: { Args: { p_doc_type: string }; Returns: string }
      open_pos_session: {
        Args: {
          p_branch_id?: string
          p_opening_float?: number
          p_warehouse_id: string
        }
        Returns: string
      }
      period_for_date: { Args: { p_date: string }; Returns: string }
      post_bank_transaction: {
        Args: {
          p_amount: number
          p_bank_account_id: string
          p_contra_account: string
          p_date: string
          p_description: string
          p_reference?: string
          p_type: string
        }
        Returns: string
      }
      post_expense: { Args: { p_expense_id: string }; Returns: string }
      post_goods_received_note: { Args: { p_grn_id: string }; Returns: string }
      post_inventory_movement: {
        Args: {
          p_movement_date?: string
          p_movement_type: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_source_document_id?: string
          p_source_document_number?: string
          p_source_document_type?: string
          p_source_module?: string
          p_unit_cost?: number
          p_warehouse_id: string
        }
        Returns: string
      }
      post_journal_entry: {
        Args: {
          p_branch_id?: string
          p_description: string
          p_is_system?: boolean
          p_journal_date?: string
          p_lines: Json
          p_reference: string
          p_reverses_journal_id?: string
          p_source_document_id?: string
          p_source_document_number?: string
          p_source_document_type?: string
          p_source_module?: string
        }
        Returns: string
      }
      post_payroll_run: { Args: { p_run_id: string }; Returns: string }
      post_sales_invoice: { Args: { p_invoice_id: string }; Returns: string }
      post_sales_return: { Args: { p_return_id: string }; Returns: string }
      record_login_attempt: {
        Args: { p_email: string; p_succeeded: boolean }
        Returns: undefined
      }
      reverse_journal_entry: {
        Args: {
          p_journal_id: string
          p_reason: string
          p_reversal_date?: string
        }
        Returns: string
      }
      trial_balance: {
        Args: { p_as_at?: string; p_branch_id?: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: string
          balance: number
          total_credit: number
          total_debit: number
        }[]
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
    Enums: {},
  },
} as const
