import bedrock from "bedrock-protocol";

export function createBedrockBot(config,cb={}) {
  const client=bedrock.createClient({
    host:config.host,port:config.port,username:config.username,
    offline:config.auth!=="microsoft",auth:config.auth==="microsoft"?"microsoft":undefined,
    ...(config.version?{version:config.version}:{})
  });
  let joined=false;
  client.on("join",()=>{joined=true;cb.onStatus?.("online","Bot Bedrock conectado.");});
  client.on("spawn",()=>{joined=true;cb.onStatus?.("online","Bot Bedrock entrou no mundo.");});
  client.on("text",packet=>cb.onLog?.("chat",String(packet?.message||"Mensagem recebida").slice(0,250)));
  client.on("error",error=>cb.onLog?.("error",error?.message||String(error)));
  client.on("kick",reason=>cb.onLog?.("warn",String(reason).slice(0,250)));
  client.on("close",()=>{joined=false;cb.onEnd?.("Conexão Bedrock encerrada.");});
  return {
    close(){joined=false;try{client.close();}catch{}},
    chat(message) {
      if(!joined) throw Error("O bot Bedrock ainda não entrou no mundo.");
      client.queue("text",{
        type:"chat",needs_translation:false,source_name:client.username,xuid:"",
        platform_chat_id:"",filtered_message:"",message
      });
    },
    control() { throw Error("Controles de movimento avançados estão disponíveis apenas no motor Java."); },
    follow() { throw Error("Seguir jogador está disponível apenas no motor Java."); },
    setOptions() {}
  };
}
