import {user, db, HttpError, errorResponse} from '@/lib/server/store';
import {supabaseAdmin, TCG_STORAGE_BUCKET} from '@/lib/server/supabase-storage';

export async function GET(req:Request){
  try{
    const p=await user();
    const instanceId=new URL(req.url).searchParams.get('instanceId')?.trim()??'';
    const owned=await db().prepare("SELECT id FROM collectible_instances WHERE id=? AND owner_id=? AND type='GRADED' AND deleted_at IS NULL").bind(instanceId,p.id).first();
    if(!owned)throw new HttpError(404,'Slab not found.');
    const photos=(await db().prepare('SELECT id,role FROM collectible_photos WHERE instance_id=? ORDER BY rowid DESC').bind(instanceId).all<{id:string;role:string}>()).results;
    return Response.json({photos},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error);}
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, 'Cross-site upload denied.');
    const p = await user();
    const supabase = supabaseAdmin();
    if (!supabase) throw new HttpError(503, 'Photo storage is unavailable.');
    if (Number(req.headers.get('content-length') || 0) > 6_000_000) throw new HttpError(413, 'Photos must be under 5 MB.');
    const form = await req.formData();
    const instanceId = String(form.get('instanceId'));
    const role = String(form.get('role'));
    const file = form.get('photo');
    if (!(file instanceof File) || file.size > 5_000_000 || file.size === 0 || !['front', 'back', 'label', 'additional'].includes(role)) {
      throw new HttpError(400, 'Choose a front, back, label, or additional photo under 5 MB.');
    }
    const owned = await db().prepare("SELECT id FROM collectible_instances WHERE id=? AND owner_id=? AND type='GRADED' AND deleted_at IS NULL").bind(instanceId, p.id).first();
    if (!owned) throw new HttpError(404, 'Slab not found.');
    const count = await db().prepare('SELECT COUNT(*) AS n FROM collectible_photos WHERE instance_id=?').bind(instanceId).first<{n: number}>();
    if ((count?.n || 0) >= 8) throw new HttpError(400, 'Maximum 8 photos per slab.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = bytes[0] === 255 && bytes[1] === 216
      ? 'image/jpeg'
      : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
        ? 'image/png'
        : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
          ? 'image/webp'
          : null;
    if (!mime) throw new HttpError(400, 'Only JPEG, PNG, and WebP images are accepted.');
    const id = crypto.randomUUID();
    const objectKey = `slabs/${p.id}/${instanceId}/${id}`;
    const {error: uploadError} = await supabase.storage.from(TCG_STORAGE_BUCKET).upload(objectKey, bytes, {contentType: mime, upsert: false});
    if (uploadError) throw new HttpError(503, 'Photo storage is unavailable.');
    try {
      await db().prepare('INSERT INTO collectible_photos (id,instance_id,object_key,role,mime) VALUES (?,?,?,?,?)').bind(id, instanceId, objectKey, role, mime).run();
    } catch (error) {
      await supabase.storage.from(TCG_STORAGE_BUCKET).remove([objectKey]);
      throw error;
    }
    return Response.json({id}, {status: 201});
  } catch (error) {
    return errorResponse(error);
  }
}
