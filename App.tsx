
import React, { useState } from 'react';
import { normalizeLogs, validateData, calculateSecureSKR_deterministic } from './services/geminiService';
import { sampleLogs, SampleLogKey } from './constants';
import { LogInput } from './components/LogInput';
import { GithubIcon, SparklesIcon, BadgeCheckIcon, CheckCircleIcon, XCircleIcon, InfoIcon, DownloadIcon, ChevronDownIcon, HelpCircleIcon, AlertTriangleIcon } from './components/Icons';
import { AppOutput, QKDNormalizedV1, ValidationRuleResult, FiniteKeyCalculation, AppMetadata, Plan, Verbosity, ProvenanceEntry } from './types';

type View = 'home' | 'processing' | 'results';

const App: React.FC = () => {
    const [view, setView] = useState<View>('home');
    const [rawLogs, setRawLogs] = useState<string>('');
    const [appOutput, setAppOutput] = useState<AppOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processingStep, setProcessingStep] = useState<string | null>(null);
    
    // New state for UI controls
    const [plan, setPlan] = useState<Plan>('pro');
    const [verbosity, setVerbosity] = useState<Verbosity>('medium');


    const handleNewRun = () => {
        setView('home');
        setRawLogs('');
        setAppOutput(null);
        setError(null);
        setProcessingStep(null);
    };

    const runPipeline = async (logs: string) => {
        setView('processing');
        setError(null);
        setAppOutput(null);
        const startTime = Date.now();

        try {
            setProcessingStep('Normalizing vendor logs...');
            const normData = await normalizeLogs(logs);

            setProcessingStep('Validating against compliance rules...');
            const validationResults = await validateData(JSON.stringify(normData), plan);

            setProcessingStep('Running deterministic SKR calculation...');
            const skrCalc = calculateSecureSKR_deterministic(normData);

            // Assemble the final output object
            const sessionId = `sess_${Date.now().toString(36)}`;
            const finalOutput: AppOutput = {
                normalized_data: normData,
                validation_results: validationResults,
                finite_key_skr: skrCalc,
                report: { // Stubs for reporting
                    report_html: "<html><body><h1>QKD Report</h1>...</body></html>",
                    report_summary: { skr: skrCalc.R_secure_bps },
                    hash: "connector_stub_sha256:84e763cba4fdc13d0078aab480876660f45692a3b5b57bd4bbf918566e3e5c38"
                },
                meta: generateAppMetadata(plan, verbosity, sessionId, startTime),
            };

            setAppOutput(finalOutput);
            setView('results');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during the pipeline.';
            setError(message);
            setView('results');
        } finally {
            setProcessingStep(null);
        }
    };
    
    const generateAppMetadata = (currentPlan: Plan, currentVerbosity: Verbosity, sessionId: string, startTime: number): AppMetadata => {
        const pricing_hints = {
            free: "Upgrade to PRO for full validation checklist + certified PDF report.",
            pro: "Contact sales for Enterprise SSO, audit logs, and priority SLA.",
            enterprise: "Enterprise customers unlock dedicated compliance reports and integrations."
        };
        const referral_hints = {
            free: "Invite a colleague to unlock 1 bonus validation rule check.",
            pro: "Invite your team to unlock a shared monitoring dashboard.",
            enterprise: "Refer a partner for early access to our integration marketplace."
        };

        const meta: AppMetadata = {
            parser_used: 'llm',
            verbosity: currentVerbosity,
            plan: currentPlan,
            session_id: sessionId,
            log_id: `run_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: "2025-09-08T12:00:00Z", // Frozen timestamp for deterministic testing
            throttle: "10 req/min",
            yc_metrics: {
                latency_ms: Date.now() - startTime,
            },
            pricing_hint: pricing_hints[currentPlan],
            referral_hint: referral_hints[currentPlan],
            integration_hint: [ "API endpoint available", "Slack/Notion plug-in", "Chrome extension demo-ready", "Webhook integration" ]
        };
        
        if (currentPlan === 'enterprise') {
            meta.enterprise_features = {
                sso_enabled: true,
                audit_trail: "connector_stub_audit",
                sla: "24h_response"
            };
        }
        
        return meta;
    };

    const startRun = () => {
        if (!rawLogs.trim()) {
            alert("Please paste, upload, or select sample logs before starting.");
            return;
        }
        runPipeline(rawLogs);
    };

    const loadSampleAndStart = (key: SampleLogKey) => {
        const logs = sampleLogs[key];
        setRawLogs(logs);
        // Use a timeout to ensure state update before starting pipeline
        setTimeout(() => runPipeline(logs), 0);
    };

    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const blob = new Blob([content], { type: contentType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- RENDER LOGIC ---

    const NavBar = () => (
         <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg sticky top-0 z-20">
            <div className="container mx-auto flex justify-between items-center">
                <div className="flex items-center gap-6">
                     <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                        QBench
                    </h1>
                     <div className="hidden md:flex items-center gap-4 text-sm">
                        <label htmlFor="plan-select" className="text-gray-400">Plan:</label>
                        <select id="plan-select" value={plan} onChange={e => setPlan(e.target.value as Plan)} className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-purple-500 focus:border-purple-500">
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                         <label htmlFor="verbosity-select" className="text-gray-400">Verbosity:</label>
                        <select id="verbosity-select" value={verbosity} onChange={e => setVerbosity(e.target.value as Verbosity)} className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-purple-500 focus:border-purple-500">
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="full">Full</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleNewRun} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors">
                        New Run
                    </button>
                    <a href="https://github.com/google/generative-ai-docs" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                        <GithubIcon />
                    </a>
                </div>
            </div>
        </header>
    );

    const HomeView = () => (
        <div className="container mx-auto p-4 md:p-8 flex flex-col items-center text-center">
            <h2 className="text-4xl font-bold mt-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Finite-Key QKD Engine
            </h2>
            <p className="mt-4 text-lg text-gray-400 max-w-2xl">
                Upload raw QKD logs to get a standardized, validated, and regulator-ready benchmark report.
            </p>
            <div className="w-full max-w-3xl mt-8">
                <LogInput value={rawLogs} onChange={e => setRawLogs(e.target.value)} loadSample={loadSampleAndStart} />
            </div>
             <button
                onClick={startRun}
                disabled={!rawLogs.trim()}
                className="mt-6 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:text-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 text-lg"
            >
                <SparklesIcon />
                Analyze & Report
            </button>
             <div className="mt-16 w-full max-w-4xl text-left">
                <h3 className="text-xl font-semibold text-center text-gray-200">A Verifiable, Reproducible Crypto Calculator</h3>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                    {['Deterministic Engine', 'Compliance Checklist', 'Full Provenance', 'Input Validation', 'Reproducible', 'Exportable Reports'].map(item => (
                        <div key={item} className="flex items-center gap-2 bg-gray-800/50 p-3 rounded-lg">
                            <BadgeCheckIcon className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm text-gray-300">{item}</span>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );

    const ProcessingView = () => (
        <div className="text-center p-16 flex flex-col items-center justify-center">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 animate-spin" style={{ borderTopColor: '#a855f7' }}></div>
            <p className="text-lg text-gray-300">{processingStep || 'Initializing...'}</p>
        </div>
    );
    
    // -- Results View Components --

    const SKRResultCard: React.FC<{ result: FiniteKeyCalculation }> = ({ result }) => {
        const hasError = !!result.error || result.R_secure_bps === null || result.R_secure_bps <= 0;
        
        if (hasError) {
             return (
                <div className="border-l-4 border-red-500 bg-gray-800/70 p-4 rounded-r-lg">
                    <div className="flex items-center gap-3">
                        <XCircleIcon className="w-8 h-8 text-red-400" />
                        <div>
                            <h2 className="text-xl font-bold text-red-400">Verdict: FAIL</h2>
                            <p className="text-sm text-gray-400">{result.error || "Secure Key Rate is zero or could not be computed."}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="border-l-4 border-green-500 bg-gray-800/70 p-4 rounded-r-lg">
                <div className="flex items-start gap-4">
                    <CheckCircleIcon className="w-8 h-8 text-green-400 mt-1 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-gray-400">Secure Key Rate (R_secure)</p>
                        <h2 className="text-3xl font-bold text-green-400">
                            {(result.R_secure_bps ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} bps
                        </h2>
                    </div>
                </div>
            </div>
        );
    };
    
    const ValidationChecklist: React.FC<{ results: ValidationRuleResult[], plan: Plan }> = ({ results, plan }) => {
        const rulesToShow = plan === 'free' ? 5 : results.length;
        const hiddenRules = results.length - rulesToShow;

        return (
            <div className="space-y-3">
                {results.slice(0, rulesToShow).map((res, i) => (
                    <div key={i} className="flex items-start gap-3">
                        {res.status === '✓' && <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                        {res.status === '✗' && <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                        {res.status === '?' && <HelpCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />}
                        <div>
                            <p className="font-semibold text-gray-200">{res.rule}</p>
                            <p className="text-sm text-gray-400">{res.explanation}</p>
                            {res.autofix && <p className="text-xs mt-1 text-purple-400 bg-purple-900/30 p-1 rounded font-mono">Autofix: {res.autofix}</p>}
                        </div>
                    </div>
                ))}
                 {hiddenRules > 0 && (
                    <div className="border-t border-gray-700 pt-3 mt-3 text-center">
                        <p className="text-sm text-yellow-400">
                            <AlertTriangleIcon className="w-4 h-4 inline mr-1" />
                            {hiddenRules} more checks available. <span className="font-bold">Upgrade to PRO for the full validation suite.</span>
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const SKRDerivationView: React.FC<{ calc: FiniteKeyCalculation }> = ({ calc }) => (
        <div className="space-y-4 text-sm font-mono">
            <div>
                <h4 className="font-semibold text-gray-300 mb-2 text-sans">Equation:</h4>
                <p className="bg-gray-900/70 p-2 rounded-md text-xs text-cyan-400">{calc.equation}</p>
            </div>
             <div>
                <h4 className="font-semibold text-gray-300 mb-2 text-sans">Inputs:</h4>
                <div className="bg-gray-900/70 p-3 rounded-md grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {Object.entries(calc.inputs).map(([key, value]) =>(
                    <p key={key}>{key} = <span className="text-purple-400">{String(value)}</span></p>
                ))}
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300 mb-2 text-sans">Execution Trace:</h4>
                <div className="overflow-x-auto rounded-md border border-gray-700 max-h-60">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-900/70 sticky top-0"><tr className="text-gray-400 text-sans"><th className="p-2 font-normal">Step</th><th className="p-2 font-normal">Formula / Note</th><th className="p-2 font-normal">Value</th></tr></thead>
                        <tbody className="divide-y divide-gray-700">
                             {calc.trace.map((t, i) => (
                                <tr key={i} className="hover:bg-gray-800/50">
                                    <td className="p-2 text-purple-400">{t.step}</td>
                                    <td className="p-2 text-gray-400 truncate" title={t.formula}>{t.formula}</td>
                                    <td className="p-2 text-cyan-400">{typeof t.value === 'number' ? t.value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : t.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    
     const ProvenanceView: React.FC<{ provenance: ProvenanceEntry[] }> = ({ provenance }) => (
        <div className="overflow-x-auto rounded-md border border-gray-700 max-h-96">
            <table className="w-full text-xs text-left">
                <thead className="bg-gray-900/70 sticky top-0"><tr className="text-gray-400"><th className="p-2">Field</th><th className="p-2">Snippet</th><th className="p-2">Confidence</th></tr></thead>
                <tbody className="divide-y divide-gray-700">
                    {provenance.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-800/50">
                            <td className="p-2 font-mono text-purple-400">{p.field}</td>
                            <td className="p-2 font-mono text-gray-400 truncate" title={p.snippet}>{p.snippet}</td>
                            <td className="p-2 font-mono text-cyan-400">{p.confidence_score?.toFixed(2) ?? 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

     const MetadataView: React.FC<{ meta: AppMetadata }> = ({ meta }) => (
        <div className="text-sm space-y-4">
             <div className="bg-gray-900/70 p-3 rounded-md font-mono text-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div><span className="text-gray-400">Session ID:</span> {meta.session_id}</div>
                 <div><span className="text-gray-400">Log ID:</span> {meta.log_id}</div>
                 <div><span className="text-gray-400">Timestamp:</span> {meta.timestamp}</div>
                 <div><span className="text-gray-400">Latency:</span> {meta.yc_metrics.latency_ms} ms</div>
             </div>
             {meta.enterprise_features && (
                 <div className="bg-gray-900/70 p-3 rounded-md font-mono text-xs">
                     <p className="font-sans font-semibold text-gray-300 mb-2">Enterprise Features:</p>
                     <div><span className="text-gray-400">SSO Enabled:</span> {String(meta.enterprise_features.sso_enabled)}</div>
                     <div><span className="text-gray-400">Audit Trail:</span> {meta.enterprise_features.audit_trail}</div>
                     <div><span className="text-gray-400">SLA:</span> {meta.enterprise_features.sla}</div>
                 </div>
             )}
             <div className="p-3 rounded-md border border-purple-500/30 bg-purple-900/20">
                 <p className="font-semibold text-purple-300">Monetization Hint</p>
                 <p className="text-purple-400 text-xs mt-1">{meta.pricing_hint}</p>
             </div>
             <div className="p-3 rounded-md border border-cyan-500/30 bg-cyan-900/20">
                 <p className="font-semibold text-cyan-300">Growth Hook</p>
                 <p className="text-cyan-400 text-xs mt-1">{meta.referral_hint}</p>
             </div>
             <div>
                <h4 className="font-semibold text-gray-300 mb-2">Integration Hooks</h4>
                <div className="flex flex-wrap gap-2">
                    {meta.integration_hint.map(hint => <span key={hint} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{hint}</span>)}
                </div>
            </div>
        </div>
    );


    const ResultsView = () => {
        const [activeTab, setActiveTab] = useState('validation');
        if (!appOutput) return null;

        const tabs = [
            { id: 'validation', label: 'Validation' },
            { id: 'derivation', label: 'SKR Derivation' },
            { id: 'data', label: 'Normalized Data' },
            { id: 'meta', label: 'Metadata & Hooks' },
        ];
        
        const renderDataTab = () => {
            if (verbosity === 'short') {
                return <p className="text-gray-400">Switch to Medium or Full verbosity to see the normalized data.</p>;
            }
            return (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-300 mb-2 text-sans">Canonical JSON Output:</h4>
                        <pre className="bg-gray-900/70 p-3 rounded-md text-xs text-white overflow-x-auto max-h-96">
                            {JSON.stringify(appOutput.normalized_data, null, 2)}
                        </pre>
                    </div>
                    {verbosity === 'full' && appOutput.normalized_data._provenance && (
                        <div>
                            <h4 className="font-semibold text-gray-300 mb-2 text-sans">Provenance Details:</h4>
                            <ProvenanceView provenance={appOutput.normalized_data._provenance} />
                        </div>
                    )}
                    {verbosity === 'medium' && <p className="text-gray-400 text-sm">Switch to Full verbosity to see detailed field provenance.</p>}
                </div>
            );
        };

        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="flex flex-col gap-6">
                    {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
                    
                    <SKRResultCard result={appOutput.finite_key_skr} />

                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => downloadFile(JSON.stringify(appOutput, null, 2), `qbench-output-${appOutput.meta.log_id}.json`, 'application/json')} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors"><DownloadIcon/> Download Full Output</button>
                    </div>

                    <div className="border border-gray-700 rounded-lg bg-gray-800/50 mt-4">
                        <div className="flex border-b border-gray-700 overflow-x-auto">
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-white bg-gray-700/80 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-4">
                            {activeTab === 'validation' && <ValidationChecklist results={appOutput.validation_results} plan={appOutput.meta.plan} />}
                            {activeTab === 'derivation' && verbosity !== 'short' && <SKRDerivationView calc={appOutput.finite_key_skr} />}
                            {activeTab === 'derivation' && verbosity === 'short' && <p className="text-gray-400">Switch to Medium or Full verbosity to see the full derivation.</p>}
                            {activeTab === 'data' && renderDataTab()}
                            {activeTab === 'meta' && <MetadataView meta={appOutput.meta} />}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
            <NavBar />
            {view === 'home' && <HomeView />}
            {view === 'processing' && <ProcessingView />}
            {view === 'results' && <ResultsView />}
        </div>
    );
};

export default App;
