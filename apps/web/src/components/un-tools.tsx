"use client";

import { useEffect, useState } from "react";
import type { SearchHit } from "agent-core/shared";
import "./un-tools.css";

type Connections = { exaConfigured: boolean; ambiguousConfigured: boolean; modelConfigured: boolean };
type SearchResult = { results: SearchHit[]; query: string; searchedAt: string };

export function UNTools() {
  const [connections, setConnections] = useState<Connections | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState("");

  async function refresh() {
    setLoading(true); setConnectionError("");
    try {
      const response = await fetch("/api/integrations", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load tool settings.");
      const data = await response.json();
      setConnections({ exaConfigured: data.exaConfigured === true, ambiguousConfigured: data.ambiguousConfigured === true, modelConfigured: data.modelConfigured === true });
    } catch {
      setConnections(null); setConnectionError("Tool settings are unavailable. Try refreshing.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (searching) return;
    setSearching(true); setSearchError(""); setResult(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(50_000),
        body: JSON.stringify({ query: query.trim(), results: 5 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search could not finish.");
      setResult(data);
    } catch (cause) {
      setSearchError(cause instanceof Error && cause.name === "TimeoutError"
        ? "Search took too long. Please try again."
        : cause instanceof Error ? cause.message : "Search could not finish. Try again.");
    } finally { setSearching(false); }
  }

  function status(ready: boolean | undefined) {
    return <span className={`unt-status ${ready ? "ready" : ""}`}>{loading ? "Checking settings…" : connections === null ? "Unavailable" : ready ? "Key added" : "Setup needed"}</span>;
  }

  return <div className="unt-tools">
    <div className="unt-toolbar"><p>Search public sources and save reviewed work to your workspace.</p><button className="un-secondary" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh settings"}</button></div>
    {connectionError && <p className="un-alert error" role="alert">{connectionError}</p>}
    <div className="unt-grid">
      <section className="unt-card unt-research" aria-labelledby="unt-exa-title">
        <header><div><span className="unt-provider">EXA</span><h2 id="unt-exa-title">Search the web</h2></div>{status(connections?.exaConfigured)}</header>
        <p>Find housing guidance, inspection checklists, or leasing resources. Each result links to its source.</p>
        <form onSubmit={event => void search(event)}>
          <label htmlFor="unt-query">What do you need to find?</label>
          <textarea id="unt-query" rows={3} minLength={3} maxLength={500} required value={query} onChange={event => setQuery(event.target.value)} placeholder="Los Angeles Housing Department rental inspection checklist" disabled={searching} aria-describedby="unt-query-help"/>
          <p id="unt-query-help" className="un-caption">Only this query goes to Exa. Keep resident names and private records out of the search.</p>
          <div className="unt-examples" aria-label="Example searches">{["Rental inspection checklist", "Apartment turnover checklist"].map(example => <button type="button" key={example} disabled={searching} onClick={() => setQuery(example === "Rental inspection checklist" ? "Los Angeles Housing Department rental inspection checklist" : "apartment turnover inspection checklist property management")}>{example}</button>)}</div>
          <button type="submit" className="un-primary" disabled={searching || loading || !connections?.exaConfigured || query.trim().length < 3}>{searching ? "Searching Exa…" : "Search with Exa"}</button>
        </form>
        {!loading && connections && !connections.exaConfigured && <div className="unt-setup-note"><strong>Connect Exa to search.</strong><p>Add your API key using the setup instructions below. Search results will appear here after a request completes.</p></div>}
        <div aria-live="polite" aria-busy={searching}>
          {searchError && <p className="un-alert error" role="alert">{searchError}</p>}
          {result && <section className="unt-results" aria-label="Exa search results"><div className="unt-result-heading"><h3>{result.results.length} {result.results.length === 1 ? "source" : "sources"} found</h3><span>Exa · {new Date(result.searchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div><p className="un-caption">Results for “{result.query}”</p>
            {result.results.length ? <ol>{result.results.map((hit, index) => <li key={`${hit.url}-${index}`}><a href={hit.url} target="_blank" rel="noreferrer">{hit.title}<span aria-hidden="true"> ↗</span></a><span className="unt-source-domain">{new URL(hit.url).hostname}{hit.published && ` · ${hit.published.slice(0, 10)}`}</span>{hit.highlight && <p>{hit.highlight}</p>}</li>)}</ol> : <p>No matching sources came back. Try a more specific query.</p>}
            <p className="un-caption">Check the original page and its date before using it in a review. Search results do not change the sample rent rules.</p>
          </section>}
        </div>
      </section>
      <div className="unt-side">
        <section className="unt-card" aria-labelledby="unt-ambiguous-title"><header><div><span className="unt-provider">AMBIGUOUS AI</span><h2 id="unt-ambiguous-title">Save a review task</h2></div>{status(connections?.ambiguousConfigured)}</header><p>Keep the reviewed records and UN’s prepared letter in your Ambiguous workspace.</p><ol className="unt-steps"><li>Review a unit and save its evidence.</li><li>Open <strong>Draft approvals</strong> and inspect the packet and letter.</li><li>Choose <strong>Save to Ambiguous AI</strong>. UN reads the task back and shows its ID.</li></ol><p className="un-caption">Approving a letter records your decision in UN. It does not send a resident notice.</p><a href="https://app.ambiguous.ai" target="_blank" rel="noreferrer">Open Ambiguous workspace ↗</a></section>
        <section className="unt-card"><h2>Connect your tools</h2><p>Keys stay on the server. “Key added” means a key is present; a successful search or task save confirms access.</p><details><summary>Setup instructions</summary><div className="unt-setup"><p>Add these values to the repository’s root <code>.env</code>, then restart UN.</p><pre><code>{"EXA_API_KEY=your-exa-key\nAMBIGUOUS_API_KEY=your-workspace-key"}</code></pre><p><a href="https://dashboard.exa.ai/api-keys" target="_blank" rel="noreferrer">Get an Exa key ↗</a></p><p>For Ambiguous, use <strong>Connect</strong> in the workspace you want to save to. Enable task read and write access.</p><a href="https://www.ambiguous.ai/auth.md" target="_blank" rel="noreferrer">Ambiguous setup guide ↗</a></div></details><div className="unt-assistant-status"><strong>Ask UN</strong><span>{connections?.modelConfigured ? "Model key added" : "Optional model setup"}</span><p className="un-caption">The assistant uses the existing model connection. Exa search and task saves work independently.</p></div></section>
        <section className="unt-card unt-offers"><h2>Sponsor offers</h2><p>Check your attendee portal for Exa and OpenRouter redemption instructions. Ambiguous has a free plan for small teams.</p><a href="https://la.aitinkerers.org/hackathons/h_6xwsooXcdbo" target="_blank" rel="noreferrer">Open attendee portal ↗</a><p className="un-caption">Use the Credits tab. Offers and balances are managed by each provider.</p></section>
      </div>
    </div>
  </div>;
}
