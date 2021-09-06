
export const scanaround =
  (plot:string,
   cluster:number,
   plots:Array<string>, pairs:Map<string,[number,number]>,
   keyed:Map<number,Map<number, string>>, clustered:Map<string,number>
  ):Map<string,number> => {
    const found = []
    const entry = pairs.get(plot)

    if(entry !== undefined){
      const x = entry[0];
      const z = entry[1];
      for(let i = -1; i <= 1; i++){
        for(let j = -1; j <= 1; j++){
          const l1 = keyed.get(x+i)
          if(l1 !== undefined){
            const checked_id = l1.get(z+j);
            if(checked_id !== undefined){
              if(!clustered.has(checked_id)){
                found.push(checked_id)
              }
            }
          }
        }
      }

      for(const checked_id of found.values()){
        clustered.set(plot,cluster)
        clustered.set(checked_id,cluster)
        scanaround(checked_id,cluster,plots,pairs,keyed,clustered);
      }
      if(found.length == 1 || found.length == 0){
        clustered.set(plot,cluster)
      }
    }
    return clustered;
  }
