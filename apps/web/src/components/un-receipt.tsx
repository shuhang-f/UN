"use client";

import { useEffect, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, custom, http, isAddress, type Address, type EIP1193Provider, type Hex } from "viem";
import { monadTestnet } from "viem/chains";
import { hashReceiptEnvelope, receiptAbi, receiptEnvelopeSchema, receiptProofSchema, type UnReceiptConfig, type UnReceiptProof, type UnReceiptResponse } from "@/lib/un-receipt";
import type { UnSavedReview } from "@/lib/un-storage-types";
import "./un-receipt.css";

const endpoint = "/api/un/reviews/receipt";
const transactionPattern = /^0x[0-9a-fA-F]{64}$/;
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(monadTestnet.rpcUrls.default.http[0], { timeout: 20_000, retryCount: 1 }) });
const explorer = monadTestnet.blockExplorers.default.url;

class ReceiptRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  const value = await response.json();
  if (!response.ok) throw new ReceiptRequestError(value.error || "The receipt request could not finish.", response.status);
  return value as T;
}
function validateResponse(value: UnReceiptResponse) {
  const envelope = receiptEnvelopeSchema.parse(value.envelope);
  const commitment = hashReceiptEnvelope(envelope);
  if (commitment !== value.commitment) throw new Error("The prepared review fingerprint does not match its records. Reload the review before continuing.");
  return { envelope, commitment, receipt: value.receipt ? receiptProofSchema.parse(value.receipt) : null };
}
function walletProvider() {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}
function hasWalletCode(error: unknown, code: number) {
  let current = error;
  for (let depth = 0; depth < 10 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
function download(value: UnReceiptResponse, unit: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = `UN-unit-${unit}-monad-receipt.json`;
  document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export function ReceiptProofDetails({ proof }: { proof: UnReceiptProof }) {
  return <dl className="unr-proof">
    <div><dt>Recorded by wallet</dt><dd><code>{proof.reviewer}</code></dd></div>
    <div><dt>Network</dt><dd>Monad Testnet · {proof.chainId}</dd></div>
    <div><dt>Contract</dt><dd><a href={`${explorer}/address/${proof.contractAddress}`} target="_blank" rel="noreferrer"><code>{proof.contractAddress}</code> ↗</a></dd></div>
    <div><dt>Transaction</dt><dd><a href={`${explorer}/tx/${proof.transactionHash}`} target="_blank" rel="noreferrer"><code>{proof.transactionHash}</code> ↗</a></dd></div>
    <div><dt>Block</dt><dd>{proof.blockNumber}</dd></div>
    <div><dt>Recorded at</dt><dd>{new Date(proof.recordedAt).toLocaleString()}</dd></div>
  </dl>;
}

type Activity = "loading" | "connecting" | "switching" | "checking" | "signing" | "confirming" | null;
type TransactionState = "submitted" | "pending" | "failed" | null;

export function UNReceipt({ record }: { record: UnSavedReview }) {
  const [config, setConfig] = useState<UnReceiptConfig | null>(null);
  const [prepared, setPrepared] = useState<UnReceiptResponse | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [activity, setActivity] = useState<Activity>("loading");
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>(null);
  const [recoveryHash, setRecoveryHash] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const actionLock = useRef(false);
  const generation = useRef(0);
  const storageKey = `un-monad-pending:${record.id}`;
  const currentPrepared = prepared?.envelope.review.id === record.id ? prepared : null;
  const confirmed = currentPrepared?.receipt;
  const busy = activity !== null;

  function remember(hash: Hex | null) {
    try {
      if (hash) localStorage.setItem(storageKey, hash);
      else localStorage.removeItem(storageKey);
    } catch { if (hash) setMessage("Keep the transaction hash below. This browser could not save it for recovery after a reload."); }
  }

  async function load(token = generation.current) {
    setActivity("loading"); setError("");
    try {
      const [settings, value] = await Promise.all([
        request<UnReceiptConfig>(endpoint),
        request<UnReceiptResponse>(endpoint, { action: "prepare", reviewId: record.id }),
      ]);
      if (settings.chainId !== monadTestnet.id || (settings.contractAddress && !isAddress(settings.contractAddress))) throw new Error("The receipt network configuration is invalid.");
      const next = validateResponse(value);
      if (next.envelope.review.id !== record.id) throw new Error("The receipt belongs to a different saved review.");
      if (generation.current !== token) return;
      setConfig(settings); setPrepared(next); setHasWallet(!!walletProvider());
      if (next.receipt) {
        remember(null); setTransactionHash(null); setTransactionState(null);
      } else {
        let stored: string | null = null;
        try { stored = localStorage.getItem(storageKey); } catch { /* Manual transaction recovery remains available. */ }
        if (stored && transactionPattern.test(stored)) { setTransactionHash(stored as Hex); setTransactionState("submitted"); }
      }
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : "The receipt could not be prepared. Reload and try again.");
    } finally { if (generation.current === token) setActivity(null); }
  }

  useEffect(() => {
    const token = ++generation.current;
    actionLock.current = false;
    setConfig(null); setPrepared(null); setAccount(null); setHasWallet(null);
    setTransactionHash(null); setTransactionState(null); setRecoveryHash(""); setError(""); setMessage("");
    void load(token);
    const provider = walletProvider();
    const changed = () => setAccount(null);
    provider?.on?.("accountsChanged", changed);
    return () => { generation.current++; provider?.removeListener?.("accountsChanged", changed); };
  }, [record.id]);

  async function connectWallet() {
    if (actionLock.current) return;
    const provider = walletProvider();
    setHasWallet(!!provider);
    if (!provider) return;
    actionLock.current = true; setActivity("connecting"); setError("");
    const token = generation.current;
    try {
      const client = createWalletClient({ chain: monadTestnet, transport: custom(provider, { retryCount: 0 }) });
      const [address] = await client.requestAddresses();
      if (generation.current !== token) return;
      if (!address) throw new Error("Choose an account in your wallet, then connect again.");
      setAccount(address);
    } catch (cause) {
      if (generation.current === token) setError(hasWalletCode(cause, 4001) ? "Wallet connection cancelled. No transaction was requested." : "Could not connect to your wallet. Unlock it and try again.");
    } finally { if (generation.current === token) { actionLock.current = false; setActivity(null); } }
  }

  async function confirm(hash: Hex, token = generation.current) {
    if (generation.current === token) { setActivity("confirming"); setError(""); }
    try {
      const next = validateResponse(await request<UnReceiptResponse>(endpoint, { action: "confirm", reviewId: record.id, transactionHash: hash }));
      if (generation.current !== token) return;
      if (!next.receipt) throw new Error("The transaction has not returned a confirmed receipt.");
      setPrepared(next); setTransactionState(null); remember(null); setMessage("");
    } catch (cause) {
      if (generation.current !== token) return;
      if (cause instanceof ReceiptRequestError && cause.status === 409) {
        setTransactionState("pending"); setMessage(cause.message);
      } else {
        setTransactionState(cause instanceof ReceiptRequestError && cause.status === 400 ? "failed" : "submitted");
        setError(cause instanceof Error ? cause.message : "The transaction could not be checked. Keep its hash and try checking again.");
      }
    }
  }

  async function checkTransaction(hash = transactionHash) {
    if (!hash || actionLock.current) return;
    const token = generation.current;
    actionLock.current = true; setTransactionHash(hash); remember(hash); setMessage("");
    try { await confirm(hash, token); }
    finally { if (generation.current === token) { actionLock.current = false; setActivity(null); } }
  }

  async function recordReceipt() {
    if (actionLock.current || !currentPrepared || !account || !config?.configured || !config.contractAddress || confirmed || transactionHash) return;
    const provider = walletProvider();
    if (!provider) { setHasWallet(false); return; }
    actionLock.current = true; setError(""); setMessage("");
    const token = generation.current;
    let sent: Hex | null = null;
    try {
      const client = createWalletClient({ chain: monadTestnet, transport: custom(provider, { retryCount: 0 }) });
      const [activeAccount] = await client.getAddresses();
      if (generation.current !== token) return;
      if (activeAccount?.toLowerCase() !== account.toLowerCase()) {
        setAccount(activeAccount || null);
        throw new Error("The wallet account changed. Check the displayed address before recording this review.");
      }
      setActivity("switching");
      const chainId = await client.getChainId();
      if (generation.current !== token) return;
      if (chainId !== monadTestnet.id) {
        try { await client.switchChain({ id: monadTestnet.id }); }
        catch (cause) {
          if (!hasWalletCode(cause, 4902)) throw cause;
          if (generation.current !== token) return;
          await client.addChain({ chain: monadTestnet });
          if (generation.current !== token) return;
          await client.switchChain({ id: monadTestnet.id });
        }
      }
      if (generation.current !== token) return;
      setActivity("checking");
      const { request: transaction } = await publicClient.simulateContract({
        address: config.contractAddress as Address, abi: receiptAbi, functionName: "record",
        args: [currentPrepared.commitment as Hex], account,
      });
      if (generation.current !== token) return;
      setActivity("signing");
      sent = await client.writeContract(transaction);
      remember(sent);
      if (generation.current === token) { setTransactionHash(sent); setTransactionState("submitted"); setActivity("confirming"); }
      try { await publicClient.waitForTransactionReceipt({ hash: sent, timeout: 45_000, confirmations: 1 }); }
      catch { /* The server makes the final chain check; keep the broadcast hash for retry. */ }
      await confirm(sent, token);
    } catch (cause) {
      if (generation.current !== token) return;
      if (sent) setError("The transaction was submitted, but its receipt could not be checked. Use Check transaction status; do not submit it again.");
      else if (hasWalletCode(cause, 4001)) setError("Wallet request cancelled. You can try again when ready.");
      else if (cause instanceof BaseError && cause.walk(error => error instanceof ContractFunctionRevertedError && error.data?.errorName === "AlreadyRecorded") instanceof ContractFunctionRevertedError) setError("This wallet already recorded this fingerprint. Recover the existing transaction using its hash below.");
      else if (cause instanceof Error && cause.message.startsWith("The wallet account changed")) setError(cause.message);
      else setError("The wallet could not finish this request. Check that it is on Monad Testnet and has testnet MON for gas. Check wallet activity before retrying; recover any submitted transaction below.");
    } finally { if (generation.current === token) { actionLock.current = false; setActivity(null); } }
  }

  const activityText: Record<Exclude<Activity, null>, string> = {
    loading: "Preparing the saved review receipt…", connecting: "Choose an account in your wallet…",
    switching: "Switch to Monad Testnet in your wallet…", checking: "Checking the contract request…",
    signing: "Review and confirm the transaction in your wallet…", confirming: "Checking the transaction on Monad Testnet…",
  };

  return <section className="unr-card" aria-labelledby={`unr-title-${record.id}`}>
    <header className="unr-heading"><div><span className="unr-eyebrow">MONAD TESTNET</span><h3 id={`unr-title-${record.id}`}>Review receipt</h3></div><span className={`unr-status ${confirmed ? "confirmed" : transactionState === "failed" ? "failed" : ""}`}>{confirmed ? "Confirmed" : transactionState === "failed" ? "Verification failed" : transactionHash ? "Awaiting confirmation" : "Not recorded"}</span></header>
    <p>Record a fingerprint of this saved review so someone can later check the exact file against a public receipt.</p>
    <div className="unr-privacy"><strong>What goes onchain</strong><p>Only the fingerprint is sent from this review. Your wallet address, transaction, and recording time are public. Names, rent amounts, source records, and notes stay in the private review file.</p></div>
    {currentPrepared && <><dl className="unr-summary"><div><dt>Saved review</dt><dd>Unit {record.packet.unit.unitNumber} · {record.packet.evidence.length} source records</dd></div><div><dt>Decision</dt><dd>Reviewed</dd></div><div><dt>Fingerprint</dt><dd><code>{currentPrepared.commitment}</code></dd></div></dl><p className="unr-caption">The fingerprint covers this saved snapshot and a random value. Later changes produce a different fingerprint.</p></>}
    {activity && <p className="unr-progress" role="status">{activityText[activity]}</p>}
    {error && <p className="unr-error" role="alert">{error}</p>}
    {message && <p className="unr-notice" role="status">{message}</p>}
    {confirmed ? <><ReceiptProofDetails proof={confirmed}/><div className="unr-actions"><button type="button" className="unr-primary" onClick={() => download(prepared!, record.packet.unit.unitNumber)}>Download receipt</button><a className="unr-secondary" href="/verify">Verify a receipt ↗</a></div><p className="unr-caption">The download includes the private review. Share it only with the people who should see those records.</p></>
      : <>{config && !config.configured && <p className="unr-notice">Receipt recording is not configured yet. A deployed Monad Testnet receipt contract is required.</p>}
        {config?.contractAddress && <p className="unr-caption">Contract <a href={`${explorer}/address/${config.contractAddress}`} target="_blank" rel="noreferrer"><code>{config.contractAddress}</code> ↗</a></p>}
        {transactionHash ? <div className="unr-pending"><strong>{transactionState === "failed" ? "Transaction did not verify" : "Transaction submitted"}</strong><a href={`${explorer}/tx/${transactionHash}`} target="_blank" rel="noreferrer"><code>{transactionHash}</code> ↗</a><div className="unr-actions"><button className="unr-primary" disabled={busy} onClick={() => void checkTransaction()}>Check transaction status</button><button className="unr-secondary" disabled={busy} onClick={() => void load()}>Reload receipt</button>{transactionState === "failed" && <button className="unr-secondary" disabled={busy} onClick={() => { remember(null); setTransactionHash(null); setTransactionState(null); setError(""); setMessage(""); }}>Start a new transaction</button>}</div><p className="unr-caption">Checking reads the existing transaction and never sends another one.</p></div>
          : <>{hasWallet === false && <p className="unr-notice">No wallet detected. Open this page in a browser with an Ethereum-compatible wallet, then reload.</p>}{account && <p className="unr-wallet"><span>Recording wallet</span><code>{account}</code></p>}<div className="unr-actions">{!account ? <button className="unr-primary" disabled={busy || !config?.configured || hasWallet === false || !currentPrepared} onClick={() => void connectWallet()}>Connect wallet</button> : <button className="unr-primary" disabled={busy || !config?.configured || !currentPrepared} onClick={() => void recordReceipt()}>Record review on Monad testnet</button>}<button className="unr-secondary" disabled={busy} onClick={() => void load()}>Reload receipt</button></div><p className="unr-caption">Your wallet asks before submitting. Recording uses testnet MON for the transaction fee.</p></>}
        {config?.configured && <details className="unr-recovery"><summary>Already submitted a transaction?</summary><p>Paste its hash from your wallet to check it. This will not send another transaction.</p><form onSubmit={event => { event.preventDefault(); if (transactionPattern.test(recoveryHash.trim())) void checkTransaction(recoveryHash.trim() as Hex); }}><label htmlFor={`unr-recover-${record.id}`}>Transaction hash</label><input id={`unr-recover-${record.id}`} value={recoveryHash} onChange={event => setRecoveryHash(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} required pattern="0x[0-9a-fA-F]{64}" disabled={busy}/><button className="unr-secondary" disabled={busy || !transactionPattern.test(recoveryHash.trim())} type="submit">Recover receipt</button></form></details>}
      </>}
    <p className="unr-limit">A receipt links an exact file to a wallet and time. It does not verify the facts, the wallet owner’s identity, or a legal approval.</p>
  </section>;
}
