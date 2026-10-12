import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeGuardianPhone,
  guardianContactComparison,
} from "../src/lib/guardian-contact-review";

assert.equal(normalizeGuardianPhone("0714 464 701","KE"),"254714464701");
assert.equal(normalizeGuardianPhone("0714464701","KE"),"254714464701");
assert.equal(normalizeGuardianPhone("714464701","KE"),"254714464701");
assert.equal(normalizeGuardianPhone("+254 714 464 701","KE"),"254714464701");
assert.equal(normalizeGuardianPhone("254714464701","KE"),"254714464701");
assert.equal(normalizeGuardianPhone("0112 345 678","KE"),"254112345678");
assert.equal(normalizeGuardianPhone("0044 7700 900123","KE"),"447700900123");
assert.equal(normalizeGuardianPhone("+44 7700 900123","KE"),"447700900123");
assert.equal(normalizeGuardianPhone("0714464701","GB"),"0714464701",
  "Do not treat non-Kenyan local numbers as Kenyan by guesswork.");
assert.equal(normalizeGuardianPhone("020 1234 5678","KE"),"020 1234 5678",
  "Do not fabricate a Kenyan mobile from an unrecognized landline.");
assert.equal(normalizeGuardianPhone(" ","KE"),"");

const review=guardianContactComparison(
  {name:"Margaret  Wanjiru",phone:"0714 464 701"},
  {name:"margaret wanjiru",phone:"+254714464701"},
  "KE",
);
assert.equal(review.nameSame,true);
assert.equal(review.nameFormattingOnly,true);
assert.equal(review.phoneSame,true);
assert.equal(review.phoneFormattingOnly,true);
assert.equal(review.proposedInternationalPhone,"254714464701");
const unchanged=guardianContactComparison(
  {name:"Guardian A",phone:"254714464701"},
  {name:"Guardian A",phone:"254714464701"},"KE");
assert.equal(unchanged.nameFormattingOnly,false);
assert.equal(unchanged.phoneFormattingOnly,false);
const different=guardianContactComparison(
  {name:"Guardian A",phone:"0714464701"},
  {name:"Guardian B",phone:"0799999999"},"KE");
assert.equal(different.nameSame,false);
assert.equal(different.phoneSame,false);
const first=guardianContactComparison(null,{name:"Guardian A",phone:"0714464701"},"KE");
assert.equal(first.nameSame,false);
assert.equal(first.phoneSame,false);

const css=readFileSync(new URL("../src/app/globals.css",import.meta.url),"utf8");
assert.match(css,/\.update-review-actions \.row-actions \.primary-button/);
assert.match(css,/\.update-review-actions \.row-actions \.secondary-button\.reject-outline/);
assert.match(css,/\.update-review-actions \.row-actions \.danger-button/);
assert.match(css,/\.update-review-actions \.row-actions button\s*\{[^}]*min-height:\s*44px/s);
assert.match(css,/@media \(max-width: 520px\)/);

console.log("Guardian international-phone, case-only review, and mobile controls tests passed.");
