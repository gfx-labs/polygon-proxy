import Koa from "koa";
import Router from "koa-router";

import {CLI} from "cliffy";
import {initializeLandState, LandState} from "./storage/land_container";
let landState:LandState;

const app = new Koa();
const router = new Router();



let cli:CLI = new CLI().setDelimiter("polygon_reader>");

cli.addCommand("update",async (params, opt)=>{
  await landState.update().then(console.log)
});

cli.addCommand("show",(params, opt)=>{
  landState.show();
});

cli.addCommand("load", async (params, opt)=>{
  await landState.load()
  console.log("loaded")
});


cli.addCommand("save", async (params, opt)=>{
  await landState.save();
  console.log("saved")
});

cli.addCommand("reset", async (params, opt)=>{
  landState.reset();
  await landState.save();
  console.log("reset")
})

cli.addCommand("setBlock", {
  parameters:[{label:"blocknumber",type:"number"}],
  action:async (params, exec)=>{
    landState.last_block = params.blocknumber;
    await landState.save();
  }
})

cli.addCommand("district", {
  parameters:[{label:"id",type:"number"}],
  action:async (params, exec)=>{
    landState.show_district(params.id.toString());
  }
})

cli.addCommand("activity", ()=>{
  console.log(landState.activity.entries())
})


cli.addCommand("exit", async (params, opt)=>{
  await landState.save();
  process.exit(0);
});

router.get("/plot/:plotid", (ctx,next) =>{
 const location = landState.plot_location.get(ctx.params.plotid)
 if(location !== undefined){
  ctx.status = 200
   ctx.body = {coord:location};
 }else{
     ctx.status = 400
   }
});


router.get("/since/:block", (ctx,next) =>{
 const block =  parseInt(ctx.params.block)
 let toUpdate = new Set();
 for(const [bn,districts] of landState.activity){
   if(bn > block){
     for(const d of districts.values()){
       toUpdate.add(d)
     }
   }
 }
 ctx.status = 200
 ctx.body = {block:landState.last_block,update: Array.from(toUpdate.values())}
});

router.get("/block", (ctx,next) =>{
  ctx.status = 200
  ctx.body = landState.last_block;
});

router.get("/district/:id", (ctx,next) =>{
  const dist = landState.districts.get(ctx.params.id.toString());
  const dist_con = landState.district_content.get(ctx.params.id.toString());
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


let running = 0;
(async () => {
  landState = await initializeLandState("./db")


  setInterval(async ()=>{
    if(running == 0){
      running = 1
      await landState.update();
      running = 0
    }
  },30*1000)

  app.use(router.routes()).use(router.allowedMethods()).listen(10100);
  console.log("running on port 10100");

  cli.show();
})()
