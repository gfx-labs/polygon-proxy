import {SetMap} from "../utils/SetMap"


export interface DistrictState {
  plot_location:Map<number,[number,number]>
  district_owner:Map<number,string>
  plot_district:Map<number,number>

  block_number:number;
}
