"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { hashReceiptEnvelope, receiptEnvelopeSchema, receiptProofSchema, type UnReceiptProof } from "@/lib/un-receipt";
import { ReceiptProofDetails } from "@/components/un-receipt";
import "@/components/un-receipt.css";

const fileSchema = z.object({
  envelope: receiptEnvelopeSchema,
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  receipt: receiptProofSchema,
}).strict();
type ReceiptFile = z.infer<typeof fileSchema>;
type Verification = { valid: true; commitment: string; receipt: UnReceiptProof };

export default function VerifyReceiptPage() {
  const [fileName, setFileName] = useState("");
  const [receiptFile, setReceiptFile] = useState<ReceiptFile | null>(null);
  const [calculated, setCalculated] = useState("");
  const [verified, setVerified] = useState<UnReceiptProof | null>(null);
  const [sampleFile, setSampleFile] = useState<ReceiptFile | null>(null);
  const [busy, setBusy] = useState<"reading" | "verifying" | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const matches = !!receiptFile && calculated === receiptFile.commitment.toLowerCase();

  async function readFile(file: File, sample = false) {
    const token = ++generation.current;
    setFileName(file.name); setReceiptFile(null); setSampleFile(null); setCalculated(""); setVerified(null); setError(""); setBusy("reading");
    try {
      if (file.size > 1_000_000) throw new Error("Choose a receipt JSON file smaller than 1 MB.");
      let parsed: ReceiptFile;
      try { parsed = fileSchema.parse(JSON.parse(await file.text())); }
      catch { throw new Error("This is not a complete UN receipt file. Use Download receipt after a transaction is confirmed."); }
      const fingerprint = hashReceiptEnvelope(parsed.envelope);
      if (generation.current !== token) return;
      setReceiptFile(parsed); setCalculated(fingerprint); setSampleFile(sample ? parsed : null);
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The file could not be read.");
    } finally { if (generation.current === token) setBusy(null); }
  }

  async function loadSample() {
    if (busy) return;
    const token = ++generation.current;
    setBusy("reading"); setError(""); setVerified(null);
    try {
      const response = await fetch("/examples/review-receipt.json", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error("The sample receipt is unavailable. You can still choose your own receipt file.");
      const blob = await response.blob();
      if (generation.current !== token) return;
      await readFile(new File([blob], "UN-sample-monad-receipt.json", { type: "application/json" }), true);
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The sample could not be loaded.");
    } finally { if (generation.current === token) setBusy(null); }
  }

  function alterSample() {
    if (!sampleFile || busy) return;
    generation.current++;
    const altered = structuredClone(sampleFile);
    altered.envelope.review.reviewerNote += "\nChanged for this verification demo.";
    setReceiptFile(altered); setCalculated(hashReceiptEnvelope(altered.envelope));
    setFileName("UN-sample-altered.json"); setVerified(null); setError("");
  }

  async function verify() {
    if (!receiptFile || !matches || busy) return;
    const token = generation.current;
    setBusy("verifying"); setError(""); setVerified(null);
    try {
      // The envelope and all private review contents stay in this browser.
      const response = await fetch("/api/receipts/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitment: calculated, receipt: receiptFile.receipt }),
        signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json() as Verification & { error?: string };
      if (!response.ok) throw new Error(result.error || "The onchain receipt could not be verified. Try again.");
      if (!result.valid || result.commitment.toLowerCase() !== calculated) throw new Error("The verification response did not match this file.");
      const proof = receiptProofSchema.parse(result.receipt);
      if (generation.current === token) setVerified(proof);
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error && cause.name === "TimeoutError" ? "The network check took too long. Try verifying again." : cause instanceof Error ? cause.message : "The onchain receipt could not be verified.");
    } finally { if (generation.current === token) setBusy(null); }
  }

  return <main className="unr-verify-page">
    <nav className="unr-verify-nav"><a className="unr-brand" href="/">UN<span>·</span></a><a href="/">Back to review desk ↗</a></nav>
    <header className="unr-verify-heading"><span className="unr-eyebrow">MONAD TESTNET</span><h1>Verify a review receipt</h1><p>Check that a review file matches the fingerprint recorded by a wallet on Monad Testnet.</p></header>
    <section className="unr-card unr-file-card" aria-labelledby="unr-file-title">
      <h2 id="unr-file-title">Choose a receipt file</h2><p>The complete receipt is the JSON file exported from a saved review.</p>
      <label className="unr-file-label" htmlFor="unr-receipt-file">Receipt JSON · up to 1 MB</label><input id="unr-receipt-file" type="file" accept=".json,application/json" disabled={!!busy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void readFile(file); }}/>
      <div className="unr-actions"><button className="unr-secondary" disabled={!!busy} onClick={() => void loadSample()}>Load sample receipt</button><a href="/examples/review-receipt.json" download="UN-sample-monad-receipt.json">Download sample</a></div><p className="unr-caption">The sample is a public, fictional Unit 04 review recorded on Monad Testnet by a test wallet.</p>
      <div className="unr-privacy"><strong>Your review stays in this browser</strong><p>This page reads and hashes the file locally. Only its fingerprint and public receipt details are sent for the blockchain check.</p></div>
      {busy === "reading" && <p role="status" className="unr-progress">Reading the file and calculating its fingerprint…</p>}
      {error && <p className="unr-error" role="alert">{error}</p>}
    </section>
    {receiptFile && <section className="unr-card" aria-labelledby="unr-file-result">
      <header className="unr-heading"><div><span className="unr-eyebrow">FILE CHECK</span><h2 id="unr-file-result">{matches ? "Fingerprint matches the file" : "The file does not match"}</h2></div><span className={`unr-status ${matches ? "confirmed" : "failed"}`}>{matches ? "File checked" : "Changed or invalid"}</span></header>
      <p className="unr-file-name">{fileName}</p>
      <dl className="unr-summary"><div><dt>Review</dt><dd>Unit {receiptFile.envelope.review.packet.unit.unitNumber} · {receiptFile.envelope.review.packet.unit.propertyName}</dd></div><div><dt>Saved on</dt><dd>{new Date(receiptFile.envelope.review.createdAt).toLocaleString()}</dd></div><div><dt>Calculated fingerprint</dt><dd><code>{calculated}</code></dd></div>{!matches && <div><dt>Fingerprint in receipt</dt><dd><code>{receiptFile.commitment}</code></dd></div>}</dl>
      {!matches ? <p className="unr-error" role="alert">The review contents or fingerprint have changed. No blockchain check was requested. Choose the original receipt file to verify it.</p>
        : <><p className="unr-caption">Next, check the confirmed transaction, contract, fingerprint, and recording wallet against Monad Testnet.</p><div className="unr-actions"><button className="unr-primary" disabled={!!busy} onClick={() => void verify()}>{busy === "verifying" ? "Checking Monad Testnet…" : verified ? "Verify again" : "Verify on Monad testnet"}</button>{sampleFile && <button className="unr-secondary" disabled={!!busy} onClick={alterSample}>Try an altered sample</button>}</div>{busy === "verifying" && <p className="unr-progress" role="status">Reading the public transaction and receipt contract…</p>}</>}
    </section>}
    {verified && <section className="unr-card" aria-labelledby="unr-chain-result"><header className="unr-heading"><div><span className="unr-eyebrow">BLOCKCHAIN CHECK</span><h2 id="unr-chain-result">Receipt verified</h2></div><span className="unr-status confirmed">Confirmed</span></header><p role="status">This exact file matches a confirmed receipt recorded by the wallet below.</p><ReceiptProofDetails proof={verified}/></section>}
    <footer className="unr-verify-footer"><p>A receipt proves that a wallet recorded this fingerprint. It does not verify the records’ accuracy, the wallet owner’s identity, or a legal approval.</p><a href="/">UN · Review desk</a></footer>
  </main>;
}
