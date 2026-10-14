import assert from "node:assert/strict";
import test from "node:test";
import { compileReviewReceipts } from "../scripts/deploy-receipts.mjs";

test("receipt contract compiles with the public record, readback and indexed event interface", async () => {
  const compiled = await compileReviewReceipts();
  assert.ok(compiled.bytecode.length > 100);
  assert.ok(compiled.deployedBytecode.length > 100);
  const record = compiled.abi.find(item => item.type === "function" && item.name === "record");
  assert.deepEqual(record.inputs.map(item => item.type), ["bytes32"]);
  assert.equal(record.stateMutability, "nonpayable");
  const readback = compiled.abi.find(item => item.type === "function" && item.name === "recordedAt");
  assert.deepEqual(readback.inputs.map(item => item.type), ["address", "bytes32"]);
  const event = compiled.abi.find(item => item.type === "event" && item.name === "ReviewRecorded");
  assert.deepEqual(event.inputs.map(({ type, indexed }) => ({ type, indexed })), [
    { type: "address", indexed: true }, { type: "bytes32", indexed: true }, { type: "uint256", indexed: false },
  ]);
  assert.deepEqual(compiled.abi.filter(item => item.type === "error").map(item => item.name).sort(), ["AlreadyRecorded", "EmptyCommitment"]);
});
