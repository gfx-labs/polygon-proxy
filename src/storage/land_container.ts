import {ethers} from "ethers";
import * as abis from "../abis";
import * as interfaces from "../interfaces";

import {scanaround} from "../utils/cluster";

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
  plot_finder:Map<string,string>

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
    this.plot_finder = new Map();

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

    this.plot_location = new Map();
    this.plot_finder = new Map();

    this.district_count = 1;
    this.plot_count = 0;

    this.db = new level(this.data_dir)
    this.activity = new Map();
  }


  force_plot = async(id:string) =>{
    try{
      const x_c = await this.district.plot_x(id)
      const z_c = await this.district.plot_z(id)

      const loc = [parseInt(x_c.toString()), parseInt(z_c.toString())];
      this.set_location(loc[0], loc[1], parseInt(id));
      return loc
    }catch(e){
        throw "no plot here";
    }
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
          this.set_location(parseInt(e.args[0].toString()), parseInt(e.args[1].toString()), e.args[2].toString())
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

  set_location(x:number,z:number,id:number){
    this.plot_location.set(id.toString(),[x,z])
    this.plot_finder.set(`${x}_${z}`,id.toString());
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

  district_metadata = (id:string) =>{
    const dist = this.districts.get(id);
    const dist_con = this.district_content.get(id);
    if(dist !== undefined &&  dist_con !== undefined){
      const contained = Array.from(dist_con.values())
      const pairs = contained.map( x=>{return this.plot_location.get(x)}).map((x)=>{
        if(x!== undefined){
        return `${x[0]}_${x[1]}`}});
      const cluster_map = this.cluster(Array.from(dist_con.values()))
      const clusters = Array.from(cluster_map.entries()).map((x:any)=>{
        return [x[0],Array.from(x[1])]
      })
      return {
        owner:dist,
        contains: contained,
        name:`District ${id}`,
        clusters:Object.fromEntries(clusters),
        description: `A District containing ${contained.length} Plots: \n ${pairs.join(", ")}`,
        image:`https://i.imgur.com/TZKmzvw.png`,
        external_url:`https://etherlands.io/district/${id}`,
        attributes: [
          {
            display_type:"number",
            trait_type:"Size",
            value:contained.length,
          },
          {
            trait_type:"Team",
            value:"None",
          },
        ]
      }
    }
    return undefined;
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
          this.set_location(loc[0],loc[1],i)
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

  cluster = (plotIds:Array<string>) =>{
    const plots = plotIds.filter((x)=>{return (this.plots.has(x) && x != '0')})
    const pairs = plots.map((x)=>{return this.plot_location.get(x)})
    const total = pairs.length
    const keyed = new Map();
    let clustered = new Map();
    const pairmap = new Map();
    for(let i = 0; i < total; i++){
      const entry = pairs[i]
      if(entry !== undefined){
        const x = entry[0];
        const z = entry[1];
        let kx = keyed.get(x);
        keyed.set(x,kx == undefined ? new Map() : kx);
        keyed.get(x).set(z,plots[i])
      }
      pairmap.set(plots[i],pairs[i]);
    }

    let target = 0;
    let cluster_id = 0;
    while(target < total){
      if(clustered.has(plots[target])){
        target = target + 1
        continue;
      }
      scanaround(plots[target],cluster_id,plots,pairmap,keyed,clustered);
      cluster_id = cluster_id + 1;
    }

    const clusters = new Map()
    for(const [plot, id] of clustered.entries()){
      if(!clusters.has(id)){
        clusters.set(id,new Set([plot.toString()]))
      }else{
        clusters.get(id).add(plot);
      }
    }
    return clusters
  }

}

export const initializeLandState = async (datadir:string):Promise<LandState> => {
  const output = new LandState(datadir)
  return output.load();
}
