import {ethers} from "ethers";
import {DistrictListener} from "./DistrictListener";
import {DistrictSearcher} from "./DistrictSearcher";
import {KVStore} from "../interfaces/KVStore";
import {SetMap} from "../utils/SetMap";
import {Map2} from "../utils/Map2";
import Emittery from "emittery";
import {scanaround} from "../utils/cluster";

const zadder = "0x0000000000000000000000000000000000000000"


export type DistrictEmitter = Emittery<{
  TransferEvent:[number,string]
  PlotTransferEvent:[number,number,number]
  PlotCreateEvent:[number,number,number]
  UpdateBlock:number
}>;

export class DistrictReader {
  plot_location:Map<number, [number, number]>;
  plot_location_reverse:Map2<number,number,number>;

  plot_district:Map<number,number>;

  district_owner:Map<number,string>;
  owner_district:Map<string,number>;

  district_plots:SetMap<number,number>;

  activity:SetMap<number,number>;

  listener:DistrictListener
  searcher:DistrictSearcher

  db:KVStore;

  emitter:DistrictEmitter;
  last_update:number;


  constructor(websocket:ethers.providers.WebSocketProvider, rpc:ethers.providers.JsonRpcProvider, db:KVStore){
    this.emitter = new Emittery() as (DistrictEmitter);
    this.listener = new DistrictListener(websocket,this.emitter);
    this.searcher = new DistrictSearcher(rpc,this.emitter);

    this.db = db;

    this.last_update = 18792700;
    this.plot_location = new Map();
    this.plot_location_reverse = new Map2();

    this.plot_district = new Map();

    this.district_owner = new Map([[0,zadder]])
    this.owner_district = new Map();

    this.district_plots = new SetMap();

    this.activity = new SetMap();

    this.start();
  }

  start = () => {
    this.emitter.on("TransferEvent", (a:[number,string])=>{
      this.set_district_owner(...a)
      console.log("TranferEvent",a)
    })

    this.emitter.on("PlotTransferEvent", (a:[number,number,number])=>{
      console.log("PlotTransferEvent",a)
      this.set_plot_district(...a)
    })
    this.emitter.on("PlotCreateEvent", (a:[number,number,number])=>{
      console.log("PlotCreateEvent",a)
      this.set_plot_location(...a)
    })
    this.emitter.on("UpdateBlock",(a:number) =>{
      this.last_update = a;
      this.db.put("u",0,a);
    })
  }

  force_resync = async ()=>{
    const plot_count = await this.searcher.get_plot_count()
    const district_count = await this.searcher.get_district_count()
    console.log(`Plots: ${plot_count} Districts: ${district_count} Running Full Resync`)
    for(let plot_id = 0; plot_id <= plot_count; plot_id++){
      if(plot_id % 10 == 0){
        console.log(`plot ${plot_id}/${plot_count}`)
      }
      try{
        let loc = await this.searcher.get_plot_coords(plot_id)
        let dist = await this.searcher.get_plot_district(plot_id)
        this.set_plot_location(loc[0],loc[1],plot_id,true);
        this.set_plot_district(0,dist,plot_id,true);
      }catch(e){
        console.log(e)
      }
    }
    for(let district_id = 1; district_id <= (district_count+1); district_id++){
      if(district_id % 10 == 0){
        console.log(`district ${district_id}/${district_count}`)
      }
      try{
        let owner = await this.searcher.get_district_owner(district_id);
        this.set_district_owner(district_id, owner,true);
      }catch(e){
      }
    }
  }

  district_metadata = (id:number) =>{
    const dist = this.district_owner.get(id);
    const dist_con = this.district_plots.get(id);
    if(dist !== undefined &&  dist_con !== undefined){
      const contained = Array.from(dist_con.values())
      const pairs = contained.map( x=>{return this.plot_location.get(x)}).map((x)=>{
        if(x!== undefined){
          return `${x[0]}_${x[1]}`
        }
      });
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

  async get_plot(id:number):Promise<[number,number]>{
    const answer = this.plot_location.get(id)
    if(answer != undefined){
      return answer;
    }
    throw `plot ${id} not found`
  }

  async force_get_plot(id:number):Promise<[number,number]>{
    return this.searcher.get_plot_coords(id).then((res)=>{
      this.set_plot_location(res[0],res[1],id);
      return res;
    })
  }

  async get_plot_district(id:number){
    const answer = this.plot_district.get(id)
    if(answer != undefined){
      return answer;
    }
    throw `plot ${id} not found`
  }

  async force_get_plot_district(id:number){
    return this.searcher.get_plot_district(id).then((res)=>{
      this.set_plot_district(0,id,res)
      return res;
    })
  }

  async get_district_owner(id:number){
    const answer = this.district_owner.get(id)
    if(answer != undefined){
      return answer;
    }
    throw `district${id} not found`
  }

  async force_get_district_owner(id:number){
    const answer = this.searcher.get_district_owner(id).then((res)=>{
      this.set_district_owner(id,res)
      return res
    })
    if(answer != undefined){
      return answer;
    }
    throw `district${id} not found`
  }


  set_plot_location = (x:number,z:number,plot:number,skip_mark_activity?:boolean) => {
    this.plot_location.set(plot,[x,z]);
    this.plot_location_reverse.put(x,z,plot);
    this.db.put_coord("pl", plot,[x,z]);
    if(skip_mark_activity !== true){
      this.mark_activity_plot(plot);
    }
  }

  set_plot_district = (origin:number,target:number,plot:number,skip_mark_activity?:boolean) => {
    this.plot_district.set(plot,target);
    this.district_plots.remove(origin,plot);
    this.district_plots.add(target,plot);
    this.db.put("pd", plot,target);
    if(skip_mark_activity !== true){
      this.mark_activity_district(target);
      this.mark_activity_plot(origin);
      this.mark_activity_plot(target);
    }
  }

  set_district_owner = (district:number,owner:string,skip_mark_activity?:boolean) =>{
    this.district_owner.set(district, owner);
    this.owner_district.set(owner,district);
    this.db.put_string("do", district, owner);
    if(skip_mark_activity !== true){
      this.mark_activity_district(district);
    }
  }

  mark_activity_district = (district:number) =>{
    this.activity.add(this.listener.blockNumber(),district)
    this.db.add_activity("ac",this.listener.blockNumber(),district)
  }
  mark_activity_plot = (plot:number) =>{
    if(!this.plot_location.has(plot)){
      this.force_get_plot(plot)
    }
  }

  async load(){
    const pl_map = await this.db.get_coord_map('pl');
    for(let [k,v] of pl_map.entries()){
      this.set_plot_location(v[0],v[1],k,true)
    }
    const do_map = await this.db.get_string_map('do');
    for(let [k,v] of do_map.entries()){
      this.set_district_owner(k,v,true)
    }
    const pd_map = await this.db.get_map('pd');
    for(let [k,v] of pd_map.entries()){
      this.set_plot_district(0,v,k,true)
    }
    this.activity = await this.db.get_activity_map('ac');

    await this.db.get("u",0).then((update_block)=>{
      this.last_update = update_block
    }).catch(()=>{})
  }

  cluster = (plotIds:Array<number>) =>{
    const plots = plotIds.filter((x)=>{return (this.plot_district.has(x) && x != 0)})
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
