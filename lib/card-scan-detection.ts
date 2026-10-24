export type ScanBounds={x:number;y:number;width:number;height:number};

function luminance(data:Uint8ClampedArray,width:number,height:number,x:number,y:number){
  const px=Math.max(0,Math.min(width-1,x));
  const py=Math.max(0,Math.min(height-1,y));
  const index=(py*width+px)*4;
  return data[index]*.299+data[index+1]*.587+data[index+2]*.114;
}

export function detectCardBounds(image:{data:Uint8ClampedArray;width:number;height:number}):ScanBounds|null{
  const {data,width,height}=image;
  if(width<80||height<100)return null;
  const xDirection=new Int16Array(width*height);
  const yDirection=new Int16Array(width*height);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const index=y*width+x;
    xDirection[index]=luminance(data,width,height,x+1,y)-luminance(data,width,height,x-1,y);
    yDirection[index]=luminance(data,width,height,x,y+1)-luminance(data,width,height,x,y-1);
  }
  const nearEdge=(directions:Int16Array,base:number,stride:number)=>{
    let best=0;
    for(const offset of [-4,-3,-2,-1,0,1,2,3,4]){
      const value=directions[base+stride*offset]??0;
      if(Math.abs(value)>Math.abs(best))best=value;
    }
    return best;
  };
  let best:ScanBounds|null=null;
  let bestScore=0;
  const ratios=[.60,.64,.68,.714,.75];
  const sampleCount=28;

  for(let widthFraction=.42;widthFraction<=.98;widthFraction+=.04){
    const boxWidth=Math.round(width*widthFraction);
    for(const ratio of ratios){
      const boxHeight=Math.round(boxWidth/ratio);
      if(boxHeight>height*.98)continue;
      const stepX=Math.max(2,Math.round(boxWidth*.025));
      const stepY=Math.max(2,Math.round(boxHeight*.025));
      for(let y=Math.max(2,Math.round(height*.01));y<=height-boxHeight-2;y+=stepY){
        for(let x=Math.max(2,Math.round(width*.01));x<=width-boxWidth-2;x+=stepX){
          let total=0,hits=0;
          const edgeHits=[0,0,0,0];
          const edgeDirections=[0,0,0,0];
          const edgeStrengths=[0,0,0,0];
          for(let sample=0;sample<sampleCount;sample++){
            const along=.08+.84*(sample/(sampleCount-1));
            const px=Math.round(x+boxWidth*along);
            const py=Math.round(y+boxHeight*along);
            const edges=[
              nearEdge(yDirection,y*width+px,width),
              nearEdge(yDirection,(y+boxHeight)*width+px,width),
              nearEdge(xDirection,py*width+x,1),
              nearEdge(xDirection,py*width+x+boxWidth,1),
            ];
            for(const [side,direction] of edges.entries()){
              const edge=Math.abs(direction);
              total+=edge;
              edgeDirections[side]+=direction;
              edgeStrengths[side]+=edge;
              if(edge>=22){hits++;edgeHits[side]++;}
            }
          }
          const support=hits/(sampleCount*4);
          if(edgeHits.some((edgeSupport,side)=>edgeSupport<sampleCount*.35||Math.abs(edgeDirections[side])/Math.max(1,edgeStrengths[side])<.45))continue;
          const mean=total/(sampleCount*4);
          const score=mean+support*28;
          if(support>=.42&&score>bestScore){
            bestScore=score;
            const padX=Math.round(boxWidth*.012);
            const padY=Math.round(boxHeight*.012);
            const left=Math.max(0,x-padX);
            const top=Math.max(0,y-padY);
            const right=Math.min(width,x+boxWidth+padX);
            const bottom=Math.min(height,y+boxHeight+padY);
            best={x:left,y:top,width:right-left,height:bottom-top};
          }
        }
      }
    }
  }
  return bestScore>=38?best:null;
}
