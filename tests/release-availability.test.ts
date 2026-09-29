import {test} from 'node:test';
import assert from 'node:assert/strict';

import {isCardEligible} from '../packages/domain/release-availability';
test('P-163 promo is casual-only while OP-18 and EB-05 are fully playable',()=>{
 assert.equal(isCardEligible('P-163','P','ranked'),false);
 assert.equal(isCardEligible('P-163','P','casual'),true);
 assert.equal(isCardEligible('P-163','P','new-cards'),true);
 assert.equal(isCardEligible('P-163','P','extended'),true);
 assert.equal(isCardEligible('OP18-022','OP-18','casual'),true);
 assert.equal(isCardEligible('OP18-022','OP-18','ranked'),true);
 assert.equal(isCardEligible('OP18-001','OP-18','ranked'),true);
 assert.equal(isCardEligible('EB05-001','EB-05','casual'),true);
 assert.equal(isCardEligible('EB05-001','EB-05','ranked'),true);
});
