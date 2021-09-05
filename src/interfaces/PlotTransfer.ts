import {ethers} from "ethers";


interface PlotTransfer {
  blockNumber:ethers.BigNumberish
  origin:ethers.BigNumberish
  target:ethers.BigNumberish
  plot:ethers.BigNumberish
}

export default PlotTransfer
