import test from "node:test";
import assert from "node:assert/strict";
import {getSupportedVersions,isSupportedVersion} from "../src/core/versions.js";
import {validateConnection} from "../src/core/validation.js";

test("returns non-empty supported version lists for both editions",()=>{
  const catalog=getSupportedVersions();
  assert.ok(catalog.java.versions.length>0);
  assert.ok(catalog.bedrock.versions.length>0);
  assert.equal(catalog.autoDetect,true);
});
test("accepts the latest version listed by each protocol engine",()=>{
  const catalog=getSupportedVersions();
  assert.equal(isSupportedVersion("java",catalog.java.latest),true);
  assert.equal(isSupportedVersion("bedrock",catalog.bedrock.latest),true);
  assert.equal(validateConnection({edition:"java",host:"play.example.net",username:"AFK_Bot",version:catalog.java.latest}).version,catalog.java.latest);
  assert.equal(validateConnection({edition:"bedrock",host:"play.example.net",username:"AFK_Bot",version:catalog.bedrock.latest}).version,catalog.bedrock.latest);
});
test("keeps automatic detection and rejects unsupported versions",()=>{
  assert.equal(validateConnection({edition:"java",host:"play.example.net",username:"AFK_Bot"}).version,undefined);
  assert.throws(()=>validateConnection({edition:"java",host:"play.example.net",username:"AFK_Bot",version:"99.99"}),/não está na lista/);
  assert.throws(()=>validateConnection({edition:"bedrock",host:"play.example.net",username:"AFK_Bot",version:"99.99"}),/não está na lista/);
});

test("supports Minecraft Bedrock 1.26.60",()=>{
  const catalog=getSupportedVersions();
  assert.ok(catalog.bedrock.versions.includes("1.26.60"));
  assert.equal(isSupportedVersion("bedrock","1.26.60"),true);
  assert.equal(validateConnection({edition:"bedrock",host:"play.example.net",username:"AFK_Bot",version:"1.26.60"}).version,"1.26.60");
});
