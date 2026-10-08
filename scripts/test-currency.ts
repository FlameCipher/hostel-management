import test from "node:test";
import assert from "node:assert/strict";
import { currencyDigits, currencyStep, formatMoney, validCurrency, validAmount, minorUnits, roundCurrency } from "../src/lib/currency";
import { calculateActualDaysRent, calculateBreakStorageCharge } from "../src/lib/rent-calculation";
import { outstanding } from "../src/lib/communications";

test("currency codes, decimal places and display", () => {
 for (const [code,digits] of [["KES",2],["USD",2],["JPY",0],["UGX",0],["KWD",3]] as const) {
  assert.equal(currencyDigits(code),digits);assert.equal(currencyStep(code),10 ** -digits);
 }
 assert.equal(validCurrency("USD"),true);assert.equal(validCurrency("usd"),false);assert.equal(validCurrency("XYZ"),false);
 assert.equal(formatMoney(1000.1,"USD"),"USD 1,000.10");assert.equal(formatMoney(1000,"JPY"),"JPY 1,000");assert.equal(formatMoney(1.001,"KWD"),"KWD 1.001");
});
test("reject excess input precision, tiny positive amounts and non-finite values", () => {
 for(const [v,c] of [[0.001,"KES"],[1.1,"JPY"],[0.0001,"KWD"],[1e-9,"USD"],[Infinity,"USD"],[NaN,"USD"]] as const) assert.equal(validAmount(v,c),false);
 for(const [v,c] of [[0.01,"USD"],[1,"JPY"],[0.001,"KWD"],[99999999.999,"KWD"]] as const) assert.equal(validAmount(v,c),true);
 assert.equal(minorUnits(0.1,"USD")+minorUnits(0.2,"USD"),minorUnits(0.3,"USD"));
});
test("round decimal ties symmetrically and retain three-digit balances", () => {
 assert.equal(roundCurrency(10.075,"USD"),10.08);assert.equal(roundCurrency(-10.075,"USD"),-10.08);
 assert.equal(roundCurrency(1.2345,"KWD"),1.235);assert.equal(roundCurrency(1.5,"JPY"),2);
 assert.equal(outstanding("0.003",[{amount:"0.001"}],"KWD"),0.002);
 assert.equal(outstanding("0.3",[{amount:"0.1"},{amount:"0.2"}],"USD"),0);
});
test("rent and storage round each calculated amount in its currency", () => {
 const input={semesterStart:new Date("2026-01-01"),semesterEnd:new Date("2026-01-03"),segments:[{roomId:"r",roomTypeId:"t",startDate:new Date("2026-01-01"),endDate:new Date("2026-01-02"),semesterRate:10}]};
 assert.equal(calculateActualDaysRent({...input,currency:"JPY"}).amount,3);
 assert.equal(calculateActualDaysRent({...input,currency:"USD"}).amount,3.33);
 assert.equal(calculateActualDaysRent({...input,currency:"KWD"}).amount,3.333);
 for(const [currency,want] of [["JPY",3],["USD",3.33],["KWD",3.333]] as const) assert.equal(calculateBreakStorageCharge({currency,mode:"PERCENTAGE_MONTHLY_RATE",value:33.33,months:1,monthlyRate:10}),want);
});
