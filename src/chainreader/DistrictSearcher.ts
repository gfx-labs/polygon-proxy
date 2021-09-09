import {ChainSearcher} from "./ChainSearcher"
import * as dotenv from "dotenv";
import {ethers} from "ethers";
import * as abis from "../abis"
dotenv.config({path:".env"});
import { DistrictEmitter } from "./DistrictReader";
import {parseBN} from "../utils/parseBN"
const zadder = "0x0000000000000000000000000000000000000000";

const ALCHEMY_MAX=1950;

export class DistrictSearcher extends ChainSearcher{

  emitter:DistrictEmitter;
  last_update:number;

  constructor(provider:ethers.providers.JsonRpcProvider, emitter:DistrictEmitter){
    super(provider,abis.district,"0xc7b4cdf2c8ff3fc94d4f9f882d86ce824e0fb985")
    this.emitter = emitter;
    this.last_update = 18792700;
  };

  get_plot_coords = async (id:number):Promise<[number,number]> => {
    try{
      const x = await this.call_contract("plot_x",parseBN,id);
      const z = await this.call_contract("plot_z",parseBN,id);
      this.emitter.emit("PlotCreateEvent",[x,z,id])
      return [x,z];
    }catch(e){
      throw `call failed: ${e}`;
    }
  }
  get_plot_district = async(id:number):Promise<number> =>{
    return this.call_contract("plotDistrictOf",(n):number=>{
      const d = parseBN(n)
      this.emitter.emit("PlotTransferEvent",[0,d,id])
      return d
    },id);
  }

  get_district_owner = async(id:number):Promise<string> =>{
    if(id===0){
      return zadder
    }
    return this.call_contract("ownerOf",(n):string=>{
      this.emitter.emit("TransferEvent",[id,n]);
      return n;
    },id)
  }

  get_plot_count = async():Promise<number> =>{
    return this.call_contract("totalPlots",parseBN)
  }

  get_district_count = async():Promise<number> =>{
    return this.call_contract("totalSupply",parseBN)
  }

}


