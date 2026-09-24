import {createClient} from '@supabase/supabase-js';
import {parseEffects} from '../packages/domain/effect-rules';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const manual='https://en.onepiece-cardgame.com/pdf/rule_manual.pdf';
const cardList='https://en.onepiece-cardgame.com/cardlist/';
const rules={
 setup:{leader:1,mainDeck:50,maxCopiesPerCardNumber:4,openingHand:5,mulligan:{allowed:true,oncePerPlayer:true,returnAll:true,redraw:5},life:{fromTopOfDeck:true,faceDown:true,count:'leader.life'}},
 zones:{characterLimit:5,stageLimit:1,donDeck:10,donDeckException:'leader card text takes precedence'},
 turn:{phases:['refresh','draw','don','main','end'],refresh:{readyRestedCards:true,returnAttachedDonToCostArea:true},draw:{count:1,firstPlayerFirstTurn:0},don:{count:2,firstPlayerFirstTurn:1}},
 main:{play:['character','stage','event'],attachDon:{powerPerDon:1000},attack:{attacker:['leader','character'],targets:['opponent-leader','rested-opponent-character']}},
 battle:{leaderWin:'attacker power > defender power',characterKOs:'equal or greater power K.O.s each non-Leader Character',leaderDamage:1,trigger:'optional reveal and resolve instead of adding Life card to hand'},
 precedence:'card text overrides this ruleset',
 source:{manual,version:'1.11'}
};
const {data:ruleset,error:rulesetError}=await db.from('tcg_rulesets').upsert({code:'opcg-official-v1.11',title:'ONE PIECE Card Game Official Rule Manual',rules_revision:'1.11',effective_from:'2026-09-24',source_url:manual,status:'published',rules},{onConflict:'code'}).select('id').single();
if(rulesetError)throw rulesetError;
const pageSize=1000;
let from=0,total=0;
for(;;){
 const {data,error}=await db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+pageSize-1);
 if(error)throw error;
 if(!data?.length)break;
 const revisions=data.map(row=>({ruleset_id:ruleset.id,identity_id:row.id,effect_text:row.effect_text??'',effect_schema:parseEffects({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text??''}),errata_reference:null,source_url:cardList}));
 const {error:revisionError}=await db.from('tcg_card_rule_revisions').upsert(revisions,{onConflict:'ruleset_id,identity_id'});
 if(revisionError)throw revisionError;
 total+=revisions.length;
 if(data.length<pageSize)break;
 from+=pageSize;
}
console.log(JSON.stringify({rulesetId:ruleset.id,cardRuleRevisions:total}));
