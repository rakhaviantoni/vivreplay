import test from 'node:test';
import assert from 'node:assert/strict';
import {detectCardScanGame,detectPokemonScanLanguage,parseOnePieceScanCode,parsePokemonScanCode} from '../lib/card-scan-parser';
import {deduplicateScanCandidates} from '../lib/card-scan-candidates';

test('removes repeated catalog rows while keeping language and art printings',()=>{
  const rows=[
    {game:'one-piece',setCode:'OP-08',cardNumber:'OP08-020',language:'EN',variant:'Standard',id:'set-en'},
    {game:'one-piece',setCode:'OP08',cardNumber:'OP08-020',language:'EN',variant:'Standard',id:'promo-en'},
    {game:'one-piece',setCode:'OP08',cardNumber:'OP08-020',language:'JP',variant:'Standard',id:'set-jp'},
    {game:'one-piece',setCode:'OP08',cardNumber:'OP08-020_p1',language:'JP',variant:'Alt art',id:'alt-jp'},
  ];
  assert.deepEqual(deduplicateScanCandidates(rows).map(row=>row.id),['set-en','set-jp','alt-jp']);
});

test('uses a clear One Piece code even when scanning from the Pokémon view',()=>{
  const text=`your hand. Then place the rest at the bottom of your deck in any order.\nCHARACTER Zoro-Juurou Straw Hat Crew\nE2ST18-004\nOn Play Look at 5 cards from the top of your deck; reveal up to 1 purple Straw Hat Crew type card and add it to your hand.`;
  assert.equal(detectCardScanGame(text,'pokemon'),'one-piece');
  assert.deepEqual(parseOnePieceScanCode(text),{
    setCode:'ST18',cardNumber:'ST18-004',rarity:'SP',variant:'SP',
  });
});

test('reads One Piece SP marker, card code, and rarity when OCR joins them',()=>{
  assert.deepEqual(parseOnePieceScanCode('SPST18-005SR'),{
    setCode:'ST18',cardNumber:'ST18-005',rarity:'SR',variant:'SP',
  });
});

test('reads separated or hyphenated One Piece footer text',()=>{
  for(const text of ['SP ST-18-005 SR','SPST-18-005SR']){
    assert.deepEqual(parseOnePieceScanCode(text),{
      setCode:'ST18',cardNumber:'ST18-005',rarity:'SR',variant:'SP',
    });
  }
});

test('recovers SP when OCR reads its letters as E2',()=>{
  assert.deepEqual(parseOnePieceScanCode('E2/ST18-005SR'),{
    setCode:'ST18',cardNumber:'ST18-005',rarity:'SR',variant:'SP',
  });
});

test('reads Pokémon set, printed number, and rarity from noisy footer OCR',()=>{
  const text=`pada giliran pertama\nPemain Kedua, jumlah kartu yang\ndiambil menjadi 8 lembar.\nG Sv3s1\n226/170 SAR\n2023 Pokemon/Nintendo/Creatures/GAME FREAK`;
  assert.deepEqual(parsePokemonScanCode(text),{
    setCodeCandidates:['SV3S','SV3S1'],cardNumber:'226',cardNumberTotal:'170',rarity:'SAR',language:'ID',
  });
});

test('keeps a clean Pokémon set code and reads slash-form card numbers',()=>{
  assert.deepEqual(parsePokemonScanCode('SV3S 226/170 SAR'),{
    setCodeCandidates:['SV3S'],cardNumber:'226',cardNumberTotal:'170',rarity:'SAR',language:'',
  });
});

test('corrects OCR noise after the printed PAL set code',()=>{
  assert.deepEqual(parsePokemonScanCode('PAL1NG 226/193 SAR'),{
    setCodeCandidates:['PAL'],cardNumber:'226',cardNumberTotal:'193',rarity:'SAR',language:'',
  });
});

test('recognizes Indonesian Tactics Deck set codes without digits',()=>{
  assert.deepEqual(parsePokemonScanCode('MATS 008/023'),{
    setCodeCandidates:['MATS'],cardNumber:'008',cardNumberTotal:'023',rarity:'',language:'',
  });
  assert.deepEqual(parsePokemonScanCode('MATS008/023'),{
    setCodeCandidates:['MATS'],cardNumber:'008',cardNumberTotal:'023',rarity:'',language:'',
  });
});

test('keeps a weak PAL read and its printed count available for catalog validation',()=>{
  assert.deepEqual(parsePokemonScanCode('PAL 008/071'),{
    setCodeCandidates:['PAL'],cardNumber:'008',cardNumberTotal:'071',rarity:'',language:'',
  });
});

test('reads a Japanese Keldeo SAR footer and ignores the ex suffix',()=>{
  assert.deepEqual(parsePokemonScanCode('sv11w ケルディオex 169/086 SAR'),{
    setCodeCandidates:['SV11W'],cardNumber:'169',cardNumberTotal:'086',rarity:'SAR',language:'JP',
  });
});

test('splits a set code and number when OCR joins them together',()=>{
  assert.deepEqual(parsePokemonScanCode('SV11W169/086 SAR'),{
    setCodeCandidates:['SV11W'],cardNumber:'169',cardNumberTotal:'086',rarity:'SAR',language:'',
  });
});

test('keeps the printed number when OCR damages the denominator',()=>{
  assert.deepEqual(parsePokemonScanCode('SV11W 169/08G SAR'),{
    setCodeCandidates:['SV11W'],cardNumber:'169',cardNumberTotal:'',rarity:'SAR',language:'',
  });
});

test('corrects OCR-confused set digits and reads rarity attached to the denominator',()=>{
  assert.deepEqual(parsePokemonScanCode('このワザのダメージ SvIIW 169/086SAR G512'),{
    setCodeCandidates:['SV11W'],cardNumber:'169',cardNumberTotal:'086',rarity:'SAR',language:'JP',
  });
});

test('recovers a Japanese set code when OCR confuses S6a with S601',()=>{
  const text=`Pilar Berpilar\nUbah kondisi Pokemon Bertarung lawan\n5601\n073/069 SR\ns601 E073/069 SR\nPSA 10`;
  assert.deepEqual(parsePokemonScanCode(text),{
    setCodeCandidates:['S6A'],cardNumber:'073',cardNumberTotal:'069',rarity:'SR',language:'ID',
  });
});

test('does not treat an unreadable set fragment as a trusted Pokémon set code',()=>{
  assert.deepEqual(parsePokemonScanCode('I20 073/069 SR'),{
    setCodeCandidates:[],cardNumber:'073',cardNumberTotal:'069',rarity:'SR',language:'',
  });
});

test('detects Indonesian and Japanese card text from OCR',()=>{
  assert.equal(detectPokemonScanLanguage('Pemain lawan mengambil Kartu Point'), 'ID');
  assert.equal(detectPokemonScanLanguage('相手のポケモン'), 'JP');
});
