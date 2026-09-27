import {test} from 'node:test';
import assert from 'node:assert/strict';

import {isCardEligible} from '../packages/domain/release-availability';
test('P-163 is a preview-only casual card while incomplete sets remain deferred',()=>{
 assert.equal(isCardEligible('P-163','P','ranked'),false);
 assert.equal(isCardEligible('P-163','P','casual'),true);
 assert.equal(isCardEligible('P-163','P','new-cards'),true);
 assert.equal(isCardEligible('P-163','P','extended'),true);
 assert.equal(isCardEligible('OP18-022','OP18','casual'),false);
});
