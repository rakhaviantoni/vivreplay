import test from 'node:test';
import assert from 'node:assert/strict';
import {detectCardBounds} from '../lib/card-scan-detection';

function frame(width:number,height:number,card?:{x:number;y:number;width:number;height:number}){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const inside=card&&x>=card.x&&x<card.x+card.width&&y>=card.y&&y<card.y+card.height;
    const value=inside?238:42;
    const index=(y*width+x)*4;
    data[index]=value;data[index+1]=value;data[index+2]=value;data[index+3]=255;
  }
  return {data,width,height};
}

test('finds an offset card in a larger photo',()=>{
  const found=detectCardBounds(frame(280,360,{x:58,y:30,width:164,height:230}));
  assert.ok(found);
  assert.ok(Math.abs(found.x-58)<12);
  assert.ok(Math.abs(found.y-30)<12);
  assert.ok(Math.abs(found.width-164)<18);
  assert.ok(Math.abs(found.height-230)<20);
});

test('leaves a low-contrast photo on the existing crop fallback',()=>{
  assert.equal(detectCardBounds(frame(280,360)),null);
});

test('does not mistake a textured background for a card',()=>{
  const {width,height,data}=frame(280,360);
  let seed=1;
  for(let index=0;index<data.length;index+=4){
    seed=(seed*1664525+1013904223)>>>0;
    const value=seed>>>24;
    data[index]=value;data[index+1]=value;data[index+2]=value;
  }
  assert.equal(detectCardBounds({data,width,height}),null);
});
