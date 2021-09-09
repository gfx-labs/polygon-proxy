export class Map2<A,B,C> extends Map<A,Map<B,C>> {
  constructor(){
    super();
  }

  put = (k1:A,k2:B,v:C) =>{
    if(!super.has(k1)){
      super.set(k1,new Map());
    }
    (super.get(k1) as Map<B,C>).set(k2,v)
  }

  getDefault = (k1:A, k2:B, def?:C): C | undefined =>{
    if(!super.has(k1)){
      return def;
    }
    if(!(super.get(k1) as Map<B,C>).has(k2)){
      return def;
    }
    return (super.get(k1) as Map<B,C>).get(k2) as C;
  }

}
