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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          nome: string
        }
        Insert: {
          created_at?: string
          email: string
          nome: string
        }
        Update: {
          created_at?: string
          email?: string
          nome?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          subscriptions_open: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          subscriptions_open?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          subscriptions_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          asaas_customer_id: string | null
          asaas_event_id: string
          asaas_payment_id: string | null
          event_type: string
          external_reference: string | null
          id: string
          payload: Json
          payment_status: string | null
          processed_at: string | null
          received_at: string
          subscription_id: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_event_id: string
          asaas_payment_id?: string | null
          event_type: string
          external_reference?: string | null
          id?: string
          payload: Json
          payment_status?: string | null
          processed_at?: string | null
          received_at?: string
          subscription_id?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_event_id?: string
          asaas_payment_id?: string | null
          event_type?: string
          external_reference?: string | null
          id?: string
          payload?: Json
          payment_status?: string | null
          processed_at?: string | null
          received_at?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_webhook_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_assinatura_itens"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      bairros_atendidos: {
        Row: {
          ativo: boolean
          bairro: string
          cidade: string
          created_at: string
          id: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro: string
          cidade: string
          created_at?: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cidade?: string
          created_at?: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      capacity_waitlist: {
        Row: {
          cep: string
          created_at: string
          email: string
          id: string
          nome: string
          whatsapp: string
        }
        Insert: {
          cep: string
          created_at?: string
          email: string
          id?: string
          nome: string
          whatsapp: string
        }
        Update: {
          cep?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          whatsapp?: string
        }
        Relationships: []
      }
      cardapios: {
        Row: {
          created_at: string
          id: string
          preco_avulso: number
          produto_id: string
          semana_id: string
          tipo: Database["public"]["Enums"]["tipo_cardapio_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          preco_avulso: number
          produto_id: string
          semana_id: string
          tipo: Database["public"]["Enums"]["tipo_cardapio_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          preco_avulso?: number
          produto_id?: string
          semana_id?: string
          tipo?: Database["public"]["Enums"]["tipo_cardapio_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "cardapios_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardapios_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
        ]
      }
      contextos_dia: {
        Row: {
          created_at: string
          dia: string
          id: string
          lote_farinha_principal_id: string | null
          notas: string | null
          semana_id: string
          temp_ambiente_max_c: number | null
          ultimo_refresh_levain_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia: string
          id?: string
          lote_farinha_principal_id?: string | null
          notas?: string | null
          semana_id: string
          temp_ambiente_max_c?: number | null
          ultimo_refresh_levain_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia?: string
          id?: string
          lote_farinha_principal_id?: string | null
          notas?: string | null
          semana_id?: string
          temp_ambiente_max_c?: number | null
          ultimo_refresh_levain_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contextos_dia_lote_farinha_principal_id_fkey"
            columns: ["lote_farinha_principal_id"]
            isOneToOne: false
            referencedRelation: "lotes_insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contextos_dia_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
        ]
      }
      contextos_producao: {
        Row: {
          created_at: string
          hidratacao_ajustada_pct: number | null
          id: string
          notas: string | null
          producao_id: string
          temp_agua_autolise_c: number | null
          temp_massa_pos_batimento_c: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hidratacao_ajustada_pct?: number | null
          id?: string
          notas?: string | null
          producao_id: string
          temp_agua_autolise_c?: number | null
          temp_massa_pos_batimento_c?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hidratacao_ajustada_pct?: number | null
          id?: string
          notas?: string | null
          producao_id?: string
          temp_agua_autolise_c?: number | null
          temp_massa_pos_batimento_c?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contextos_producao_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: true
            referencedRelation: "producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_waitlist: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string | null
          cpf: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          nome: string | null
          whatsapp: string
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          nome?: string | null
          whatsapp: string
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          nome?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      coverage_whitelist: {
        Row: {
          cep: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          note: string | null
        }
        Insert: {
          cep?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          cep?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      etapas_producao: {
        Row: {
          concluida_at: string | null
          created_at: string
          detalhes: Json | null
          dobra_numero: number | null
          etapa_receita_id: string | null
          id: string
          iniciada_at: string | null
          notas: string | null
          ordem: number
          prevista_at: string | null
          producao_id: string
          status: Database["public"]["Enums"]["etapa_status_enum"]
          temp_c: number | null
          tipo: Database["public"]["Enums"]["etapa_tipo_enum"]
          updated_at: string
        }
        Insert: {
          concluida_at?: string | null
          created_at?: string
          detalhes?: Json | null
          dobra_numero?: number | null
          etapa_receita_id?: string | null
          id?: string
          iniciada_at?: string | null
          notas?: string | null
          ordem: number
          prevista_at?: string | null
          producao_id: string
          status?: Database["public"]["Enums"]["etapa_status_enum"]
          temp_c?: number | null
          tipo: Database["public"]["Enums"]["etapa_tipo_enum"]
          updated_at?: string
        }
        Update: {
          concluida_at?: string | null
          created_at?: string
          detalhes?: Json | null
          dobra_numero?: number | null
          etapa_receita_id?: string | null
          id?: string
          iniciada_at?: string | null
          notas?: string | null
          ordem?: number
          prevista_at?: string | null
          producao_id?: string
          status?: Database["public"]["Enums"]["etapa_status_enum"]
          temp_c?: number | null
          tipo?: Database["public"]["Enums"]["etapa_tipo_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_producao_etapa_receita_id_fkey"
            columns: ["etapa_receita_id"]
            isOneToOne: false
            referencedRelation: "etapas_receita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_producao_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_receita: {
        Row: {
          duracao_min: number | null
          id: string
          nome: string
          notas: string | null
          ordem: number
          tipo: Database["public"]["Enums"]["etapa_tipo_enum"] | null
          versao_receita_id: string
        }
        Insert: {
          duracao_min?: number | null
          id?: string
          nome: string
          notas?: string | null
          ordem: number
          tipo?: Database["public"]["Enums"]["etapa_tipo_enum"] | null
          versao_receita_id: string
        }
        Update: {
          duracao_min?: number | null
          id?: string
          nome?: string
          notas?: string | null
          ordem?: number
          tipo?: Database["public"]["Enums"]["etapa_tipo_enum"] | null
          versao_receita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_receita_versao_receita_id_fkey"
            columns: ["versao_receita_id"]
            isOneToOne: false
            referencedRelation: "versoes_receita"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          created_at: string
          id: string
          nome: string
          notas: string | null
          prazo_entrega_dias: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          notas?: string | null
          prazo_entrega_dias?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          notas?: string | null
          prazo_entrega_dias?: number | null
        }
        Relationships: []
      }
      ingredientes: {
        Row: {
          created_at: string
          fornecedor_id: string | null
          id: string
          nome: string
          notas: string | null
          preco_por_kg: number | null
          quantidade_atual_g: number
          quantidade_minima_g: number
          slug: string
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          nome: string
          notas?: string | null
          preco_por_kg?: number | null
          quantidade_atual_g?: number
          quantidade_minima_g?: number
          slug: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          nome?: string
          notas?: string | null
          preco_por_kg?: number | null
          quantidade_atual_g?: number
          quantidade_minima_g?: number
          slug?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredientes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredientes_receita: {
        Row: {
          id: string
          ingrediente_id: string
          notas: string | null
          ordem: number
          percentual_baker: number
          versao_receita_id: string
        }
        Insert: {
          id?: string
          ingrediente_id: string
          notas?: string | null
          ordem?: number
          percentual_baker: number
          versao_receita_id: string
        }
        Update: {
          id?: string
          ingrediente_id?: string
          notas?: string | null
          ordem?: number
          percentual_baker?: number
          versao_receita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredientes_receita_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredientes_receita_versao_receita_id_fkey"
            columns: ["versao_receita_id"]
            isOneToOne: false
            referencedRelation: "versoes_receita"
            referencedColumns: ["id"]
          },
        ]
      }
      janelas_entrega: {
        Row: {
          capacidade_alvo: number | null
          created_at: string
          cutoff_at: string
          data_entrega: string
          id: string
          label: string
          regiao: string | null
          semana_id: string
          status: Database["public"]["Enums"]["janela_status_enum"]
          updated_at: string
        }
        Insert: {
          capacidade_alvo?: number | null
          created_at?: string
          cutoff_at: string
          data_entrega: string
          id?: string
          label?: string
          regiao?: string | null
          semana_id: string
          status?: Database["public"]["Enums"]["janela_status_enum"]
          updated_at?: string
        }
        Update: {
          capacidade_alvo?: number | null
          created_at?: string
          cutoff_at?: string
          data_entrega?: string
          id?: string
          label?: string
          regiao?: string | null
          semana_id?: string
          status?: Database["public"]["Enums"]["janela_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "janelas_entrega_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_insumo: {
        Row: {
          created_at: string
          data_recebimento: string
          fornecedor_id: string | null
          id: string
          identificador: string
          ingrediente_id: string
          notas: string | null
          quantidade_recebida_g: number
          updated_at: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          data_recebimento: string
          fornecedor_id?: string | null
          id?: string
          identificador: string
          ingrediente_id: string
          notas?: string | null
          quantidade_recebida_g: number
          updated_at?: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          data_recebimento?: string
          fornecedor_id?: string | null
          id?: string
          identificador?: string
          ingrediente_id?: string
          notas?: string | null
          quantidade_recebida_g?: number
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_insumo_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_insumo_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_pontuais: {
        Row: {
          composicao: Json
          confirmado_at: string | null
          created_at: string
          destinatario_nome: string | null
          destinatario_whatsapp: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade: string
          endereco_complemento: string | null
          endereco_estado: string
          endereco_numero: string
          endereco_rua: string
          entregue_at: string | null
          id: string
          janela_entrega_id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          motivo: string
          observacoes: string | null
          pagador_cpf_cnpj: string | null
          pagador_email: string | null
          pagador_nome: string
          pagador_whatsapp: string | null
          referencia_externa: string | null
          semana_id: string
          status: string
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          composicao?: Json
          confirmado_at?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_whatsapp?: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade: string
          endereco_complemento?: string | null
          endereco_estado: string
          endereco_numero: string
          endereco_rua: string
          entregue_at?: string | null
          id?: string
          janela_entrega_id: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          motivo: string
          observacoes?: string | null
          pagador_cpf_cnpj?: string | null
          pagador_email?: string | null
          pagador_nome: string
          pagador_whatsapp?: string | null
          referencia_externa?: string | null
          semana_id: string
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          composicao?: Json
          confirmado_at?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_whatsapp?: string | null
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade?: string
          endereco_complemento?: string | null
          endereco_estado?: string
          endereco_numero?: string
          endereco_rua?: string
          entregue_at?: string | null
          id?: string
          janela_entrega_id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento_enum"]
            | null
          motivo?: string
          observacoes?: string | null
          pagador_cpf_cnpj?: string | null
          pagador_email?: string | null
          pagador_nome?: string
          pagador_whatsapp?: string | null
          referencia_externa?: string | null
          semana_id?: string
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_pontuais_janela_entrega_id_fkey"
            columns: ["janela_entrega_id"]
            isOneToOne: false
            referencedRelation: "janelas_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pontuais_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_produtos: {
        Row: {
          created_at: string
          id: string
          papel: Database["public"]["Enums"]["plan_produto_papel"]
          plano_id: string
          produto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel: Database["public"]["Enums"]["plan_produto_papel"]
          plano_id: string
          produto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["plan_produto_papel"]
          plano_id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_produtos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco_frete: number
          preco_por_pao: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco_frete: number
          preco_por_pao: number
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco_frete?: number
          preco_por_pao?: number
          slug?: string
        }
        Relationships: []
      }
      producoes: {
        Row: {
          concluida_at: string | null
          created_at: string
          id: string
          iniciada_at: string | null
          levain_consumido_kg: number | null
          levain_previsto_kg: number | null
          massa_prevista_kg: number | null
          massa_realizada_kg: number | null
          multiplicador: number
          qty_paes_prevista: number | null
          qty_paes_realizada: number | null
          semana_id: string
          status: Database["public"]["Enums"]["producao_status_enum"]
          updated_at: string
          versao_receita_id: string
        }
        Insert: {
          concluida_at?: string | null
          created_at?: string
          id?: string
          iniciada_at?: string | null
          levain_consumido_kg?: number | null
          levain_previsto_kg?: number | null
          massa_prevista_kg?: number | null
          massa_realizada_kg?: number | null
          multiplicador?: number
          qty_paes_prevista?: number | null
          qty_paes_realizada?: number | null
          semana_id: string
          status?: Database["public"]["Enums"]["producao_status_enum"]
          updated_at?: string
          versao_receita_id: string
        }
        Update: {
          concluida_at?: string | null
          created_at?: string
          id?: string
          iniciada_at?: string | null
          levain_consumido_kg?: number | null
          levain_previsto_kg?: number | null
          massa_prevista_kg?: number | null
          massa_realizada_kg?: number | null
          multiplicador?: number
          qty_paes_prevista?: number | null
          qty_paes_realizada?: number | null
          semana_id?: string
          status?: Database["public"]["Enums"]["producao_status_enum"]
          updated_at?: string
          versao_receita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producoes_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producoes_versao_receita_id_fkey"
            columns: ["versao_receita_id"]
            isOneToOne: false
            referencedRelation: "versoes_receita"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          formato: Database["public"]["Enums"]["produto_formato"] | null
          id: string
          nome: string
          peso_alvo_g: number | null
          preco_avulso: number | null
          slug: string
          tipo: Database["public"]["Enums"]["produto_tipo"]
          tipo_cardapio:
            | Database["public"]["Enums"]["tipo_cardapio_enum"]
            | null
          unidade: Database["public"]["Enums"]["produto_unidade"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          formato?: Database["public"]["Enums"]["produto_formato"] | null
          id?: string
          nome: string
          peso_alvo_g?: number | null
          preco_avulso?: number | null
          slug: string
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          tipo_cardapio?:
            | Database["public"]["Enums"]["tipo_cardapio_enum"]
            | null
          unidade?: Database["public"]["Enums"]["produto_unidade"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          formato?: Database["public"]["Enums"]["produto_formato"] | null
          id?: string
          nome?: string
          peso_alvo_g?: number | null
          preco_avulso?: number | null
          slug?: string
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          tipo_cardapio?:
            | Database["public"]["Enums"]["tipo_cardapio_enum"]
            | null
          unidade?: Database["public"]["Enums"]["produto_unidade"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cpf: string
          created_at: string
          nome: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          cpf: string
          created_at?: string
          nome: string
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          cpf?: string
          created_at?: string
          nome?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          created_at: string
          formato: Database["public"]["Enums"]["produto_formato"]
          grupo_sugerido: number
          id: string
          produto_id: string
          updated_at: string
          versao_ativa_id: string | null
        }
        Insert: {
          created_at?: string
          formato: Database["public"]["Enums"]["produto_formato"]
          grupo_sugerido?: number
          id?: string
          produto_id: string
          updated_at?: string
          versao_ativa_id?: string | null
        }
        Update: {
          created_at?: string
          formato?: Database["public"]["Enums"]["produto_formato"]
          grupo_sugerido?: number
          id?: string
          produto_id?: string
          updated_at?: string
          versao_ativa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receitas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_versao_ativa_fk"
            columns: ["versao_ativa_id"]
            isOneToOne: false
            referencedRelation: "versoes_receita"
            referencedColumns: ["id"]
          },
        ]
      }
      semanas: {
        Row: {
          ano: number
          created_at: string
          data_corte: string
          data_entrega: string
          data_fim: string
          data_inicio: string
          id: string
          numero: number
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          data_corte: string
          data_entrega: string
          data_fim: string
          data_inicio: string
          id?: string
          numero: number
          status?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          data_corte?: string
          data_entrega?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          numero?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          bairro: string
          cancelled_at: string | null
          cep: string
          cidade: string
          complemento: string | null
          coverage_unconfirmed: boolean
          cpf: string
          created_at: string
          email: string
          estado: string
          id: string
          itens: Json
          last_payment_at: string | null
          last_payment_event: string | null
          next_billing_change_date: string | null
          next_billing_value: number | null
          nome: string
          numero: string
          paused_at: string | null
          payment_status:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          qty_integral: number | null
          qty_original: number | null
          qty_total: number | null
          rua: string
          status: Database["public"]["Enums"]["subscription_status"]
          total_paes: number
          updated_at: string
          user_id: string | null
          valor_frete: number
          valor_mensal: number
          valor_paes: number
          whatsapp: string
          zona_entrega: string | null
        }
        Insert: {
          activated_at?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          bairro: string
          cancelled_at?: string | null
          cep: string
          cidade: string
          complemento?: string | null
          coverage_unconfirmed?: boolean
          cpf: string
          created_at?: string
          email: string
          estado: string
          id?: string
          itens: Json
          last_payment_at?: string | null
          last_payment_event?: string | null
          next_billing_change_date?: string | null
          next_billing_value?: number | null
          nome: string
          numero: string
          paused_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          qty_integral?: number | null
          qty_original?: number | null
          qty_total?: number | null
          rua: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_paes: number
          updated_at?: string
          user_id?: string | null
          valor_frete: number
          valor_mensal: number
          valor_paes: number
          whatsapp: string
          zona_entrega?: string | null
        }
        Update: {
          activated_at?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          bairro?: string
          cancelled_at?: string | null
          cep?: string
          cidade?: string
          complemento?: string | null
          coverage_unconfirmed?: boolean
          cpf?: string
          created_at?: string
          email?: string
          estado?: string
          id?: string
          itens?: Json
          last_payment_at?: string | null
          last_payment_event?: string | null
          next_billing_change_date?: string | null
          next_billing_value?: number | null
          nome?: string
          numero?: string
          paused_at?: string | null
          payment_status?:
            | Database["public"]["Enums"]["payment_status_enum"]
            | null
          qty_integral?: number | null
          qty_original?: number | null
          qty_total?: number | null
          rua?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_paes?: number
          updated_at?: string
          user_id?: string | null
          valor_frete?: number
          valor_mensal?: number
          valor_paes?: number
          whatsapp?: string
          zona_entrega?: string | null
        }
        Relationships: []
      }
      versoes_receita: {
        Row: {
          archived_at: string | null
          created_at: string
          hidratacao_alvo: number | null
          id: string
          notas: string | null
          numero_versao: number
          perda_coccao: number | null
          peso_massa_g: number | null
          receita_id: string
          status: Database["public"]["Enums"]["versao_receita_status"]
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          hidratacao_alvo?: number | null
          id?: string
          notas?: string | null
          numero_versao: number
          perda_coccao?: number | null
          peso_massa_g?: number | null
          receita_id: string
          status?: Database["public"]["Enums"]["versao_receita_status"]
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          hidratacao_alvo?: number | null
          id?: string
          notas?: string | null
          numero_versao?: number
          perda_coccao?: number | null
          peso_massa_g?: number | null
          receita_id?: string
          status?: Database["public"]["Enums"]["versao_receita_status"]
        }
        Relationships: [
          {
            foreignKeyName: "versoes_receita_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_orders: {
        Row: {
          abandonment_warning_sent_at: string | null
          composition: Json | null
          confirmed_at: string | null
          created_at: string
          delivery_date: string
          extras: Json
          first_extra_added_at: string | null
          id: string
          status: Database["public"]["Enums"]["weekly_order_status"]
          subscription_id: string
          total_extras: number
          updated_at: string
        }
        Insert: {
          abandonment_warning_sent_at?: string | null
          composition?: Json | null
          confirmed_at?: string | null
          created_at?: string
          delivery_date: string
          extras?: Json
          first_extra_added_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["weekly_order_status"]
          subscription_id: string
          total_extras?: number
          updated_at?: string
        }
        Update: {
          abandonment_warning_sent_at?: string | null
          composition?: Json | null
          confirmed_at?: string | null
          created_at?: string
          delivery_date?: string
          extras?: Json
          first_extra_added_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["weekly_order_status"]
          subscription_id?: string
          total_extras?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "v_assinatura_itens"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
    }
    Views: {
      planejamento_semana: {
        Row: {
          qty_pontual: number | null
          qty_recorrente_base: number | null
          qty_recorrente_extra: number | null
          qty_total: number | null
          semana_id: string | null
          slug: string | null
        }
        Relationships: []
      }
      v_assinatura_itens: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          produto_slug: string | null
          quantidade: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          subscription_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ativar_versao_receita: {
        Args: { p_versao_id: string }
        Returns: undefined
      }
      fork_versao_receita: {
        Args: {
          p_status?: Database["public"]["Enums"]["versao_receita_status"]
          p_versao_origem_id: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      mise_en_place_semana: {
        Args: { p_semana_id: string }
        Returns: {
          ingrediente_id: string
          ingrediente_nome: string
          produto_id: string
          produto_nome: string
          qty_g: number
        }[]
      }
      peso_farinha_por_pao: { Args: { p_versao_id: string }; Returns: number }
      popular_cardapio_padrao: {
        Args: { p_semana_id: string }
        Returns: undefined
      }
      popular_etapas_producao: {
        Args: { p_producao_id: string }
        Returns: undefined
      }
    }
    Enums: {
      etapa_status_enum: "aguardando" | "em_curso" | "concluida" | "pulada"
      etapa_tipo_enum:
        | "autolise_mistura"
        | "batimento"
        | "falsa_dobra"
        | "dobra"
        | "pre_shape"
        | "shape"
        | "descanso"
        | "fermentacao_final"
        | "coccao"
      janela_status_enum:
        | "planejamento"
        | "congelada"
        | "em_expedicao"
        | "concluida"
        | "cancelada"
      metodo_pagamento_enum: "pix" | "transferencia" | "boleto" | "asaas"
      payment_status_enum: "em_dia" | "pendente" | "vencido"
      plan_produto_papel: "base" | "rotativa" | "extra"
      producao_status_enum: "planejada" | "em_curso" | "concluida" | "cancelada"
      produto_formato: "banneton" | "couche" | "tabuleiro" | "forma"
      produto_tipo: "fabricado" | "revenda"
      produto_unidade: "un" | "kg"
      subscription_status: "pending_payment" | "active" | "paused" | "cancelled"
      tipo_cardapio_enum: "base" | "fixo" | "rotativo"
      versao_receita_status: "rascunho" | "teste" | "ativa" | "arquivada"
      weekly_order_status: "rascunho" | "confirmado"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      etapa_status_enum: ["aguardando", "em_curso", "concluida", "pulada"],
      etapa_tipo_enum: [
        "autolise_mistura",
        "batimento",
        "falsa_dobra",
        "dobra",
        "pre_shape",
        "shape",
        "descanso",
        "fermentacao_final",
        "coccao",
      ],
      janela_status_enum: [
        "planejamento",
        "congelada",
        "em_expedicao",
        "concluida",
        "cancelada",
      ],
      metodo_pagamento_enum: ["pix", "transferencia", "boleto", "asaas"],
      payment_status_enum: ["em_dia", "pendente", "vencido"],
      plan_produto_papel: ["base", "rotativa", "extra"],
      producao_status_enum: ["planejada", "em_curso", "concluida", "cancelada"],
      produto_formato: ["banneton", "couche", "tabuleiro", "forma"],
      produto_tipo: ["fabricado", "revenda"],
      produto_unidade: ["un", "kg"],
      subscription_status: ["pending_payment", "active", "paused", "cancelled"],
      tipo_cardapio_enum: ["base", "fixo", "rotativo"],
      versao_receita_status: ["rascunho", "teste", "ativa", "arquivada"],
      weekly_order_status: ["rascunho", "confirmado"],
    },
  },
} as const
