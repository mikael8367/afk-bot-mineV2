import express from "express";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {BotManager} from "./core/bot-manager.js";
import {parseBoolean} from "./core/validation.js";

const app=express(),dir=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||3000);
const token=process.env.ADMIN_TOKEN||"",accessKey=process.env.ACCESS_KEY||"";
const manager=new BotManager({autoReconnect:parseBoolean(process.env.AUTO_RECONNECT,true),reconnectDelay:Math.max(3000,Number(process.env.RECONNECT_DELAY_MS)||10000)});
function safeEqual(a,b){if(typeof a!=="string"||typeof b!=="string"||!a||a.length!==b.length)return false;return requireSafeCompare(a,b);}
function requireSafeCompare(a,b){return Buffer.from(a).length===Buffer.from(b).length&&cryptoTimingSafeEqual(Buffer.from(a),Buffer.from(b));}
import {timingSafeEqual as cryptoTimingSafeEqual} from "node:crypto";

app.disable("x-powered-by");
app.use(express.json({limit:"10kb"}));
app.get("/access/:key",(q,r)=>{if(!token||!accessKey||!safeEqual(q.params.key,accessKey))return r.status(404).send("Link de acesso inválido.");r.set("Cache-Control","no-store");r.cookie("afk_session",token,{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:30*24*60*60*1000});r.redirect(303,"/");});
app.use(express.static(path.join(dir,"../public")));
app.get("/health",(_q,r)=>r.json({ok:true,service:"afk-bot-mine-v2"}));
app.use("/api",(q,r,next)=>{
  if(!token||token==="replace-with-a-long-random-secret")return r.status(503).json({error:"Configure ADMIN_TOKEN nas variáveis de ambiente."});
  const cookie=(q.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("afk_session="))?.slice("afk_session=".length)||"";
  const sent=q.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!safeEqual(cookie,token)&&!safeEqual(sent,token))return r.status(401).json({error:"Acesso não autorizado. Abra seu link privado de acesso."});
  next();
});
app.get("/api/status",(_q,r)=>r.json(manager.status()));
app.get("/api/logs",(_q,r)=>r.json({logs:manager.getLogs()}));
app.post("/api/connect",(q,r)=>{try{r.status(202).json(manager.connect(q.body));}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/options",(q,r)=>{try{r.json({options:manager.setOptions(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/control",(q,r)=>{try{r.json({ok:true,...manager.control(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/chat",(q,r)=>{try{r.json({ok:true,...manager.chat(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/follow",(q,r)=>{try{r.json({ok:true,...manager.follow(q.body)});}catch(e){r.status(400).json({error:e.message});}});
app.post("/api/disconnect",(_q,r)=>{manager.disconnect();r.json({ok:true,status:manager.status()});});
const server=app.listen(port,"0.0.0.0",()=>console.log("AFK Bot Mine V2 ativo na porta "+port));
function shutdown(){manager.disconnect("Servidor encerrando.");server.close(()=>process.exit(0));}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
