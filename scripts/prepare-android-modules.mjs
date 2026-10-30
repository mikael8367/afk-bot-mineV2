import fs from "node:fs/promises";
import path from "node:path";

async function findNativeFiles(directory) {
  const found=[];
  let entries=[];
  try { entries=await fs.readdir(directory,{withFileTypes:true}); }
  catch(error) {
    if(error.code==="ENOENT") return found;
    throw error;
  }
  for(const entry of entries) {
    const full=path.join(directory,entry.name);
    if(entry.isDirectory()) found.push(...await findNativeFiles(full));
    else if(entry.isFile() && entry.name.endsWith(".node")) found.push(full);
  }
  return found;
}

export async function prepareAndroidModules(rootDirectory) {
  const packagePath=path.join(rootDirectory,"node_modules","bedrock-protocol","src","createClient.js");
  let source=await fs.readFile(packagePath,"utf8");
  const nativePing="const { RakClient } = initRaknet('raknet-native')";
  const javascriptPing="const { RakClient } = initRaknet('jsp-raknet')";
  if(source.includes(nativePing)) {
    source=source.replace(nativePing,javascriptPing);
    await fs.writeFile(packagePath,source);
  } else if(!source.includes(javascriptPing)) {
    throw new Error("bedrock-protocol createClient.js has an unknown RakNet discovery implementation; refusing an unsafe Android bundle.");
  }

  // Android asset merging treats the paired .nbt/.nbt.gz fixtures as a duplicate\n  // resource name. These are package test fixtures and are never used at runtime.\n  const prismarineSamples=path.join(rootDirectory,"node_modules","prismarine-nbt","sample");\n  await fs.rm(prismarineSamples,{recursive:true,force:true});\n\n  const nativeDirectory=path.join(rootDirectory,"node_modules","raknet-native");
  const nativeFiles=await findNativeFiles(nativeDirectory);
  for(const file of nativeFiles) await fs.unlink(file);

  const remaining=await findNativeFiles(path.join(rootDirectory,"node_modules"));
  if(remaining.length) {
    throw new Error("Unsupported native Node addons remain in Android dependencies: "+remaining.join(", "));
  }
  return {patchedBedrockDiscovery:true,removedNativeFiles:nativeFiles.length};
}

if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  const rootDirectory=process.argv[2];
  if(!rootDirectory) throw new Error("Usage: node prepare-android-modules.mjs <staged-server-directory>");
  const result=await prepareAndroidModules(rootDirectory);
  process.stdout.write("Android JavaScript RakNet prepared; removed "+result.removedNativeFiles+" native addon file(s).\n");
}
