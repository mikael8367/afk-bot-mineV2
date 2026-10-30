import bedrock from "bedrock-protocol";
export function createBedrockBot(config, cb={}) {
  const client=bedrock.createClient({host:config.host,port:config.port,username:config.username,offline:config.auth!=="microsoft",auth:config.auth==="microsoft"?"microsoft":undefined,...(config.version?{version:config.version}:{})});
  client.on("join",()=>cb.onStatus?.("online","Bot Bedrock conectado."));
  client.on("spawn",()=>cb.onStatus?.("online","Bot Bedrock entrou no mundo."));
  client.on("text",packet=>cb.onLog?.("chat",String(packet?.message||"Mensagem recebida").slice(0,250)));
  client.on("error",error=>cb.onLog?.("error",error.message));
  client.on("kick",reason=>cb.onLog?.("warn",String(reason).slice(0,250)));
  client.on("close",()=>cb.onEnd?.("Conexão Bedrock encerrada."));
  return {close(){try{client.close();}catch{}}};
}
