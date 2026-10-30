import express from "express";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {BotManager} from "./core/bot-manager.js";
import {parseBoolean} from "./core/validation.js";
import {getSupportedVersions} from "./core/versions.js";
import {isLocalApiTokenValid} from "./core/local-api-auth.js";

const app=express(),dir=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||3000),host=process.env.HOST||"0.0.0.0";
const manager=new BotManager({autoReconnect:parseBoolean(process.env.AUTO_RECONNECT,true),reconnectDelay:Math.max(3000,Number(process.env.RECONNECT_DELAY_MS)||10000)});

app.disable("x-powered-by");
app.set("trust proxy",1);
app.use(express.json({limit:"10kb"}));

const localApiToken=process.env.LOCAL_API_TOKEN||"";
app.use((req,res,next)=>{
  if(!localApiToken||!(req.path==="/health"||req.path.startsWith("/api/"))) return next();
  if(!isLocalApiTokenValid(localApiToken,req.get("x-local-token"))) {
    return res.status(401).json({error:"Token local inválido ou ausente."});
  }
  next();
});

// A API é pública e não exige token. Escritas recebem limite básico por IP.
const writeWindowMs=60_000,writeLimit=30,writeBuckets=new Map();
function limitPublicWrites(req,res,next){
  const now=Date.now(),key=req.ip||req.socket.remoteAddress||"unknown";
  let bucket=writeBuckets.get(key);
  if(!bucket||now-bucket.startedAt>=writeWindowMs){bucket={startedAt:now,count:0};writeBuckets.set(key,bucket);}
  if(bucket.count>=writeLimit){
    res.set("Retry-After",String(Math.ceil((writeWindowMs-(now-bucket.startedAt))/1000)));
    return res.status(429).json({error:"Limite temporário de comandos atingido. Aguarde um minuto."});
  }
  bucket.count++;
  if(writeBuckets.size>5000){
    for(const [ip,item] of writeBuckets)if(now-item.startedAt>=writeWindowMs)writeBuckets.delete(ip);
  }
  next();
}
app.use("/api",(req,res,next)=>req.method==="POST"?limitPublicWrites(req,res,next):next());
app.use(express.static(path.join(dir,"../public")));
app.get("/health",(_q,r)=>r.json({ok:true,service:"afk-bot-mine-v2"}));
app.get("/api/versions",(_q,r)=>r.json(getSupportedVersions()));
app.get("/api/status",(_q,r)=>r.json(manager.status()));
app.get("/api/logs",(_q,r)=>r.json({logs:manager.getLogs()}));
app.post("/api/connect",(q,r)=>{try{r.status(202).json(manager.connect(q.body));}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/options",(q,r)=>{try{r.json({options:manager.setOptions(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/control",(q,r)=>{try{r.json({ok:true,...manager.control(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/chat",(q,r)=>{try{r.json({ok:true,...manager.chat(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/follow",(q,r)=>{try{r.json({ok:true,...manager.follow(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/disconnect",(_q,r)=>{manager.disconnect();r.json({ok:true,status:manager.status()});});
const server=app.listen(port,host,()=>console.log("AFK Bot Mine V2 ativo em "+host+":"+port));
function shutdown(){manager.disconnect("Servidor encerrando.");server.close(()=>process.exit(0));}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
