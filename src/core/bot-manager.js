import {createJavaBot} from "../bots/java.js";
import {createBedrockBot} from "../bots/bedrock.js";
import {validateConnection,validateBotOptions,validateControlAction,validateChatMessage,validatePlayerName} from "./validation.js";

function capabilitiesFor(edition) {
  if(edition==="java") return {movement:true,chat:true,follow:true,autoRespawn:true,autoEat:true,autoEquipArmor:true,autoEquipShield:true,autoReconnect:true};
  return {movement:false,chat:true,follow:false,autoRespawn:false,autoEat:false,autoEquipArmor:false,autoEquipShield:false,autoReconnect:true};
}

export class BotManager {
  constructor({autoReconnect=true,reconnectDelay=10000}={}) {
    this.defaultAutoReconnect=autoReconnect;this.reconnectDelay=reconnectDelay;this.session=null;this.logs=[];
  }
  log(level,message) {
    this.logs.push({at:new Date().toISOString(),level,message:String(message).slice(0,300)});
    if(this.logs.length>200) this.logs.shift();
  }
  status() {
    if(!this.session) return {state:"offline",connected:false,config:null,options:null,capabilities:null};
    const s=this.session;
    return {state:s.state,connected:s.state==="online",config:s.config,options:{...s.options},capabilities:capabilitiesFor(s.config.edition)};
  }
  connect(input) {
    const config=validateConnection(input);
    const options=validateBotOptions(input.options||{},config.edition,{autoReconnect:this.defaultAutoReconnect});
    this.disconnect("Nova conexão solicitada.");
    const s={config,options,state:"connecting",client:null,timer:null,stopped:false};
    this.session=s;this.log("info","Conectando "+config.edition.toUpperCase()+" em "+config.host+":"+config.port);
    this.open(s);return this.status();
  }
  open(s) {
    if(this.session!==s||s.stopped) return;
    const cb={
      onStatus:(state,message)=>{if(this.session===s){s.state=state;this.log("info",message);}},
      onLog:(level,message)=>this.log(level,message),
      onEnd:reason=>{
        if(this.session!==s||s.stopped) return;
        s.state="offline";s.client=null;this.log("warn",reason);this.reconnect(s);
      }
    };
    try { s.client=s.config.edition==="java"?createJavaBot(s.config,cb,s.options):createBedrockBot(s.config,cb,s.options); }
    catch(error) { s.state="error";this.log("error",error?.message||String(error));this.reconnect(s); }
  }
  reconnect(s) {
    if(!s.options.autoReconnect||s.stopped||this.session!==s||s.timer) return;
    this.log("info","Nova tentativa em "+Math.ceil(this.reconnectDelay/1000)+"s.");
    s.timer=setTimeout(()=>{s.timer=null;s.state="connecting";this.open(s);},this.reconnectDelay);
    s.timer.unref?.();
  }
  setOptions(input={}) {
    const s=this.session;if(!s) throw Error("Conecte o bot antes de alterar as opções.");
    s.options=validateBotOptions(input,s.config.edition,s.options);
    s.client?.setOptions?.(s.options);this.log("info","Configurações do bot atualizadas.");
    return {...s.options};
  }
  control(input={}) {
    const s=this.session;if(!s) throw Error("Nenhum bot conectado.");
    const action=validateControlAction(input);
    if(!s.client?.control) throw Error("Controles de movimento indisponíveis.");
    s.client.control(action.direction,action.active);return action;
  }
  chat(input) {
    const s=this.session;if(!s) throw Error("Nenhum bot conectado.");
    const message=validateChatMessage(input?.message);
    if(!s.client?.chat) throw Error("Envio de mensagens indisponível.");
    s.client.chat(message);this.log("chat","Mensagem enviada pelo painel: "+message);
    return {sent:true};
  }
  follow(input={}) {
    const s=this.session;if(!s) throw Error("Nenhum bot conectado.");
    if(typeof input.active!=="boolean") throw Error("Estado de seguir inválido.");
    const player=input.active?validatePlayerName(input.player):"";
    if(!s.client?.follow) throw Error("Seguir jogador está disponível apenas no motor Java.");
    s.client.follow(player,input.active);return {following:input.active,player:input.active?player:null};
  }
  disconnect(reason="Bot parado pelo usuário.") {
    const s=this.session;if(!s) return;
    s.stopped=true;if(s.timer) clearTimeout(s.timer);
    try { s.client?.close(); } catch(error) { this.log("warn",error?.message||String(error)); }
    this.session=null;this.log("info",reason);
  }
  getLogs() { return this.logs.slice(-100); }
}
