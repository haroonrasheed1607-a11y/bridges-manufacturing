import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('responsive labeling leaves printable timesheet tables intact',()=>{
 let effect;
 const make=paper=>{const classes=new Set(['mobile-cards']);const cell={dataset:{label:'old'},removeAttribute(){delete this.dataset.label;}};return {classes,cell,closest:()=>paper?{}:null,classList:{remove:c=>classes.delete(c),add:c=>classes.add(c),contains:c=>classes.has(c)},querySelectorAll:selector=>selector==='thead th'?[{textContent:'Monday'},{textContent:'Tuesday'},{textContent:'Wednesday'}]:selector==='[data-label]'?[cell]:[{cells:[cell]}]};};
 const report=make(true),register=make(false);
 const source=fs.readFileSync(new URL('../src/components/common/ResponsiveTables.js',import.meta.url),'utf8').replace(/import[^\n]+\n/,'').replace('export { ResponsiveTables };','ResponsiveTables();');
 vm.runInNewContext(source,{React:{useEffect:fn=>effect=fn},document:{getElementById:()=>({querySelectorAll:()=>[report,register]})},MutationObserver:class{observe(){}disconnect(){}}});effect();
 assert.equal(report.classes.has('mobile-cards'),false);assert.equal(report.cell.dataset.label,undefined);assert.equal(register.classes.has('mobile-cards'),true);assert.equal(register.cell.dataset.label,'Monday');
});
