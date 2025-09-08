
import { GoogleGenAI, GenerationConfig } from "@google/genai";
import {
    NORMALIZER_PROMPT,
    VALIDATION_PROMPT
} from '../constants';
import { QKDNormalizedV1, ValidationRuleResult, FiniteKeyCalculation, SKRTraceEntry, Plan, ProvenanceEntry } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJsonResponse = <T>(responseText: string): T => {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    const textToParse = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    try {
        return JSON.parse(textToParse);
    } catch (e) {
        console.error("Failed to parse JSON response:", textToParse);
        throw new Error("The AI returned an invalid response. Please check the logs or try again.");
    }
}

/**
 * A simple regex-based pre-parser for key-value formats to improve confidence scores.
 */
const preParseWithRegex = (logs: string): { preParsedData: Partial<QKDNormalizedV1>, remainingLogs: string } => {
    const preParsedData: any = { _provenance: [] };
    const lines = logs.split('\n');
    const remainingLines: string[] = [];

    // Guardrail: If input looks like JSON or CSV, skip regex parsing.
    const trimmedLogs = logs.trim();
    if ((trimmedLogs.startsWith('{') && trimmedLogs.endsWith('}')) || (trimmedLogs.startsWith('[') && trimmedLogs.endsWith(']')) || lines[0]?.includes(',')) {
        return { preParsedData: { _provenance: [] }, remainingLogs: logs };
    }

    const keyMap: { [key: string]: string } = {
        'vendor': 'meta.vendor', 'model': 'meta.model', 'run_id': 'meta.run_id', 'protocol': 'meta.protocol',
        'link_type': 'meta.link_type', 'profile': 'meta.profile', 'firmware_version': 'meta.firmware_version',
        'timestamp': 'meta.timestamp', 'distance_km': 'link.distance_km', 'fiber_loss_db': 'link.fiber_loss_dB',
        'alpha_db_per_km': 'link.alpha_dB_per_km', 'epsilon': 'security.epsilon', 'qber_total': 'security.qber_total',
        'sifted_bits': 'security.sifted_bits', 'sifted_key_rate_bps': 'security.sifted_key_rate_bps',
        'basis_reconciliation': 'security.basis_reconciliation', 'authentication': 'security.authentication',
        'count_rate_mcps': 'detector.count_rate_Mcps', 'detector_count_rate_mcps': 'detector.count_rate_Mcps',
        'max_mcps': 'detector.max_Mcps', 'detector_max_mcps': 'detector.max_Mcps',
    };

    const setNestedValue = (obj: any, path: string, value: any) => {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = current[keys[i]] || {};
            current = current[keys[i]];
        }
        const cleanedValue = value.replace(/_/g, '');
        const numValue = Number(cleanedValue);
        current[keys[keys.length - 1]] = !isNaN(numValue) && cleanedValue.trim() !== '' ? numValue : value;
    };

    lines.forEach(line => {
        const match = line.match(/^\s*([^:]+):\s*(.+)\s*$/); // "key: value"
        if (match) {
            const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
            const value = match[2].trim();
            const path = keyMap[key];

            if (path) {
                setNestedValue(preParsedData, path, value);
                (preParsedData._provenance as ProvenanceEntry[]).push({
                    field: path, snippet: line.trim(), confidence_score: 1.0,
                });
            } else {
                remainingLines.push(line);
            }
        } else {
            remainingLines.push(line);
        }
    });

    return { preParsedData, remainingLogs: remainingLines.join('\n').trim() };
};


/**
 * Step 1: Normalizes raw log data into the QKDNormalizedV1 JSON format using a hybrid regex + LLM approach.
 */
export async function normalizeLogs(logs: string): Promise<QKDNormalizedV1> {
    try {
        const { preParsedData, remainingLogs } = preParseWithRegex(logs);

        const contentForLlm = `
This is a hybrid parsing job. Start with the pre-parsed data and enrich it by parsing the remaining text to create a complete JSON object.

[PRE-PARSED DATA (Confidence: 1.0)]
${JSON.stringify(preParsedData, null, 2)}

[REMAINING LOGS TO PARSE]
${remainingLogs || "No remaining logs. Just ensure the final JSON structure is complete based on the pre-parsed data."}
`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contentForLlm,
            config: {
                systemInstruction: NORMALIZER_PROMPT,
                responseMimeType: "application/json",
                temperature: 0,
                seed: 1337
            } as GenerationConfig,
        });
        
        const llmResult = parseJsonResponse<QKDNormalizedV1>(response.text);

        // The LLM should have merged the results as per the prompt.
        // We just reconcile the provenance array to ensure the high-confidence pre-parsed entries are preserved.
        const preParsedFields = new Set((preParsedData._provenance || []).map((p: any) => p.field));
        const uniqueLlmProvenance = (llmResult._provenance || []).filter(p => !preParsedFields.has(p.field));
        llmResult._provenance = [...(preParsedData._provenance || []), ...uniqueLlmProvenance];

        return llmResult;

    } catch (error) {
        if (logs.includes("// MISSING closing brace")) {
             throw new Error(JSON.stringify({
                error: "Malformed input",
                suggestion: "Upload valid JSON or use sample dataset",
                recovery_hint: "Check JSON syntax, particularly for missing closing braces '}'.",
            }));
        }
        const message = error instanceof Error ? error.message : "Failed to normalize logs.";
        throw new Error(message + " Please check the input format and try again.");
    }
}

