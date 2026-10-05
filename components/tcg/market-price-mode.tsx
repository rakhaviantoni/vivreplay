'use client';

export function MarketPriceMode({value,onChange,language}:{value:boolean;onChange:(next:boolean)=>void;language:'EN'|'ID'}){
  const id=language==='ID';
  return <fieldset className="market-price-mode">
    <legend>{id?'Ketentuan harga':'Price terms'}</legend>
    <div className="market-price-mode-options" role="group" aria-label={id?'Ketentuan harga':'Price terms'}>
      <button type="button" aria-pressed={value} className={value?'is-selected':''} onClick={()=>onChange(true)}>
        <strong>{id?'Bisa ditawar':'Negotiable'}</strong>
        <small>{id?'Pembeli dapat mengirim penawaran':'Buyers can send an offer'}</small>
      </button>
      <button type="button" aria-pressed={!value} className={!value?'is-selected':''} onClick={()=>onChange(false)}>
        <strong>{id?'Harga pas':'Firm price'}</strong>
        <small>{id?'Tidak menerima tawaran atau negosiasi':'No offers or counteroffers'}</small>
      </button>
    </div>
  </fieldset>;
}
