import {DurableObject} from 'cloudflare:workers';

type Seat = 'host' | 'guest';
type RoomPhase = 'lobby' | 'mulligan' | 'main' | 'finished';
type Ticket = {roomId:string;playerId:string;name:string;expiresAt:number};
type Move = {type:'ready'|'mulligan'|'play'|'attack'|'counter'|'end-turn'|'concede';payload?:Record<string,unknown>};
type RoomEvent = {id:number;at:number;seat:Seat;playerId:string;move:Move};
type RoomState = {roomId:string;phase:RoomPhase;turn:Seat;seats:Partial<Record<Seat,{playerId:string;name:string}>>;events:RoomEvent[];revision:number};
type ArenaEnv = {ARENA_ROOM:DurableObjectNamespace;ARENA_TICKET_SECRET:string};

const encoder = new TextEncoder();
const json = (value:unknown, status=200) => Response.json(value,{status,headers:{'cache-control':'no-store'}});
const base64Url = (value:Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decodeBase64Url = (value:string) => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),char => char.charCodeAt(0));

async function verifyTicket(raw:string|undefined, secret:string, roomId:string):Promise<Ticket|null>{
  if(!raw?.includes('.')) return null;
  const [encoded,signature] = raw.split('.');
  if(!encoded||!signature) return null;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(encoded)));
  const actual=decodeBase64Url(signature);
  if(actual.byteLength!==expected.byteLength||!actual.every((byte,index)=>byte===expected[index])) return null;
  try { const ticket=JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as Ticket; return ticket.roomId===roomId&&ticket.expiresAt>Date.now()?ticket:null; } catch { return null; }
}

export class ArenaRoom extends DurableObject<ArenaEnv>{
  private room?:RoomState;
  constructor(ctx:DurableObjectState,env:ArenaEnv){super(ctx,env);}
  private async state(){ if(!this.room){this.room=await this.ctx.storage.get<RoomState>('room')??{roomId:this.ctx.id.toString(),phase:'lobby',turn:'host',seats:{},events:[],revision:0};} return this.room; }
  private async save(){if(this.room)await this.ctx.storage.put('room',this.room);}
  private broadcast(message:unknown){const data=JSON.stringify(message);for(const socket of this.ctx.getWebSockets())socket.send(data);}
  private async publish(){const room=await this.state();this.broadcast({type:'snapshot',room:{phase:room.phase,turn:room.turn,seats:room.seats,events:room.events.slice(-24),revision:room.revision}});}
  private seatFor(room:RoomState,playerId:string):Seat|undefined{return (Object.entries(room.seats) as Array<[Seat,{playerId:string}]>) .find(([,player])=>player.playerId===playerId)?.[0];}
  private async join(ticket:Ticket):Promise<{seat:Seat;room:RoomState}|{error:string}>{
    const room=await this.state();room.roomId=ticket.roomId;
    const present=this.seatFor(room,ticket.playerId);if(present)return {seat:present,room};
    const seat:Seat=!room.seats.host?'host':!room.seats.guest?'guest':null as never;
    if(!seat)return {error:'This room already has two players.'};
    room.seats[seat]={playerId:ticket.playerId,name:ticket.name};room.revision+=1;await this.save();return {seat,room};
  }
  async fetch(request:Request):Promise<Response>{
    if(request.headers.get('Upgrade')!=='websocket')return json({error:'WebSocket upgrade required.'},426);
    const url=new URL(request.url);const roomId=url.pathname.split('/').filter(Boolean).pop();
    if(!roomId||!/^[-a-zA-Z0-9_]{6,80}$/.test(roomId))return json({error:'Invalid room.'},400);
    const ticket=await verifyTicket(url.searchParams.get('ticket')??undefined,this.env.ARENA_TICKET_SECRET,roomId);
    if(!ticket)return json({error:'A valid Arena ticket is required.'},401);
    const joined=await this.join(ticket);if('error' in joined)return json({error:joined.error},409);
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    server.serializeAttachment({playerId:ticket.playerId,seat:joined.seat});this.ctx.acceptWebSocket(server,[joined.seat]);
    server.send(JSON.stringify({type:'joined',seat:joined.seat,room:{phase:joined.room.phase,turn:joined.room.turn,seats:joined.room.seats,events:joined.room.events.slice(-24),revision:joined.room.revision}}));
    await this.publish();return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(socket:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>12_000)return;
    const attachment=socket.deserializeAttachment() as {playerId:string;seat:Seat}|null;if(!attachment)return;
    let move:Move;try{move=JSON.parse(message) as Move}catch{return;}
    if(!['ready','mulligan','play','attack','counter','end-turn','concede'].includes(move.type))return;
    const room=await this.state();const seat=this.seatFor(room,attachment.playerId);if(!seat||seat!==attachment.seat)return;
    if(move.type==='ready'&&room.phase==='lobby'&&room.seats.host&&room.seats.guest)room.phase='mulligan';
    if(move.type==='mulligan'&&room.phase==='mulligan')room.phase='main';
    if(['play','attack','counter','end-turn'].includes(move.type)&&(room.phase!=='main'||room.turn!==seat))return;
    if(move.type==='end-turn')room.turn=seat==='host'?'guest':'host';
    if(move.type==='concede')room.phase='finished';
    room.revision+=1;room.events.push({id:room.revision,at:Date.now(),seat,playerId:attachment.playerId,move});room.events=room.events.slice(-120);await this.save();await this.publish();
  }
  async webSocketClose(socket:WebSocket){socket.close(1000,'Room connection closed');}
}

export default {async fetch(request:Request,env:ArenaEnv){const url=new URL(request.url);if(url.pathname==='/health')return json({ok:true});const roomId=url.pathname.match(/^\/rooms\/([-a-zA-Z0-9_]{6,80})$/)?.[1];if(!roomId)return json({error:'Not found.'},404);return env.ARENA_ROOM.getByName(roomId).fetch(request);}} satisfies ExportedHandler<ArenaEnv>;
