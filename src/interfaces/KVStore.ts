import {SetMap} from "../utils/SetMap";

export interface KVStore{

  put(t:string,k:number,v:number):void;
  put_string(t:string,k:number,v:string):void;
  put_coord(t:string,k:number,v:[number,number]):void;

  get(t:string,k:number):Promise<number>;
  get_string(t:string,k:number):Promise<string>;
  get_coord(t:string,k:number):Promise<[number,number]>;

  get_map(t:string):Promise<Map<number, number>>;
  get_string_map(t:string):Promise<Map<number, string>>;
  get_coord_map(t:string):Promise<Map<number,[number,number]>>


  add_activity(t:string,k:number,v:number):void;
  get_activity_map(t:string):Promise<SetMap<number,number>>
}
