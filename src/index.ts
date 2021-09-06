import Koa from "koa";
import Router from "koa-router";

import {CLI} from "cliffy";
import {initializeLandState, LandState} from "./storage/land_container";
import {district} from "./abis";
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



cli.addCommand("cluster", {
  parameters:[{label:"amt",type:"number"}],
  action:(params, exec)=>{
    const targets = Array.from(Array(params.amt).keys()).map((x)=>{return x.toString()})
    landState.cluster(targets);
  }
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

router.get("/district_lite/:id", (ctx,next) =>{
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

router.get("/district/:id", (ctx,next) =>{
  const payload = landState.district_metadata(ctx.params.id.toString())
  if(payload !== undefined){
  ctx.status = 200
  ctx.body = payload
  }else{
    ctx.status = 400
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
        const plotId = landState.plot_finder.get(`${x_c}_${z_c}`);
        if(plotId !== undefined){
          plots.add(plotId)
          const districtId = landState.plots.get(plotId);
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
