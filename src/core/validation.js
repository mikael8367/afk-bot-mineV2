import {isSupportedVersion} from "./versions.js";
const HOST=/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
const CONTROL_STATES=new Set(["forward","back","left","right","jump","sprint","sneak"]);
const OPTION_KEYS=["autoReconnect","autoRespawn","autoEat","autoEquipArmor","autoEquipShield"];

export function validateConnection(input={}) {
  const edition=input.edition,host=typeof input.host==="string"?input.host.trim():"";
  const username=typeof input.username==="string"?input.username.trim():"";
  const port=Number(input.port??(edition==="bedrock"?19132:25565));
  const version=typeof input.version==="string"?input.version.trim():undefined;
  if(!["java","bedrock"].includes(edition)) throw Error("Selecione Java ou Bedrock.");
  if(!HOST.test(host)||host.includes("..")) throw Error("Endereço do servidor inválido.");
  if(!Number.isInteger(port)||port<1||port>65535) throw Error("Porta inválida (1–65535).");
  if(!/^[a-zA-Z0-9_]{3,16}$/.test(username)) throw Error("Nome deve ter 3–16 letras, números ou _.");
  if(version&&!/^[0-9A-Za-z._-]{1,32}$/.test(version)) throw Error("Versão inválida.");
  if(version&&!isSupportedVersion(edition,version)) throw Error("Essa versão não está na lista de protocolos suportados pelo motor "+edition+". Escolha uma versão da lista ou use detecção automática.");
  return {edition,host,port,username,version,auth:input.auth==="microsoft"?"microsoft":"offline"};
}
export function parseBoolean(value,fallback=false) {
  if(value===undefined||value===null||value==="") return fallback;
  return value===true||value==="true"||value==="1";
}
export function validateBotOptions(input={},edition="java",current={}) {
  if(!input||typeof input!=="object"||Array.isArray(input)) throw Error("Configurações inválidas.");
  const defaults={
    autoReconnect:current.autoReconnect??true,
    autoRespawn:current.autoRespawn??true,
    autoEat:current.autoEat??true,
    autoEquipArmor:current.autoEquipArmor??true,
    autoEquipShield:current.autoEquipShield??true
  };
  const options={};
  for(const key of OPTION_KEYS) options[key]=parseBoolean(input[key],defaults[key]);
  if(edition!=="java") {
    options.autoRespawn=false;options.autoEat=false;
    options.autoEquipArmor=false;options.autoEquipShield=false;
  }
  return options;
}
export function validateControlAction(input={}) {
  if(!input||typeof input!=="object"||!CONTROL_STATES.has(input.direction)) throw Error("Direção de movimento inválida.");
  if(typeof input.active!=="boolean") throw Error("Estado do movimento inválido.");
  return {direction:input.direction,active:input.active};
}
export function validateChatMessage(value) {
  if(typeof value!=="string") throw Error("Digite uma mensagem.");
  const message=value.trim();
  if(!message) throw Error("A mensagem está vazia.");
  if(message.length>256) throw Error("A mensagem deve ter até 256 caracteres.");
  if(message.startsWith("/")) throw Error("Comandos do servidor não são enviados por este painel.");
  if(/[\u0000-\u001f\u007f]/.test(message)) throw Error("A mensagem contém caracteres inválidos.");
  return message;
}
export function validatePlayerName(value) {
  if(typeof value!=="string"||!/^[a-zA-Z0-9_]{1,16}$/.test(value.trim())) throw Error("Nome de jogador inválido.");
  return value.trim();
}
