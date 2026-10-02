import {env} from 'cloudflare:workers';

type TurnstileResult={success?:boolean;hostname?:string;action?:string};

export async function verifyTurnstile(request:Request):Promise<Response|null>{
  const runtimeEnv=env as Cloudflare.Env;
  const secret=runtimeEnv.TURNSTILE_SECRET_KEY?.trim();
  // Local and preview environments can run without a widget until keys are configured.
  if(!secret)return null;

  const token=request.headers.get('cf-turnstile-response')?.trim()??'';
  if(!token||token.length>2048){
    return Response.json({error:'Complete the security check and try again.'},{status:403});
  }

  try{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        secret,
        response:token,
        remoteip:request.headers.get('cf-connecting-ip')??undefined,
        idempotency_key:crypto.randomUUID(),
      }),
    });
    const result=await response.json() as TurnstileResult;
    if(response.ok&&result.success)return null;
  }catch{
    // Fail closed when verification is configured but Cloudflare cannot be reached.
  }
  return Response.json({error:'The security check expired or could not be verified. Please try again.'},{status:403});
}
