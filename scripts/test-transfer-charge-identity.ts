import assert from "node:assert/strict";
import { transferRentChargeIdentity } from "../src/lib/transfer-charge-identity";

const result=transferRentChargeIdentity({
  semesterName:"First semester",
  roomNumber:"54",
  roomTypeId:"bedsitter-private-type",
  roomTypeName:"Bedsitter Private",
});
assert.deepEqual(result,{
  roomTypeId:"bedsitter-private-type",
  description:"First semester rent · Room 54 (Bedsitter Private)",
});
assert.ok(!result.description.includes("Room 60"));
assert.throws(()=>transferRentChargeIdentity({
  semesterName:"First semester",roomNumber:"",roomTypeId:"bedsitter-private-type",roomTypeName:"Bedsitter Private"
}),/INVALID_TRANSFER_CHARGE_IDENTITY/);
console.log("Transfer charge current-room identity checks passed");
