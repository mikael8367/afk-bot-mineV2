import minecraftProtocol from "minecraft-protocol";

const BEDROCK_VERSIONS=[
  "1.16.201","1.16.210","1.16.220",
  "1.17.0","1.17.10","1.17.30","1.17.40",
  "1.18.0","1.18.11","1.18.30",
  "1.19.1","1.19.10","1.19.20","1.19.21","1.19.30","1.19.40","1.19.41","1.19.50","1.19.60","1.19.62","1.19.63","1.19.70","1.19.80",
  "1.20.0","1.20.10","1.20.30","1.20.40","1.20.50","1.20.61","1.20.71","1.20.80",
  "1.21.0","1.21.2","1.21.21","1.21.30","1.21.42","1.21.50","1.21.60","1.21.70","1.21.80","1.21.90","1.21.93","1.21.100","1.21.111","1.21.120","1.21.124","1.21.130",
  "1.26.0","1.26.10","1.26.20","1.26.30","1.26.40","1.26.45","1.26.51"
];

const JAVA_VERSIONS=[...new Set(minecraftProtocol.supportedVersions||[])].filter(v=>typeof v==="string"&&(()=>{const parts=v.split(".").map(Number);return parts[0]>1||(parts[0]===1&&(parts[1]||0)>=8);})()).sort((a,b)=>{
  const pa=a.split(/[.-]/).map(Number),pb=b.split(/[.-]/).map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){const d=(pa[i]||0)-(pb[i]||0);if(d)return d;}
  return a.localeCompare(b);
});

export function getSupportedVersions(){
  return {
    java:{versions:JAVA_VERSIONS,latest:JAVA_VERSIONS.at(-1)||null},
    bedrock:{versions:BEDROCK_VERSIONS,latest:BEDROCK_VERSIONS.at(-1)||null},
    autoDetect:true
  };
}
export function isSupportedVersion(edition,version){
  if(!version) return true;
  const list=edition==="java"?JAVA_VERSIONS:BEDROCK_VERSIONS;
  return list.includes(version);
}
