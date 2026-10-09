import test from "node:test";
import assert from "node:assert/strict";
import { assistantConfiguration, assistantEnabled } from "../src/lib/assistant-config";
import { generateHostelAnswer } from "../src/lib/assistant-service";

const fixture = {HOSTEL_AI_ENABLED:"true",HOSTEL_AI_MODEL:"openai/gpt-6-luna",OPENAI_API_KEY:"fixture-openai-key"};

test("direct OpenAI requires its own credential and rejects another provider's model", () => {
  assert(assistantEnabled(fixture));
  assert.equal(assistantConfiguration(fixture).model,"gpt-6-luna");
  assert(!assistantEnabled({...fixture,HOSTEL_AI_ENABLED:"false"}));
  assert(!assistantEnabled({...fixture,OPENAI_API_KEY:" ",AI_GATEWAY_API_KEY:"gateway",VERCEL:"1",VERCEL_OIDC_TOKEN:"oidc"}));
  assert(!assistantEnabled({...fixture,HOSTEL_AI_MODEL:"google/another-model"}));
  assert(!assistantEnabled({...fixture,HOSTEL_AI_MODEL:""}));
  assert(!JSON.stringify(assistantConfiguration(fixture)).includes(fixture.OPENAI_API_KEY));
});

async function withProvider(fetcher:typeof fetch, action:()=>Promise<void>, key:string|undefined=fixture.OPENAI_API_KEY) {
  const values={...fixture,OPENAI_API_KEY:key};
  const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  try {
    for(const [key,value] of Object.entries(values)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
    globalThis.fetch=fetcher;
    await action();
  } finally {
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
}

test("real SDK targets OpenAI Responses with hostel instructions, privacy and output limits",async()=>{
  let calls=0;
  await withProvider(async(url,init)=>{
    calls++;
    assert.equal(String(url),"https://api.openai.com/v1/responses");
    assert.equal(new Headers(init?.headers).get("authorization"),`Bearer ${fixture.OPENAI_API_KEY}`);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.model,"gpt-6-luna");
    assert.equal(body.store,false);
    assert.equal(body.max_output_tokens,1000);
    assert.equal(body.reasoning.effort,"low");
    const payload=JSON.stringify(body);
    assert(payload.includes("No other hostel's records are accessible"));
    assert(payload.includes("TENANT"));
    assert(payload.includes("Where is my statement?"));
    assert(!payload.includes(fixture.OPENAI_API_KEY));
    assert(!body.tools?.length);
    return Response.json({id:"response_fixture",model:"gpt-6-luna",output:[{id:"message_fixture",type:"message",role:"assistant",content:[{type:"output_text",text:"Open your tenant statement.",annotations:[]}]}],usage:{input_tokens:30,output_tokens:10,total_tokens:40}});
  },async()=>{
    const answer=await generateHostelAnswer("Where is my statement?","TENANT",{unreadMessages:1});
    assert.equal(answer.text,"Open your tenant statement.");
    assert.equal(answer.inputTokens,30);
    assert.equal(answer.outputTokens,10);
  });
  assert.equal(calls,1);
});

test("provider failure makes one attempt without falling back to Gateway",async()=>{
  let calls=0;
  await withProvider(async(url)=>{
    calls++;
    assert.equal(String(url),"https://api.openai.com/v1/responses");
    return Response.json({error:{message:"Fixture quota failure",type:"insufficient_quota",code:"insufficient_quota"}},{status:429});
  },async()=>{await assert.rejects(generateHostelAnswer("My password?","MANAGEMENT",null));});
  assert.equal(calls,1);
});

test("missing credentials stop before any external request",async()=>{
  await withProvider(async()=>{assert.fail("No provider request should be made");},async()=>{
    await assert.rejects(generateHostelAnswer("My password?","MANAGEMENT",null),/OPENAI_API_KEY_MISSING/);
  },"");
});
