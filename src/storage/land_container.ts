import {ethers} from "ethers";
import * as abis from "../abis";
import * as interfaces from "../interfaces";

import level from 'level-ts';

import * as dotenv from "dotenv";
dotenv.config({path:".env"})


const ALCHEMY_MAX=1950;

const CONTRACT_ADDR = "0xc7b4cdf2c8ff3fc94d4f9f882d86ce824e0fb985"

export class LandState {
  data_dir:string;

  activity:Map<number,Set<string>>

  districts:Map<string,string>;
  plots:Map<string,string>;

  plot_location:Map<string,[number, number]>

  district_content:Map<string,Set<string>>;

  last_block:number;

  rpc_url:string;
  provider: ethers.providers.JsonRpcProvider;
  district: ethers.Contract;

  db:level;

  district_count:ethers.BigNumberish;
  plot_count:ethers.BigNumberish;


  constructor(datadir:string){
    this.data_dir = datadir;
    this.rpc_url = process.env.RPC_URL as string;
    this.provider = new ethers.providers.JsonRpcProvider(this.rpc_url,137);
    this.district = new ethers.Contract(CONTRACT_ADDR,abis.district,this.provider);

    this.districts = new Map([["0","0x0000000000000000000000000000000000000000"]]);
    this.plots = new Map();
    this.district_content = new Map();
    this.last_block = 18792700;

    this.plot_location = new Map();

    this.district_count = 0;
    this.plot_count = 0;

    this.db = new level(this.data_dir)

    this.activity = new Map();

  }

  __init = (datadir:string) => {
    this.data_dir = datadir;
    this.rpc_url = process.env.RPC_URL as string;
    this.provider = new ethers.providers.JsonRpcProvider(this.rpc_url,137);
    this.district = new ethers.Contract(CONTRACT_ADDR,abis.district,this.provider);

    this.districts = new Map([["0","0x0000000000000000000000000000000000000000"]]);
    this.plots = new Map();
    this.district_content = new Map();
    this.last_block = 18792700;

    this.district_count = 1;
    this.plot_count = 0;

    this.db = new level(this.data_dir)
    this.activity = new Map();
  }


  update = async():Promise<number>=>{
    let count = 0;
    try{
      const current = await this.provider.getBlockNumber();
      let target = this.last_block + ALCHEMY_MAX;
      target = target > current ? current : target;
      if(target - this.last_block < 10){
        return 0;
      }

      const district_events = await this.district.queryFilter(this.district.filters.Transfer(),this.last_block,target)
      for(const e of district_events){
        if(e.args !== undefined){
          const action =  {
            blockNumber:e.blockNumber,
            origin:e.args[0],
            target:e.args[1],
            district:e.args[2]
          }
          await this.move_district(action);
          count++
        }
      }
      this.district_count = this.districts.size
      const plot_events = await this.district.queryFilter(this.district.filters.PlotTransfer(),this.last_block,target)
      for(const e of plot_events){
        if(e.args !== undefined){
          const action = {
            blockNumber:e.blockNumber,
            origin:e.args[0],
            target:e.args[1],
            plot:e.args[2]
          }
          await this.move_plot(action);
          count++;
        }
      }
      const plot_creates = await this.district.queryFilter(this.district.filters.PlotCreation(),this.last_block,target)
      for(const e of plot_creates){
        if(e.args !== undefined){
          this.plot_location.set(e.args[2].toString(),[parseInt(e.args[0].toString()), parseInt(e.args[1].toString())])
          count++;
        }
      }

      this.plot_count = this.plots.size
      this.last_block = target;
      return count;
    }catch(e){
      throw e;
    }
  }

  mark_update = (block:number, district:string) =>{
    let log = this.activity.get(block)
    if(log == undefined){
      this.activity.set(block,new Set([district]))
    }else{
      log.add(district)
    }
  }

