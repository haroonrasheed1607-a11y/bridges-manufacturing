import {remainingBoxPieces} from './boxSetupModel.js';
export function bulkBoxPlan(work,job,personIds){
 const ids=[...new Set(personIds)];const pack=Number(work.perPack);let remaining=remainingBoxPieces(work,job);
 if(!ids.length||ids.length>100)throw Error('Select 1–100 individuals.');
 if(!Number.isSafeInteger(pack)||pack<1)throw Error('Set a valid pieces-per-pack value on the work order.');
 if(ids.length>Math.ceil(remaining/pack))throw Error('Not enough unallocated pieces for every selected individual.');
 return ids.map(personId=>{const quantity=Math.min(pack,remaining);remaining-=quantity;return {personId,quantity};});
}
