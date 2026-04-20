/**
 * @file   llm-extract-response.interface.ts
 * @module EDA — contract with the Python AI service's /eda/extract endpoint.
 */

export interface LlmInvoiceFields {
  dealer_name: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_registration_number: string | null;
  tyre_size: string | null;
  tyre_pattern: string | null;
  invoice_amount_excl_gst: string | null;         // Decimal serialised as string
  gst_amount: string | null;
  gst_components: Record<string, number> | null;
  quantity: number | null;
  invoice_date: string | null;
  invoice_number: string | null;
  comments: string | null;
}

export interface LlmExtractResponse {
  record_id: string;
  fields: LlmInvoiceFields | null;
  confidence_score: number;
  status: 'EXTRACTED' | 'PARTIAL' | 'FAILED';
  llm_provider_used: string;
  raw_llm_response: Record<string, unknown> | null;
  ocr_text: string | null;
  warnings: string[];
  error_message: string | null;
}
