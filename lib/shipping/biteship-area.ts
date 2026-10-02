export function isBiteshipAreaId(value:string|null|undefined):value is string{
  return typeof value==='string'&&/^ID[A-Z0-9]{6,}$/i.test(value.trim());
}

export function biteshipDestination(postalCode:string|null|undefined,areaId:string|null|undefined){
  const area=isBiteshipAreaId(areaId)?areaId.trim():null;
  const postal=typeof postalCode==='string'&&/^\d{5}$/.test(postalCode.trim())?Number(postalCode.trim()):undefined;
  return area?{areaId:area,postalCode:undefined}:{areaId:undefined,postalCode:postal};
}
