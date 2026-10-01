import {db} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type Row={id:string;actor_id:string|null;actor_subject:string|null;actor_email:string|null;ip_address:string|null;user_agent:string|null;locale:string;model:string;question:string;leader_code:string|null;deck_size:number;candidate_count:number;response_text:string|null;status:string;error_code:string|null;duration_ms:number;created_at:string};

export async function GET(){if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});try{const rows=(await db().prepare('SELECT * FROM ai_coach_requests ORDER BY created_at DESC LIMIT 250').all<Row>()).results;return Response.json({requests:rows});}catch{return Response.json({error:'AI Coach audit records are unavailable. Apply the latest D1 migration.'},{status:503});}}
