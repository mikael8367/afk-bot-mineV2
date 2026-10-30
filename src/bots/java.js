import mineflayer from "mineflayer";
export function createJavaBot(config, cb={}) {
  const bot=mineflayer.createBot({host:config.host,port:config.port,username:config.username,auth:config.auth,...(config.version?{version:config.version}:{})});
  bot.on("login",()=>cb.onStatus?.("online","Bot Java conectado."));
  bot.on("spawn",()=>cb.onStatus?.("online","Bot Java entrou no mundo."));
  bot.on("kicked",reason=>cb.onLog?.("warn","Expulso: "+String(reason).slice(0,250)));
  bot.on("error",error=>cb.onLog?.("error",error.message));
  bot.on("end",reason=>cb.onEnd?.(reason||"Conexão encerrada."));
  bot.on("messagestr",message=>cb.onLog?.("chat",String(message).slice(0,250)));
  return {close(){try{bot.quit("AFK Bot Mine V2 encerrado");}catch{}}};
}