  move_district = async(event:interfaces.DistrictTransfer) =>{
    const bn = parseInt(event.blockNumber.toString())
    if(this.last_block <= bn){
      this.mark_update(bn,event.district.toString());
      this.districts.set(event.district.toString(), event.target.toString())
    }
  }

  move_plot = async(event:interfaces.PlotTransfer) =>{
    const bn = parseInt(event.blockNumber.toString())
    this.mark_update(bn,event.origin.toString());
    this.mark_update(bn,event.target.toString());
    if(this.last_block <= bn){
      const origin = this.init_district(event.origin);
      const target = this.init_district(event.target);
      origin.delete(event.plot.toString());
      target.add(event.plot.toString());
      this.plots.set(event.plot.toString(), event.target.toString())
    }
  }

  init_district = (id:ethers.BigNumberish):Set<string> => {
    let origin_set = this.district_content.get(id.toString())
    if(origin_set == undefined){
      this.district_content.set(id.toString(),new Set())
      origin_set = this.district_content.get(id.toString())
    }
    return origin_set as Set<string>;
  }

  show = ()=>{
    console.log(`district_content:${Array.from(this.district_content.entries())}`);
    console.log(`districts:${Array.from(this.districts.entries())}`);
    console.log(`plots:${Array.from(this.plots.entries())}`);
    console.log(`last_block:${this.last_block}`);
    console.log(`districts:${this.district_count} plots:${this.plot_count}`)
  }

  show_district = (id:string) =>{
    const dist = this.district_content.get(id)
    const owner = this.districts.get(id)
    if(dist !== undefined && owner !== undefined){
      console.log(`District ${id} ${owner}:\n`,Array.from(dist.values()))
    }
  }

  reset = () =>{
    this.__init(this.data_dir);
  }

  save = async()=>{
    try{
      for(const [plot,district] of this.plots.entries()){
        await this.db.put(`p!`+plot,district);
        const location = this.plot_location.get(plot.toString());
        if( location !== undefined){
          await this.db.put(`pl!`+plot,location)
        }
      }
      this.db.put("plot_count",this.plots.size);
      for(const [district,owner] of this.districts.entries()){
        await this.db.put(`d!`+district,owner);
      }
      this.db.put("district_count",this.districts.size);
      this.db.put("last_block",this.last_block)

      for(const [district,contents] of this.district_content.entries()){
        await this.db.put(`dc!`+district, Array.from(contents.values()));
      }

      await this.db.put("activity",Array.from(this.activity.entries()).map(([a,b])=>{return [a,Array.from(b.values())]}))
    }catch(e){
      throw e;
    }

  }

  load = async():Promise<LandState> => {
    try{
      this.last_block = await this.db.get("last_block").catch(()=>{return this.last_block})

      this.plot_count = await this.db.get("plot_count").catch(()=>{return 0})
      for(let i = 0; i < this.plot_count; i++){
        const info = await this.db.get(`p!${i}`).catch(()=>{return "0"})
        this.plots.set(`${i}`,info)

        const loc = await this.db.get(`pl!${i}`).catch(()=>{return undefined})
        if(loc !== undefined){
          this.plot_location.set(`${i}`,loc)
        }
      }

      this.district_count = await this.db.get("district_count").catch(()=>{return 0})
      for(let i = 0; i < this.district_count; i++){
        const info = await this.db.get(`d!${i}`).catch(()=>{return "0"})
        this.districts.set(`${i}`,info)

        const content = await this.db.get(`dc!${i}`).catch(()=>{return []})
        this.district_content.set(`${i}`, new Set(content))
      }

      const activity_entries = await this.db.get("activity").catch(()=>{return []})
      for(const [blockNumber, districts] of activity_entries){
        this.activity.set(parseInt(blockNumber),new Set(districts));
      }

      return this;
    }catch(e){
      throw e;
    }
  }

}

export const initializeLandState = async (datadir:string):Promise<LandState> => {
  const output = new LandState(datadir)
  return output.load();
}
