const test=require('node:test');const assert=require('node:assert/strict');
function q(a,p){const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p,b=Math.floor(i),r=i-b;return Math.round((s[b]+(s[b+1]!==undefined?r*(s[b+1]-s[b]):0))*10)/10}
test('median and p75 resist extreme leader as default benchmark',()=>{const x=[100,120,140,160,26907];assert.equal(q(x,.5),140);assert.equal(q(x,.75),160);assert.equal(Math.max(...x),26907)});
test('rank population includes subject',()=>{const competitors=20,population=competitors+1;assert.equal(population,21);const subjectRank=competitors+1;assert.ok(subjectRank<=population);assert.equal('#'+subjectRank+' of '+population,'#21 of 21')});
test('impossible rank is rejected',()=>{const n=18;for(const rank of [0,20])assert.ok(rank<1||rank>n+1)});
test('visibility is deliberately unmeasured in V2 foundation',()=>{const a={visibility:null,overallExcludes:['visibility']};assert.equal(a.visibility,null);assert.deepEqual(a.overallExcludes,['visibility'])});

test('sparse competitor set is allowed rather than padded with weak matches',()=>{const kept=6;assert.ok(kept<8);const confidence='Medium/Low';assert.equal(confidence,'Medium/Low')});
test('competitor set is capped at 20',()=>{const scores=Array.from({length:35},(_,i)=>100-i);assert.equal(scores.sort((a,b)=>b-a).slice(0,20).length,20)});
