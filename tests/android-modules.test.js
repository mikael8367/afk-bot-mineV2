import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {prepareAndroidModules} from "../scripts/prepare-android-modules.mjs";

test("Android preparation selects jsp-raknet, removes native prebuilds and excludes NBT fixtures", async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"afk-android-modules-"));
  try {
    const bedrockDir=path.join(root,"node_modules","bedrock-protocol","src");
    const nativeDir=path.join(root,"node_modules","raknet-native","prebuilds","linux-x64");
    const sampleDir=path.join(root,"node_modules","prismarine-nbt","sample");
    await fs.mkdir(bedrockDir,{recursive:true});
    await fs.mkdir(nativeDir,{recursive:true});
    await fs.mkdir(sampleDir,{recursive:true});
    await fs.writeFile(path.join(bedrockDir,"createClient.js"),"const { RakClient } = initRaknet('raknet-native')\n");
    await fs.writeFile(path.join(nativeDir,"raknet.node"),"native fixture");
    await fs.writeFile(path.join(sampleDir,"bigtest.nbt"),"fixture");
    await fs.writeFile(path.join(sampleDir,"bigtest.nbt.gz"),"fixture");

    const result=await prepareAndroidModules(root);
    const source=await fs.readFile(path.join(bedrockDir,"createClient.js"),"utf8");
    assert.match(source,/initRaknet\('jsp-raknet'\)/);
    assert.equal(result.removedNativeFiles,1);
    await assert.rejects(fs.access(path.join(nativeDir,"raknet.node")));
    await assert.rejects(fs.access(sampleDir));

    const second=await prepareAndroidModules(root);
    assert.equal(second.removedNativeFiles,0);
  } finally {
    await fs.rm(root,{recursive:true,force:true});
  }
});

test("Android preparation fails closed if the installed Bedrock source changes unexpectedly", async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"afk-android-modules-"));
  try {
    const bedrockDir=path.join(root,"node_modules","bedrock-protocol","src");
    await fs.mkdir(bedrockDir,{recursive:true});
    await fs.writeFile(path.join(bedrockDir,"createClient.js"),"// unknown implementation\n");
    await assert.rejects(prepareAndroidModules(root),/unknown RakNet discovery implementation/);
  } finally {
    await fs.rm(root,{recursive:true,force:true});
  }
});
