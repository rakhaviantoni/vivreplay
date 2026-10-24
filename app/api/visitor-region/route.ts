export async function GET(request:Request){
  const country=(request as Request&{cf?:{country?:string}}).cf?.country;
  return Response.json({country:country&&/^[A-Z]{2}$/.test(country)?country:null},{headers:{'Cache-Control':'private, no-store'}});
}
