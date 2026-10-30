const HOST = /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
export function validateConnection(input = {}) {
  const edition=input.edition, host=typeof input.host==="string"?input.host.trim():"";
  const username=typeof input.username==="string"?input.username.trim():"";
  const port=Number(input.port ?? (edition==="bedrock"?19132:25565));
  const version=typeof input.version==="string"?input.version.trim():undefined;
  if (!["java","bedrock"].includes(edition)) throw Error("Selecione Java ou Bedrock.");
  if (!HOST.test(host)||host.includes("..")) throw Error("Endereço do servidor inválido.");
  if (!Number.isInteger(port)||port<1||port>65535) throw Error("Porta inválida (1–65535).");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) throw Error("Nome deve ter 3–16 letras, números ou _.");
  if (version&&!/^[0-9A-Za-z._-]{1,32}$/.test(version)) throw Error("Versão inválida.");
  return {edition,host,port,username,version,auth:input.auth==="microsoft"?"microsoft":"offline"};
}
export function parseBoolean(value,fallback=false) {
  if(value===undefined||value===null||value==="") return fallback;
  return value===true||value==="true"||value==="1";
}
