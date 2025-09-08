
export const NORMALIZER_PROMPT = `You are an AI assistant that normalizes raw QKD vendor logs into a structured QKDNormalizedV1 JSON format.
You are part of a hybrid system. Some fields may be pre-parsed deterministically.

**Key Instructions:**
1.  **Hybrid Parsing:**
    - You will receive a \`[PRE-PARSED DATA]\` block. These fields were extracted by a high-confidence parser and have a confidence of 1.0. **YOU MUST NOT CHANGE THESE VALUES.**
    - Your primary task is to analyze the \`[REMAINING LOGS TO PARSE]\` block.
    - Extract any relevant fields from the remaining logs that are **NOT** already in the pre-parsed block.
2.  **Provenance:**
    - For every new field you extract from the remaining logs, you MUST create a provenance entry in the "_provenance" array. A provenance entry includes "field" (JSON path), "snippet", and "confidence_score" (0.0-1.0).
    - **DO NOT** create provenance entries for the pre-parsed data; it is handled automatically.
3.  **Final Output:** Combine your extracted data with the pre-parsed data to form a single, complete QKDNormalizedV1 JSON object. If a field exists in both, the pre-parsed value is correct.
4.  **No Invented Data:** If a field is not present in any input, set its value to null.
5.  **Field Mapping:**
    - "sifted_bits" or "block_size" should map to \`security.sifted_bits\`.
    - "qber_total" or "QBER" should map to \`security.qber_total\`. It should be a decimal (e.g., 2.6% becomes 0.026).
    - If only one "epsilon" is provided, map it to \`security.epsilon\`.
    - If "basis_reconciliation" is mentioned, infer \`security.post_processing: true\`.
6.  **Unit Conversions (Deterministic):**
    - If channel frequency is in THz, convert to nm: λ[nm] = 299792.458 / f[THz]. Round to 2 decimals. Populate \`dwdm.channel_nm\`.
    - If launch power is in dBm, convert to mW: P[mW] = 10^(P[dBm]/10). Round to 3 significant figures. Populate \`optics.launch_power_mW\`.
7.  **Data Cleaning:** Sanitize any potentially malicious input in free-text fields like "notes" (e.g., escape HTML).

The output must be a single, valid JSON object that merges the pre-parsed data and your new findings.`;

export const VALIDATION_PROMPT = `You are a QKD Compliance Validation Engine. Your task is to check the provided QKDNormalizedV1 JSON against a list of compliance rules.
For each rule, you must return a status ('✓' for pass, '✗' for fail, '?' for cannot determine) and a brief explanation.
If a rule fails, provide a concise "autofix" JSON suggestion in a string (e.g., '"security.epsilon": 1e-9').
The number of rules to check depends on the plan. For "free" plan, only check the first 5 rules. For "pro" or "enterprise", check all 10.

**Compliance Rules:**
1.  **DWDM Coexistence:** If \`link.link_type\` is "DWDM", require \`dwdm.channel_nm\` and \`dwdm.spacing_GHz\`. Allowed spacing is 50 or 100 (±5 GHz tolerance).
2.  **Epsilon Presence/Range:** Require \`security.epsilon\` (or \`epsilon_sec\`/\`epsilon_cor\`) to be present and between 1e-12 and 1e-6. If missing, fail and suggest autofix: \`{"reason": "policy_default", "policy_ref": "qkd/epsilon-default"}\` by setting \`"security.epsilon": 1e-9\`.
3.  **QBER Threshold (BB84):** If \`meta.protocol\` is "BB84", \`security.qber_total\` must be ≤ 0.11.
4.  **Sifted Key Length:** \`security.sifted_bits\` must be ≥ 1,000,000.
5.  **Authentication Present:** If \`security.post_processing\` is true, \`security.authentication\` must be present (e.g., not null or empty).
6.  **Clock Sync Present:** Must be present if \`meta.profile\` is "field" OR \`link.distance_km\` > 20. (Inferred rule, check for anomalies or missing data that would indicate sync issues, but for this test, just check for presence of fields that would be affected, like a valid QBER). Status is '?' if not obviously bad.
7.  **Basis Reconciliation Method:** \`security.basis_reconciliation\` must be present and a known value (e.g., "Cascade", "LDPC").
8.  **Integrity/Meta Present:** Require \`meta.run_id\`, \`meta.timestamp\` (valid ISO 8601), and \`meta.firmware_version\` to be non-null.
9.  **Detector Saturation:** If \`detector.count_rate_Mcps\` and \`detector.max_Mcps\` are present, \`count_rate_Mcps\` must be ≤ \`max_Mcps\`.
10. **Loss Budget Sanity:** If \`link.alpha_dB_per_km\` and \`link.distance_km\` are present, \`link.fiber_loss_dB\` must be approximately equal to (\`alpha_dB_per_km\` * \`distance_km\`) ± 0.5 dB.

Your entire response MUST be a single, valid JSON array of objects, where each object has "rule", "status", "explanation", and optionally "autofix".`;


