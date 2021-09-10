import {ethers} from "ethers";
import Koa from "koa";
import Router from "koa-router";
import * as dotenv from "dotenv";
dotenv.config({path:".env"});

const app = new Koa();
const router = new Router();

import {cli} from "./repl"

import {DistrictReader} from "./chainreader/DistrictReader"
import {level_store} from "./storage/level_store"
import {Map2} from "./utils/Map2";

const prov = new ethers.providers.JsonRpcProvider(process.env.RPC_URL as string)
const WS = new ethers.providers.WebSocketProvider(process.env.WS_URL as string)
const db = new level_store('./db');
const reader = new DistrictReader(WS,prov,db);

router.get("/plot/:plotid", async (ctx,next) => {
  const location = reader.plot_location.get(parseInt(ctx.params.plotid))
  if(location !== undefined){
    ctx.status = 200
    ctx.body = {coord:location};
  }else{
    try {
    await reader.force_get_plot(parseFloat(ctx.params.plotid))
    ctx.body = {coord:location};
    ctx.status = 200
    }catch(e){
    ctx.status = 400
    ctx.body = e
    }
  }
});



router.get("/plots/:x1/:x2/:z1/:z2", (ctx,next) =>{
  const x1 = parseInt(ctx.params.x1);
  const x2 = parseInt(ctx.params.x2);
  const z1 = parseInt(ctx.params.z1);
  const z2 = parseInt(ctx.params.z2);
  const plots = new Set()
  const districts = new Set()
  if(x1!== undefined && x2 !== undefined && z1 !== undefined && z2 !== undefined){
    for(let x_c = x1; x_c <= x2; x_c++){
      for(let z_c = z1; z_c <= z2; z_c++){
        const plotId = reader.plot_location_reverse.getDefault(x_c,z_c,undefined)
        if(plotId !== undefined){
          plots.add(plotId)
          const districtId = reader.plot_district.get(plotId);
          if(districtId !== undefined){
            districts.add(districtId)
          }
        }
      }
    }
    ctx.status = 200
    ctx.body = {
      p:Array.from(plots.values()),
      d:Array.from(districts.values()),
    }
  }else{
    ctx.status = 400
  }
});



router.get("/since/:block", (ctx,next) =>{
 const block =  parseInt(ctx.params.block)
 let toUpdate = new Set();
 for(const [bn,districts] of reader.activity){
   if(bn > block){
     for(const d of districts.values()){
       toUpdate.add(d)
     }
   }
 }
 ctx.status = 200
 ctx.body = {block:reader.last_update,update: Array.from(toUpdate.values())}
});

router.get("/block", (ctx,next) =>{
  ctx.status = 200
  ctx.body = reader.last_update
});


cli.addCommand("resync",async (params, opt)=>{
  await reader.force_resync();
});

cli.addCommand("cluster", {
  parameters:[{label:"amt",type:"number"}],
  action:(params, exec)=>{
  }
})

cli.addCommand("plot", {
  parameters:[{label:"id",type:"number"}],
  action:async (params, exec)=>{
    const coords = await reader.get_plot(params.id)
    const district = await reader.get_plot_district(params.id)
    cli.log(`district: ${district}    location: ${coords}`)
  }
})


router.get("/district_lite/:id", (ctx,next) =>{
  const dist = reader.district_owner.get(parseInt(ctx.params.id))
  const dist_con = reader.district_plots.get(parseInt(ctx.params.id));
  if(dist !== undefined && dist_con !== undefined){
  ctx.status = 200
  ctx.body = {
    owner:dist,
    contains:Array.from(dist_con.values()),
  }
  }else{
    ctx.status = 400
  }
});

router.get("/district/:id", (ctx,next) =>{
  const payload = reader.district_metadata(parseInt(ctx.params.id))
  if(payload !== undefined){
    ctx.status = 200
    ctx.body = payload
  }else{
    ctx.status = 400
  }
});

cli.addCommand("forcePlot", {
  parameters:[{label:"id",type:"number"}],
  action:async (params, exec)=>{
    const coords = await reader.force_get_plot(params.id)
    const district = await reader.force_get_plot_district(params.id)
    cli.log(`district: ${district}    location: ${coords}`)
  }
})


cli.addCommand("forceDistrict", {
  parameters:[{label:"id",type:"number"}],
  action:async (params, exec)=>{
    const owner = await reader.force_get_district_owner(params.id)
    cli.log(`district: ${params.id}    owner: ${owner}`)
  }
})

cli.addCommand("call", {
  parameters:[
    {label:"method",type:"string"},
    {label:"args",type:"string",rest:true}
  ],
  action:async (params, exec)=>{
    await reader.searcher.call_contract(params.method,cli.log,...params.args).catch((e)=>{console.log(`call failed with: ${e}`)})
  }
})

cli.addCommand("prop", {
  parameters:[
    {label:"item",type:"string"},
  ],
  action:(params, exec)=>{
    let cast:any = reader
    if(cast[params.item]){
    console.log(cast[params.item])
    }
  }
})

cli.addCommand("district", {
  parameters:[{label:"id",type:"number"}],
  action:async (params, exec)=>{
    const owner = await reader.get_district_owner(parseInt(params.id))
    cli.log(`owner: ${owner}`)
  }
})

cli.addCommand("exit", async (params, opt)=>{
  process.exit(0)
});

let running = 0;
(async () => {
  await reader.load();
  app.use(router.routes()).use(router.allowedMethods()).listen(10100);

  console.log("running on port 10100");
  cli.show();
})()
