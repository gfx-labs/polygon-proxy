import {KVStore} from "../interfaces/KVStore"
import level from "level-ts";
import {SetMap} from "../utils/SetMap";
export class level_store implements KVStore {
  db:level;

  constructor(location:string){
    this.db = new level(location);
  }

  put(t:string,k:number,v:number):void{
    this.db.put(t+"!"+k.toString(),v.toString())
  }

  put_string(t:string,k:number,v:string):void{
    this.db.put(t+"!"+k.toString(),v)
  }

  put_coord(t:string,k:number,v:[number,number]):void{
    this.db.put(t+"!"+k.toString(),v);
  }

  add_activity(t:string, k:number, v:number):void{
    this.db.put(t+"!"+k.toString()+"!"+v.toString(),1);
  }

  async get(t:string,k:number):Promise<number>{
    return this.db.get(t+"!"+k.toString()).then(v=>{return parseInt(v)})
  }
  async get_string(t:string,k:number):Promise<string>{
    return this.db.get(t+"!"+k.toString())

  }
  async get_coord(t:string,k:number):Promise<[number,number]>{
    return this.db.get(t+"!"+k.toString()).then(z=>{return [parseInt(z[0]),parseInt(z[1])]})
  }
  async get_map(t:string):Promise<Map<number,number>>{
    return this.db.stream({all:t+"!"}).then((res)=>{
      const output:Map<number,number> = new Map();
      for(const e of res){
        output.set(parseInt(e.key.split("!")[1]),parseInt(e.value));
      }
      return output
    })
  }
  async get_string_map(t:string):Promise<Map<number,string>>{
    return this.db.stream({all:t+"!"}).then((res)=>{
      const output:Map<number,string> = new Map();
      for(const e of res){
        output.set(parseInt(e.key.split("!")[1]),e.value.toString());
      }
      return output
    })
  }
  async get_coord_map(t:string):Promise<Map<number,[number,number]>>{
    return this.db.stream({all:t+"!"}).then((res)=>{
      const output:Map<number,[number,number]> = new Map();
      for(const e of res){
        output.set(parseInt(e.key.split("!")[1]),[parseInt(e.value[0]),parseInt(e.value[1])]);
      }
      return output
    })
  }

  async get_activity_map(t:string):Promise<SetMap<number,number>>{
    return this.db.stream({all:t+"!"}).then((res)=>{
      const output:SetMap<number,number> = new SetMap();
      for(const e of res){
        const split = e.key.split("!");
        if(parseInt(e.value) == 1){
          output.add(parseInt(split[1]),parseInt(split[2]))
        }
      }
      return output
    })
  }




}


