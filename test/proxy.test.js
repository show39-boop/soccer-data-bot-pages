import test from 'node:test';
import assert from 'node:assert/strict';
import {proxyGas} from '../functions/_lib/gas.js';
const original=globalThis.fetch;
const env={GAS_API_URL:'https://script.google.com/macros/s/existing-deployment/exec'};
const data={ok:true,schemaVersion:3,source:'api-football',sourceSheet:'02_試合前データ',matches:[],
  lastUpdatedAt:null,fetchedAt:'2026-10-20T00:00:00Z',privateConfig:'must not pass'};
test('proxy sends only known V3 route to GAS, bypasses stale caches, strips extra top-level fields',async()=>{
  globalThis.fetch=async(url,opts)=>{
    assert.equal(url.hostname,'script.google.com');assert.equal(url.searchParams.get('api'),'v3-matches');
    assert.equal(opts.cache,'no-store');return Response.json(data);
  };
  try{const r=await proxyGas('matches',env);assert.equal(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).privateConfig,undefined);
  }finally{globalThis.fetch=original;}
});
test('legacy source and GAS errors never appear as valid V3 results',async()=>{
  try{for(const result of [{...data,source:'7m'},{ok:false,error:'secret-internal-setting'}]){
    globalThis.fetch=async()=>Response.json(result);
    const r=await proxyGas('matches',env);assert.equal(r.status,502);
    assert.ok(!(await r.text()).includes('secret-internal-setting'));
  }}finally{globalThis.fetch=original;}
});
test('missing/invalid configuration rejected without fetching',async()=>{
  globalThis.fetch=()=>{throw Error('must not fetch');};
  try{for(const config of [{},{GAS_API_URL:'https://example.com/exec'},{GAS_API_URL:'http://script.google.com/macros/s/id/exec'}]){
    assert.equal((await proxyGas('matches',config)).status,502);
  }}finally{globalThis.fetch=original;}
});
test('network exception does not disclose configured URL',async()=>{
  globalThis.fetch=async()=>{throw Error(env.GAS_API_URL);};
  try{const r=await proxyGas('matches',env);assert.equal(r.status,502);
    assert.ok(!(await r.text()).includes('existing-deployment'));
  }finally{globalThis.fetch=original;}
});
