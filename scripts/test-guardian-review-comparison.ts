import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compareGuardianUpdate} from "../src/lib/guardian-review-comparison";

const formatting = compareGuardianUpdate(
  {name:"Margaret  Wanjiru",phone:"0714 464 701"},
  {name:"margaret wanjiru",phone:"+254714464701"},
);
assert.equal(formatting.sameName,true);
assert.equal(formatting.nameFormattingOnly,true);
assert.equal(formatting.samePhone,true);
assert.equal(formatting.phoneFormattingOnly,true);
assert.equal(formatting.normalizedProposedPhone,"254714464701");

const identical=compareGuardianUpdate(
  {name:"Margaret Wanjiru",phone:"254714464701"},
  {name:"Margaret Wanjiru",phone:"254714464701"},
);
assert.equal(identical.nameFormattingOnly,false);
assert.equal(identical.phoneFormattingOnly,false);

const changed=compareGuardianUpdate(
  {name:"Margaret Wanjiru",phone:"0714464701"},
  {name:"Other Guardian",phone:"0799999999"},
);
assert.equal(changed.sameName,false);
assert.equal(changed.samePhone,false);
assert.equal(changed.nameFormattingOnly,false);
assert.equal(changed.phoneFormattingOnly,false);

const newContact=compareGuardianUpdate(null,{name:"New Guardian",phone:"0112 345 678"});
assert.equal(newContact.sameName,false);
assert.equal(newContact.samePhone,false);
assert.equal(newContact.normalizedProposedPhone,"254112345678");

const css=readFileSync("src/app/globals.css","utf8");
assert.match(css,/\.update-review-actions \.row-actions \.primary-button/);
assert.match(css,/\.update-review-actions \.row-actions \.secondary-button\.reject-outline/);
assert.match(css,/\.update-review-actions \.row-actions \.danger-button/);
assert.match(css,/\.update-review-actions \.row-actions button\s*\{[^}]*min-height:\s*44px/);
assert.match(css,/@media \(max-width: 520px\)/);

console.log("Guardian formatting comparison and accessible mobile review CSS tests passed.");
