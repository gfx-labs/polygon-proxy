import {CLI} from "cliffy";
import {ethers} from "ethers";
import readline from "readline";


class MyCli extends CLI {

  constructor(delimiter:string){
    super({input:process.stdin,output:process.stdout})
    super.setDelimiter(delimiter)
  }
  log(...args:any){
    let display:any = [];
    for(const arg of args){
      if(ethers.utils.isAddress(arg)){
        display.push(arg)
      }else if(ethers.BigNumber.isBigNumber(arg)){
        display.push(ethers.BigNumber.from(arg).toString())
      }else{
        display.push(arg)
      }
    }
    console.log(...display);
  }

}


export const cli:MyCli = new MyCli("polygon_scanner>")

