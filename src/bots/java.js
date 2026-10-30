import mineflayer from "mineflayer";
import pathfinderPackage from "mineflayer-pathfinder";

const {pathfinder,Movements,goals}=pathfinderPackage;
const {GoalFollow}=goals;
const CONTROLS=new Set(["forward","back","left","right","jump","sprint","sneak"]);
const ARMOR_PARTS=[
  {suffix:"_helmet",destination:"head",slot:5},
  {suffix:"_chestplate",destination:"torso",slot:6},
  {suffix:"_leggings",destination:"legs",slot:7},
  {suffix:"_boots",destination:"feet",slot:8}
];
const MATERIAL_RANK={netherite:7,diamond:6,iron:5,chainmail:4,golden:3,gold:3,turtle:2,leather:1};
const BANNED_FOOD=new Set(["rotten_flesh","pufferfish","poisonous_potato","spider_eye","chorus_fruit"]);

function armorRank(name="") {
  const material=Object.keys(MATERIAL_RANK).find(key=>name.startsWith(key+"_"));
  return material?MATERIAL_RANK[material]:0;
}

export function createJavaBot(config,cb={},initialOptions={}) {
  const bot=mineflayer.createBot({
    host:config.host,port:config.port,username:config.username,auth:config.auth,
    respawn:false,...(config.version?{version:config.version}:{})
  });
  bot.loadPlugin(pathfinder);
  let options={...initialOptions},movements=null,followName=null,closed=false;
  let eating=false,equipping=false,deathTimer=null,lastEatAt=0,lastEquipAt=0;
  const warned=new Set();
  const log=(level,message)=>cb.onLog?.(level,String(message).slice(0,250));

  async function equipAvailableGear() {
    if(closed||equipping||!bot.entity||(!options.autoEquipArmor&&!options.autoEquipShield)) return;
    equipping=true;
    try {
      if(options.autoEquipArmor) {
        for(const part of ARMOR_PARTS) {
          const items=bot.inventory.items();
          const best=items.filter(item=>item.name?.endsWith(part.suffix)).sort((a,b)=>armorRank(b.name)-armorRank(a.name))[0];
          if(!best) continue;
          const current=bot.inventory.slots?.[part.slot]||null;
          if(current&&armorRank(current.name)>=armorRank(best.name)) continue;
          if(!current||armorRank(best.name)>armorRank(current.name)) {
            await bot.equip(best,part.destination);
            log("info","Equipado: "+best.name);
          }
        }
      }
      if(options.autoEquipShield) {
        const offhand=bot.inventory.slots?.[45]||null;
        const shield=bot.inventory.items().find(item=>item.name==="shield");
        if(!offhand&&shield) {
          await bot.equip(shield,"off-hand");
          log("info","Escudo equipado na mão secundária.");
        }
      }
    } catch(error) {
      const message=error?.message||String(error);
      if(!warned.has(message)) { warned.add(message);log("warn","Não foi possível equipar um item: "+message); }
    } finally { equipping=false; }
  }

  async function eatIfNeeded() {
    if(closed||eating||!options.autoEat||!bot.entity||typeof bot.food!=="number"||bot.food>15||bot.health<=0) return;
    if(Date.now()-lastEatAt<2500) return;
    lastEatAt=Date.now();
    const foods=bot.inventory.items().map(item=>{
      const data=bot.registry.foods?.[item.name]||bot.registry.foods?.["minecraft:"+item.name];
      return {item,points:Number(data?.foodPoints??data?.food??0),saturation:Number(data?.saturation??0)};
    }).filter(entry=>entry.points>0&&!BANNED_FOOD.has(entry.item.name));
    foods.sort((a,b)=>(b.points-a.points)||(b.saturation-a.saturation));
    const chosen=foods[0]?.item;
    if(!chosen) return;
    eating=true;
    const previous=bot.heldItem;
    try {
      await bot.equip(chosen,"hand");
      await bot.consume();
      log("info","Bot comeu "+chosen.name+".");
      if(previous) { try { await bot.equip(previous,"hand"); } catch {} }
    } catch(error) { log("warn","Auto-comer: "+(error?.message||String(error))); }
    finally { eating=false; }
  }

  bot.on("login",()=>cb.onStatus?.("online","Bot Java conectado."));
  bot.on("spawn",()=>{
    cb.onStatus?.("online","Bot Java entrou no mundo.");
    try {
      movements=new Movements(bot);
      movements.canDig=false;
      movements.allow1by1towers=false;
      movements.allowParkour=false;
      bot.pathfinder.setMovements(movements);
    } catch(error) { log("warn","Navegação: "+(error?.message||String(error))); }
    void equipAvailableGear();
  });
  bot.on("death",()=>{
    if(!options.autoRespawn||closed) return;
    if(deathTimer) clearTimeout(deathTimer);
    log("info","Bot morreu; tentando renascer automaticamente.");
    deathTimer=setTimeout(()=>{
      deathTimer=null;
      if(closed) return;
      try { bot.respawn(); } catch(error) { log("warn","Auto-renascer: "+(error?.message||String(error))); }
    },1500);
  });
  bot.on("physicsTick",()=>{
    if(options.autoEat) void eatIfNeeded();
    if((options.autoEquipArmor||options.autoEquipShield)&&Date.now()-lastEquipAt>6000) {
      lastEquipAt=Date.now();void equipAvailableGear();
    }
  });
  bot.on("kicked",reason=>log("warn","Expulso: "+String(reason).slice(0,250)));
  bot.on("error",error=>log("error",error?.message||String(error)));
  bot.on("end",reason=>{
    closed=true;if(deathTimer) clearTimeout(deathTimer);
    cb.onEnd?.(reason||"Conexão encerrada.");
  });
  bot.on("messagestr",message=>log("chat",String(message)));

  return {
    close() {
      closed=true;if(deathTimer) clearTimeout(deathTimer);
      try { bot.clearControlStates(); } catch {}
      try { bot.pathfinder?.setGoal(null); } catch {}
      try { bot.quit("AFK Bot Mine V2 encerrado"); } catch {}
    },
    chat(message) {
      if(!bot.entity) throw Error("O bot ainda não entrou no mundo.");
      bot.chat(message);
    },
    control(direction,active) {
      if(!CONTROLS.has(direction)) throw Error("Controle de movimento inválido.");
      if(!bot.entity) throw Error("O bot ainda não entrou no mundo.");
      if(followName) { followName=null;bot.pathfinder.setGoal(null); }
      bot.setControlState(direction,active);
    },
    follow(playerName,active) {
      if(!bot.entity) throw Error("O bot ainda não entrou no mundo.");
      if(!active) { followName=null;bot.pathfinder.setGoal(null);bot.clearControlStates();return; }
      const target=bot.players[playerName]?.entity;
      if(!target) throw Error("Não encontrei esse jogador no mundo. Confira o nome e tente novamente.");
      if(!movements) {
        movements=new Movements(bot);movements.canDig=false;
        movements.allow1by1towers=false;movements.allowParkour=false;
        bot.pathfinder.setMovements(movements);
      }
      followName=playerName;bot.clearControlStates();
      bot.pathfinder.setGoal(new GoalFollow(target,2),true);
      log("info","Seguindo o jogador "+playerName+".");
    },
    setOptions(next) {
      options={...options,...next};
      if(!options.autoRespawn&&deathTimer) { clearTimeout(deathTimer);deathTimer=null; }
      if(options.autoEquipArmor||options.autoEquipShield) void equipAvailableGear();
    }
  };
}
