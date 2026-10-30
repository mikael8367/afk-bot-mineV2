import test from "node:test";
import assert from "node:assert/strict";
import {validateBotOptions,validateControlAction,validateChatMessage,validatePlayerName} from "../src/core/validation.js";

test("Java options default on and can be disabled",()=>{
  const defaults=validateBotOptions({},"java",{autoReconnect:true});
  assert.equal(defaults.autoReconnect,true);
  assert.equal(defaults.autoRespawn,true);
  const changed=validateBotOptions({autoEat:false,autoEquipShield:"false"},"java",defaults);
  assert.equal(changed.autoEat,false);
  assert.equal(changed.autoEquipShield,false);
});
test("Bedrock disables Java-only automation",()=>{
  const options=validateBotOptions({autoRespawn:true,autoEat:true,autoEquipArmor:true,autoEquipShield:true},"bedrock",{autoReconnect:false});
  assert.equal(options.autoReconnect,false);
  assert.equal(options.autoRespawn,false);
  assert.equal(options.autoEat,false);
  assert.equal(options.autoEquipArmor,false);
  assert.equal(options.autoEquipShield,false);
});
test("movement accepts valid controls and rejects invalid data",()=>{
  assert.deepEqual(validateControlAction({direction:"forward",active:true}),{direction:"forward",active:true});
  assert.throws(()=>validateControlAction({direction:"teleport",active:true}));
  assert.throws(()=>validateControlAction({direction:"left",active:"true"}));
});
test("chat text is trimmed, bounded and cannot issue commands",()=>{
  assert.equal(validateChatMessage("  Olá mundo  "),"Olá mundo");
  assert.throws(()=>validateChatMessage("   "));
  assert.throws(()=>validateChatMessage("/op jogador"));
  assert.throws(()=>validateChatMessage("A".repeat(257)));
  assert.throws(()=>validateChatMessage("linha\nseguinte"));
});
test("player names are validated",()=>{
  assert.equal(validatePlayerName("Steve_01"),"Steve_01");
  assert.throws(()=>validatePlayerName("nome com espaço"));
  assert.throws(()=>validatePlayerName("nome-com-hífen"));
});
