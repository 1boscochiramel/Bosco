
export interface ProvenanceEntry {
  field: string;
  span?: { // Span may not always be available for inferred fields
    start: number;
    end: number;
  };
  snippet: string;
  confidence_score?: number;
  top_3_alternatives?: string[];
}

// Greatly expanded schema to match test fixtures and validation rules
export interface QKDNormalizedV1 {
  meta: {
    vendor?: string | null;
    model?: string | null;
    run_id?: string | null;
    protocol?: string | null;
    link_type?: 'fiber' | 'free_space' | 'satellite' | 'DWDM' | null;
    profile?: 'lab' | 'field' | null;
    firmware_version?: string | null;
    timestamp?: string | null; // ISO 8601
  };
  link: {
    distance_km?: number | null;
    fiber_loss_dB?: number | null;
    alpha_dB_per_km?: number | null; // Fiber attenuation coefficient
  };
  security: {
    epsilon?: number | null; // Overall security parameter
    epsilon_sec?: number | null; // Secrecy
    epsilon_cor?: number | null; // Correctness
    qber_total?: number | null; // Quantum Bit Error Rate as a decimal (e.g., 0.026)
    sifted_bits?: number | null; // Also referred to as block size
    sifted_key_rate_bps?: number | null;
    basis_reconciliation?: string | null; // e.g., "Cascade", "LDPC"
    authentication?: string | null; // e.g., "Wegman-Carter"
    post_processing?: boolean; // Inferred
  };
  detector?: {
      count_rate_Mcps?: number | null;
      max_Mcps?: number | null;
  };
  dwdm?: {
      channel_nm?: number | null;
      channel_THz?: number | null;
      spacing_GHz?: number | null;
  } | null;
  optics?: {
      launch_power_dBm?: number | null;
      launch_power_mW?: number | null;
  };
  dv_specific?: {
    ec_efficiency_beta?: number | null;
  };
  _provenance?: ProvenanceEntry[];
  notes?: string | null;
}


export interface SKRTraceEntry {
  step: string;
  value: string | number;
  formula?: string;
}

// New type for validation results
export type ValidationStatus = '✓' | '✗' | '?';
export interface ValidationRuleResult {
    rule: string;
    status: ValidationStatus;
    explanation: string;
    autofix?: string; // Changed from suggestion to autofix to match spec
}

// New type for the deterministic SKR calculation output
export interface FiniteKeyCalculation {
    equation: string;
    inputs: { [key: string]: number | string | null | undefined };
    intermediates: { [key: string]: number | null };
    R_secure_bps: number | null;
    error?: string;
    trace: SKRTraceEntry[];
}

// New type for report bundle
export interface ReportBundle {
    report_html: string;
    report_summary: any;
    hash: string;
}

// New type for metadata
export type Plan = 'free' | 'pro' | 'enterprise';
export type Verbosity = 'short' | 'medium' | 'full';

export interface AppMetadata {
    parser_used: 'llm';
    verbosity: Verbosity;
    plan: Plan;
    session_id: string;
    log_id: string;
    timestamp: string;
    throttle: string;
    yc_metrics: {
        latency_ms: number;
    };
    pricing_hint: string;
    referral_hint: string;
    integration_hint: string[];
    enterprise_features?: {
        sso_enabled: boolean;
        audit_trail: string;
        sla: string;
    }
}

// The main output object for the app state
export interface AppOutput {
    normalized_data: QKDNormalizedV1;
    validation_results: ValidationRuleResult[];
    finite_key_skr: FiniteKeyCalculation;
    report: ReportBundle;
    meta: AppMetadata;
    error?: string;
}
