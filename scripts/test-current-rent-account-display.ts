import assert from "node:assert/strict";
import { currentRentAccountDisplay } from "../src/lib/current-rent-account-display";

const input={
  chargeType:"SEMESTER_RENT",
  description:"First semester rent · Room 23",
  semesterName:"First semester",
  chargeRoomTypeId:"single-private",
  occupancy:{
    status:"ACTIVE",
    room:{number:"24",roomType:{id:"single-shared",name:"Single Room Shared"}},
  },
};
const original=JSON.stringify(input);
const joseph=currentRentAccountDisplay(input);
assert.equal(joseph.label,"First semester rent · Current Room 24 (Single Room Shared)");
assert.equal(joseph.currentRoom,"24");
assert.equal(joseph.roomTypeMismatch,true);
assert.equal(joseph.originalDescription,"First semester rent · Room 23");
assert.ok(!joseph.label.includes("Room 23"));
assert.equal(JSON.stringify(input),original,"Display logic must not mutate charge or occupancy records.");

const samePriceTransfer=currentRentAccountDisplay({
  ...input, description:"First semester rent · Room 39",
  chargeRoomTypeId:"bedsitter-private",
  occupancy:{status:"ACTIVE",room:{number:"43",roomType:{id:"bedsitter-private",name:"Bedsitter Private"}}},
});
assert.equal(samePriceTransfer.label,"First semester rent · Current Room 43 (Bedsitter Private)");
assert.equal(samePriceTransfer.roomTypeMismatch,false);

const sheila=currentRentAccountDisplay({
  ...input,description:"First semester rent · Room 54 (Bedsitter Private)",
  chargeRoomTypeId:"bedsitter-private",
  occupancy:{status:"ACTIVE",room:{number:"54",roomType:{id:"bedsitter-private",name:"Bedsitter Private"}}},
});
assert.equal(sheila.label,"First semester rent · Current Room 54 (Bedsitter Private)");
assert.equal(sheila.roomTypeMismatch,false);
assert.ok(!sheila.label.includes("60"));

const historical=currentRentAccountDisplay({...input,occupancy:{...input.occupancy,status:"CHECKED_OUT"}});
assert.equal(historical.label,"First semester rent · Room 23");
assert.equal(historical.currentRoom,null);
const damage=currentRentAccountDisplay({...input,chargeType:"DAMAGE",description:"Window damage · Room 23"});
assert.equal(damage.label,"Window damage · Room 23");
const unallocated=currentRentAccountDisplay({...input,occupancy:null});
assert.equal(unallocated.label,"First semester rent · Room 23");

console.log("Current-room payment identity display regression tests passed");