export const sampleLogs = {
  'H1: Toshiba (JSON)': `
{
  "meta": {
    "vendor": "Toshiba",
    "model": "TQKD-1000",
    "run_id": "TSH-2025-09-08-001",
    "protocol": "BB84",
    "link_type": "fiber",
    "profile": "lab",
    "firmware_version": "3.1.2",
    "timestamp": "2025-09-08T10:15:00Z"
  },
  "link": {
    "distance_km": 25.2,
    "fiber_loss_dB": 5.2,
    "alpha_dB_per_km": 0.20
  },
  "security": {
    "epsilon": 1e-9,
    "qber_total": 0.026,
    "sifted_bits": 1500000,
    "sifted_key_rate_bps": 180000,
    "basis_reconciliation": "Cascade",
    "authentication": "Wegman-Carter"
  },
  "detector": { "count_rate_Mcps": 8.5, "max_Mcps": 20 },
  "dwdm": null
}`,
  'H2: IDQ (CSV)': `timestamp,vendor,model,run_id,protocol,link_type,profile,firmware_version,distance_km,fiber_loss_dB,alpha_dB_per_km,qber_total,sifted_bits,sifted_key_rate_bps,basis_reconciliation,authentication
2025-09-08T09:00:00Z,IDQ,Clavis3000,IDQ-0908-001,BB84,fiber,field,5.0.0,40,8.4,0.21,0.031,1200000,150000,Cascade,Wegman-Carter`,
  'H4: C-DOT (Table)': `
timestamp: 2025-09-08T07:30:00Z
vendor: CDOT
model: Sahasra
run_id: CDOT-0730-101
protocol: BB84
link_type: fiber
profile: field
firmware_version: 1.4.7
distance_km: 10.0
fiber_loss_dB: 2.1
alpha_dB_per_km: 0.20
qber_total: 0.02
sifted_bits: 1_050_000
sifted_key_rate_bps: 200000
basis_reconciliation: Cascade
authentication: Wegman-Carter
detector_count_rate_Mcps: 9.0
detector_max_Mcps: 20
`,
  'N1: Missing Epsilon': `
{
  "meta": {
    "vendor": "IDQ",
    "model": "Clavis3000",
    "run_id": "IDQ-0908-002",
    "protocol": "BB84",
    "link_type": "fiber",
    "profile": "field",
    "firmware_version": "5.0.0",
    "timestamp": "2025-09-08T11:00:00Z"
  },
  "link": { "distance_km": 40, "fiber_loss_dB": 8.4, "alpha_dB_per_km": 0.21 },
  "security": {
    "qber_total": 0.031,
    "sifted_bits": 1200000,
    "sifted_key_rate_bps": 120000,
    "basis_reconciliation": "Cascade",
    "authentication": "Wegman-Carter"
  }
}`,
  'N2: High QBER': `
{
  "meta": {
    "vendor": "Toshiba", "model": "TQKD-1000", "run_id": "TSH-2025-09-08-ERR", "protocol": "BB84", "link_type": "fiber", "profile": "lab", "firmware_version": "3.1.2", "timestamp": "2025-09-08T12:00:00Z"
  },
  "link": { "distance_km": 20, "fiber_loss_dB": 4.0, "alpha_dB_per_km": 0.20 },
  "security": { "epsilon": 1e-9, "qber_total": 0.18, "sifted_bits": 1600000, "sifted_key_rate_bps": 50000, "basis_reconciliation": "Cascade", "authentication": "Wegman-Carter"
  }
}`,
  'E3: Saturation': `
{
  "meta": { "vendor": "Toshiba", "model": "TQKD-1000", "run_id": "TSH-SAT-001", "protocol": "BB84", "link_type": "fiber", "profile": "lab", "firmware_version": "3.1.2", "timestamp": "2025-09-08T13:15:00Z"
  },
  "link": { "distance_km": 5, "fiber_loss_dB": 1.0, "alpha_dB_per_km": 0.20 },
  "security": { "epsilon": 1e-9, "qber_total": 0.02, "sifted_bits": 900000, "sifted_key_rate_bps": 1000000, "basis_reconciliation": "Cascade", "authentication": "Wegman-Carter"
  },
  "detector": { "count_rate_Mcps": 25, "max_Mcps": 20 }
}`
};

export type SampleLogKey = keyof typeof sampleLogs;
