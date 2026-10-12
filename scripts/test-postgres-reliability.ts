import assert from "node:assert/strict";
import { enforcePostgresVerifyFull } from "../src/lib/postgres-tls-policy";
import { readTransferCandidates } from "../src/lib/serial-transaction-read";

const original="postgresql://readonly:dummy@example.neon.tech/neondb?sslmode=require&connect_timeout=10";
const normalized=enforcePostgresVerifyFull(original);
assert.equal(normalized,"postgresql://readonly:dummy@example.neon.tech/neondb?sslmode=verify-full&connect_timeout=10");
assert.equal(enforcePostgresVerifyFull("postgresql://u:p@example.test/db?sslmode=prefer"),"postgresql://u:p@example.test/db?sslmode=verify-full");
assert.equal(enforcePostgresVerifyFull("postgresql://u:p@example.test/db?sslmode=verify-ca&application_name=hostel"),"postgresql://u:p@example.test/db?sslmode=verify-full&application_name=hostel");
assert.equal(enforcePostgresVerifyFull("postgresql://u:p@example.test/db?sslmode=verify-full"),"postgresql://u:p@example.test/db?sslmode=verify-full");
assert.equal(enforcePostgresVerifyFull("postgresql://u:p@example.test/db?sslmode=disable"),"postgresql://u:p@example.test/db?sslmode=disable");
assert.equal(enforcePostgresVerifyFull("postgresql://u:p@example.test/db"),"postgresql://u:p@example.test/db");

async function run() {
  const sequence:string[]=[];
  const [occupancy,target]=await readTransferCandidates(
    async()=>{sequence.push("occupancy-start");await Promise.resolve();sequence.push("occupancy-finished");return {id:"stay1",roomId:"60"};},
    async()=>{sequence.push("target-start");await Promise.resolve();sequence.push("target-finished");return {id:"room54",number:"54"};},
  );
  assert.deepEqual(sequence,["occupancy-start","occupancy-finished","target-start","target-finished"]);
  assert.equal(occupancy.roomId,"60");
  assert.equal(target.number,"54");
  let secondCalled=false;
  await assert.rejects(()=>readTransferCandidates(
    async()=>{throw Error("OCCUPANCY_LOOKUP_FAILED");},
    async()=>{secondCalled=true;return {id:"room54"};},
  ),/OCCUPANCY_LOOKUP_FAILED/);
  assert.equal(secondCalled,false);
  console.log("Postgres SSL policy and sequential transaction read tests passed");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
