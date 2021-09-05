import { ethers } from "ethers";
import * as abis from "./abis";

import Koa from "koa";
import Router from "koa-router";


const app = new Koa();
const router = new Router();


const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com",137);
const district = new ethers.Contract("0x83537906b8501C2843bDe7636E7f0dF0d1daB5eD",abis.district,provider);
const fromBlock = 18761008;

const grabPlot = async (startBlock:number):Promise<any[]>=>{
  return district.queryFilter(district.filters.PlotTransfer(),startBlock)
}

const grabDistrict = async (startBlock:number):Promise<any[]>=>{
  return district.queryFilter(district.filters.Transfer(),startBlock)
}

router.get("/plot/:block", async (ctx,next)=>{
  const lesser = parseInt(ctx.params.block) > fromBlock ? parseInt(ctx.params.block) : fromBlock;
  ctx.status = 200;
  ctx.body = await grabPlot(lesser)
})

router.get("/district/:block", async (ctx,next)=>{
  const lesser = parseInt(ctx.params.block) > fromBlock ? parseInt(ctx.params.block) : fromBlock;
  ctx.status = 200;
  ctx.body = await grabDistrict(lesser)
})

app.use(router.routes()).use(router.allowedMethods()).listen(10100);
console.log("running on port 10100");