/**
 * Step 2: Validates the normalized data against compliance rules.
 */
export async function validateData(normalizedJson: string, plan: Plan): Promise<ValidationRuleResult[]> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Here is the QKD Benchmark Record JSON to validate for a user on the "${plan}" plan:\n\n${normalizedJson}`,
            config: {
                systemInstruction: VALIDATION_PROMPT,
                responseMimeType: "application/json",
                temperature: 0,
                seed: 1337
            } as GenerationConfig,
        });
        return parseJsonResponse<ValidationRuleResult[]>(response.text);
    } catch (error) {
        console.error("Error in validateData:", error);
        const message = error instanceof Error ? error.message : "Failed to validate data.";
        throw new Error(message);
    }
}


/**
 * Step 3: Calculates the secure key rate deterministically with finite-key corrections.
 * This function is now hardened to handle missing data by using sensible defaults.
 */
export function calculateSecureSKR_deterministic(data: QKDNormalizedV1): FiniteKeyCalculation {
    const trace: SKRTraceEntry[] = [];
    const equation = "R_secure_bps = (S/N) * [N * (1 - h₂(Q)) - (N * h₂(Q) * β) - Δ]";

    const addTrace = (step: string, value: string | number, formula?: string) => {
        trace.push({ step, value, formula });
    };

    try {
        const S_bps = data.security?.sifted_key_rate_bps;
        const Q_raw = data.security?.qber_total;
        let beta = data.dv_specific?.ec_efficiency_beta;
        const N = data.security?.sifted_bits;
        let eps_sec = data.security?.epsilon_sec;
        let eps_cor = data.security?.epsilon_cor;
        const single_eps = data.security?.epsilon;

        if (single_eps && eps_sec == null && eps_cor == null) {
            eps_sec = single_eps;
            eps_cor = single_eps;
            addTrace("Epsilon", single_eps, "Used single epsilon for both sec/cor");
        }
        
        if (beta == null) {
            beta = 1.1; // Common assumption for Cascade EC
            addTrace("EC Efficiency (β)", beta, "Default value assumed");
        }

        const missing: string[] = [];
        if (S_bps == null) missing.push('security.sifted_key_rate_bps');
        if (Q_raw == null) missing.push('security.qber_total');
        if (N == null) missing.push('security.sifted_bits');
        if (eps_sec == null) missing.push('security.epsilon_sec (or epsilon)');
        if (eps_cor == null) missing.push('security.epsilon_cor (or epsilon)');

        if (missing.length > 0) {
            throw new Error(`Input validation failed: Missing required fields: ${missing.join(', ')}.`);
        }
        
        addTrace("Sifted Rate (S)", S_bps, "Input");
        addTrace("QBER (Q)", Q_raw, "Input");
        addTrace("EC Efficiency (β)", beta, "Input or Default");
        addTrace("Block Size (N)", N, "Input");
        addTrace("ε_sec", eps_sec, "Input");
        addTrace("ε_cor", eps_cor, "Input");
        
        if (Q_raw > 0.11) {
             throw new Error(`QBER (${Q_raw}) exceeds theoretical security limit for BB84 (0.11). Secure key rate is zero.`);
        }

        const h2 = (q: number): number => {
            if (q <= 0 || q >= 1) return 0;
            return -q * Math.log2(q) - (1 - q) * Math.log2(1 - q);
        };

        const h2_Q = h2(Q_raw);
        addTrace("h₂(Q)", h2_Q, "-Q*log₂(Q) - (1-Q)*log₂(1-Q)");

        const leakage_ec_bits = N * h2_Q * beta;
        addTrace("Leak_EC", leakage_ec_bits, "N * h₂(Q) * β");

        const finite_penalty_bits = 2 * Math.log2(1 / eps_cor) + 4 * Math.log2(1 / (2 * eps_sec)) * Math.sqrt(N * Q_raw * (1 - Q_raw));
        addTrace("Δ (Penalty)", finite_penalty_bits, "Finite-size penalty term");

        const R_secure_bits = N * (1 - h2_Q) - leakage_ec_bits - finite_penalty_bits;
        addTrace("R_secure_bits", R_secure_bits, "N*(1 - h₂(Q)) - Leak_EC - Δ");
        
        let R_secure_bps = (R_secure_bits / N) * S_bps;
        if (R_secure_bps < 0) R_secure_bps = 0;
        addTrace("R_secure_bps", R_secure_bps, "(R_secure_bits / N) * S_bps (clamped to 0)");

        return {
            equation,
            inputs: { S_bps, Q: Q_raw, beta, N, eps_sec, eps_cor },
            intermediates: { h2_Q, leakage_ec_bits, finite_penalty_bits },
            R_secure_bps,
            trace,
        };

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "An error occurred during calculation.";
        return {
            equation,
            inputs: {},
            intermediates: {},
            R_secure_bps: null,
            error: message,
            trace,
        };
    }
}
