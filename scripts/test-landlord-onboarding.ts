import test from 'node:test';import assert from 'node:assert/strict';
import {bootstrapOwnerAllowed,publicationProblems} from '../src/lib/landlord-onboarding-policy';
const owner={enabled:true,active:true,product:'STUDENTSHOSTELS',role:'OWNER',users:0};
test('only explicitly new empty active organizations bootstrap owner',()=>{assert.equal(bootstrapOwnerAllowed(owner),true);for(const changes of [{enabled:false},{active:false},{product:'OTHER'},{role:'ADMIN'},{role:'MEMBER'},{users:1}])assert.equal(bootstrapOwnerAllowed({...owner,...changes}),false)});
const property={name:'Test hostel',physicalAddress:'Test location',phone:'0700000000',publicDescription:'Test description',customDomain:'test.studentshostels.com'};
test('complete property with rooms is ready',()=>assert.deepEqual(publicationProblems(property,1),[]));
test('empty and unsafe properties stay unpublished',()=>{assert.equal(publicationProblems({...property,physicalAddress:null},1).length,1);assert.equal(publicationProblems(property,0).length,1);for(const customDomain of ['https://evil.com','evil.com','www.studentshostels.com.evil.com',null])assert.ok(publicationProblems({...property,customDomain},1).length)});
test('public contacts and description required',()=>assert.equal(publicationProblems({...property,phone:null,publicDescription:null},1).length,2));
