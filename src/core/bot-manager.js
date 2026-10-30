import {createJavaBot} from "../bots/java.js";
import {createBedrockBot} from "../bots/bedrock.js";
import {validateConnection} from "./validation.js";
export class BotManager {
  constructor({autoReconnect=true,reconnectDelay=10000}={}) {this.autoReconnect=autoReconnect;this.reconnectDelay=reconnectDelay;this.session=null;this.logs=[];}
  log(level,message){this.logs.push({at:new Date().toISOString(),level,message:String(message).slice(0,300)});if(this.logs.length>200)this.logs.shift();}
  status(){return this.session?{state:this.session.state,connected:this.session.state==="online",config:this.session.config}:{state:"offline",connected:false,config:null};}
  connect(input){const config=validateConnection(input);this.disconnect("Nova conexão solicitada.");const s={config,state:"connecting",client:null,timer:null,stopped:false};this.session=s;this.log("info","Conectando "+config.edition.toUpperCase()+" em "+config.host+":"+config.port);this.open(s);return this.status();}
  open(s){if(this.session!==s||s.stopped)return;const cb={
    onStatus:(state,msg)=>{if(this.session===s){s.state=state;this.log("info",msg);}},
    onLog:(level,msg)=>this.log(level,msg),
    onEnd:reason=>{if(this.session!==s)return;s.state="offline";s.client=null;this.log("warn",reason);this.reconnect(s);}
  };
  try{s.client=s.config.edition==="java"?createJavaBot(s.config,cb):createBedrockBot(s.config,cb);}
  catch(e){s.state="error";this.log("error",e.message);this.reconnect(s);}}
  reconnect(s){if(!this.autoReconnect||s.stopped||this.session!==s||s.timer)return;this.log("info","Nova tentativa em "+Math.ceil(this.reconnectDelay/1000)+"s.");s.timer=setTimeout(()=>{s.timer=null;s.state="connecting";this.open(s);},this.reconnectDelay);s.timer.unref?.();}
  disconnect(reason="Bot parado pelo usuário."){const s=this.session;if(!s)return;s.stopped=true;if(s.timer)clearTimeout(s.timer);try{s.client?.close();}catch(e){this.log("warn",e.message);}this.session=null;this.log("info",reason);}
  getLogs(){return this.logs.slice(-100);}
}
