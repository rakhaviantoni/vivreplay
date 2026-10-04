import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type Feedback={id:string;category:string;summary:string;details:string;card_code:string|null;printing_id:string|null;listing_id:string|null;page_path:string;contact_email:string|null;status:string;created_at:string};
export async function GET(){
  try{
    if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
    const reports=(await db().prepare('SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 250').all<Feedback>()).results;
    return Response.json({reports},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('admin_feedback_load_failed',error instanceof Error?error.message:'unknown error');
    const response=errorResponse(error);
    if(response.status===500)return Response.json({error:'Feedback could not be loaded. Refresh and try again.'},{status:500,headers:{'Cache-Control':'no-store'}});
    return response;
  }
}
