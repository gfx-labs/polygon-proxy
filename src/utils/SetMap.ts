export class SetMap<A,B> extends Map<A,Set<B>> {

  constructor(){
    super();
  }
  add = (k:A,v:B) =>{
    let s = super.get(k)
    if(s == undefined){
      super.set(k, new Set([v]));
    }else{
      s.add(v);
    }
  }
  remove = (k:A,v:B) =>{
    let s = super.get(k)
    if(s == undefined){
      super.set(k, new Set([v]));
    }else{
      s.delete(v);
    }
  }
  remove_all = (k:A) => {
    super.set(k,new Set());
  }
}
