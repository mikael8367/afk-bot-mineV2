import test from "node:test";
import assert from "node:assert/strict";
import {validateConnection,parseBoolean} from "../src/core/validation.js";
test("accepts Java and Bedrock defaults",()=>{assert.equal(validateConnection({edition:"java",host:"play.example.net",username:"AFK_Bot"}).port,25565);assert.equal(validateConnection({edition:"bedrock",host:"play.example.net",username:"AFK_Bot"}).port,19132);});
test("rejects invalid edition, host, port and username",()=>{for(const x of [{edition:"both",host:"x.net",username:"AFK_Bot"},{edition:"java",host:"bad host",username:"AFK_Bot"},{edition:"java",host:"x.net",port:70000,username:"AFK_Bot"},{edition:"java",host:"x.net",username:"x"}])assert.throws(()=>validateConnection(x));});
test("normalizes auth and boolean values",()=>{assert.equal(validateConnection({edition:"java",host:"x.net",username:"AFK_Bot",auth:"wrong"}).auth,"offline");assert.equal(parseBoolean("true"),true);assert.equal(parseBoolean(undefined,true),true);});
