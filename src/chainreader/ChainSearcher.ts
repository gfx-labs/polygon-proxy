import {ethers} from "ethers";

export class ChainSearcher {

  provider:ethers.providers.BaseProvider;
  contract_object:ethers.Contract;

  constructor(provider:ethers.providers.BaseProvider, abi:any, contract_address:string){
    this.provider = provider;
    this.contract_object = new ethers.Contract(contract_address, abi,this.provider);
  }

  call_contract = async <T>(method:string,parser:(args:any)=>T,...args:any):Promise<T> => {
    if(this.contract_object[method] !== undefined){
      return this.contract_object[method](...args).then((result:any)=>{
        return parser(result);
      })
    }
    throw `method ${method} does not exist in contract ${this.contract_object.address}`
  }
}
