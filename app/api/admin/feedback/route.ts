import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type Feedback={id:string;category:string;summary:string;details:string;card_code:string|null;printing_id:string|null;listing_id:string|null;page_path:string;contact_email:string|null;status:string;created_at:string};
export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{const reports=(await db().prepare('SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 250').all<Feedback>()).results;return Response.json({reports},{headers:{'Cache-Control':'private, no-store'}})}catch(error){return errorResponse(error)}
}
