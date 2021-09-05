import {ethers} from "ethers";


interface DistrictTransfer {
  blockNumber:ethers.BigNumberish;
  origin:string;
  target:string;
  district:ethers.BigNumberish;
}

export default DistrictTransfer;
