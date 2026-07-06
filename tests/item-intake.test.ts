import assert from 'node:assert/strict';
import test from 'node:test';
import { itemIntakeService } from '../packages/domain/src/index.ts';

test('photo-first intake returns a reviewable draft and optional valuation',async()=>{
  const result=await itemIntakeService.analyze({photoUri:'file:///demo.jpg',location:'Garage'},true);
  assert.equal(result.draft.location,'Garage');
  assert.ok(result.draft.make&&result.draft.model);
  assert.equal(result.needsSerialVerification,true);
  assert.equal(result.fieldConfidence.serialNumber,'low');
  assert.ok(result.valuation?.comparableListings.length);
});
