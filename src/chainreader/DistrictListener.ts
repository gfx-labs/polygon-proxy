import {ethers} from "ethers"
import {ChainListener} from "./ChainListener"
import * as abis from "../abis"
import {Log} from "@ethersproject/providers"
import {Map2} from "../utils/Map2"
import {SetMap} from "../utils/SetMap"
import type {DistrictEmitter} from "./DistrictReader"
import Emittery from "emittery"
import {Indexed} from "ethers/lib/utils"

export class DistrictListener extends ChainListener{

  block_number: number;
  emitter:DistrictEmitter;
  url:string;

  last_alive:number;

  constructor(provider:ethers.providers.WebSocketProvider, emitter:DistrictEmitter){
    super(provider,abis.district,"0xc7b4cdf2c8ff3fc94d4f9f882d86ce824e0fb985")
    this.block_number = 18792700;
    this.hook()
    this.emitter = emitter
    this.url = provider.connection.url;
    this.last_alive = 0;
    setInterval(this.checkBlocks,1000*30)
  };

  hook = () => {
    this.provider.on(this.contract_object.filters.Transfer(),this.parse_TransferEvent)
    this.provider.on(this.contract_object.filters.PlotCreation(),this.parse_PlotCreateEvent)
    this.provider.on(this.contract_object.filters.PlotTransfer(),this.parse_PlotTransferEvent)
    this.provider.on("block",(bn)=>{
      this.emitter.emit("UpdateBlock",parseInt(bn.toString()))
    })
  }

  recover = () => {
    this.provider = new ethers.providers.WebSocketProvider(this.url)
    this.hook();
  }

  checkBlocks = async () =>{
    try{
      const current_block = await this.provider.getBlockNumber()
      if((current_block - this.block_number) < 1){
        this.recover();
        this.last_alive = current_block;
      }
    }catch(e){
      this.recover();
      this.last_alive = 0;
    }
  }

  parse_TransferEvent = (log:Log ) => {
    let decoded = log.topics;
    if(decoded !== undefined){
      const origin = decoded[1];
      const target = ethers.utils.getAddress(decoded[2].replace("0x000000000000000000000000","0x"))
      const id = parseInt(decoded[3].toString());
        this.emitter.emit("TransferEvent",[id,target]);
    }
    this.block_number = log.blockNumber;
  }

  parse_PlotTransferEvent = (log:Log) => {
    const decoded = this.contract_object.interface.decodeEventLog("PlotTransfer", log.data)
    if(decoded !== undefined){
      const origin = parseInt(decoded[0].toString());
      const target = parseInt(decoded[1].toString());
      const plot = parseInt(decoded[2].toString());
      this.emitter.emit("PlotTransferEvent",[origin,target,plot]);
    }
    this.block_number = log.blockNumber;
  }

  parse_PlotCreateEvent = (log:Log) => {
    const decoded = this.contract_object.interface.decodeEventLog("PlotCreation", log.data)
    if(decoded !== undefined){
      const x = parseInt(decoded[0].toString());
      const z = parseInt(decoded[1].toString());
      const id = parseInt(decoded[2].toString());
      this.emitter.emit("PlotCreateEvent",[x,z,id]);
      }
    this.block_number = log.blockNumber;
  }

  blockNumber = ():number =>{
    return this.provider.blockNumber;
  }
}
