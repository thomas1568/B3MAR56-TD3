import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocationSession } from '../memoria/location-session.js';
function fixture() {
  const requests=[], watches=[], cleared=[], positions=[], errors=[];
  const geolocation={
    getCurrentPosition(success,error,options){requests.push({success,error,options});},
    watchPosition(success,error,options){watches.push({success,error,options});return watches.length;},
    clearWatch(id){cleared.push(id);}
  };
  const session=createLocationSession({geolocation,onPosition:p=>positions.push(p),onError:e=>errors.push(e)});
  return {session,geolocation,requests,watches,cleared,positions,errors};
}
test('each click requests a fresh position before starting exactly one watch',()=>{
  const f=fixture();f.session.start();assert.equal(f.requests.length,1);assert.equal(f.watches.length,0);
  assert.equal(f.requests[0].options.maximumAge,0);
  f.requests[0].success('first');assert.equal(f.watches.length,1);
  f.watches[0].success('next');assert.deepEqual(f.positions,['first','next']);
  f.session.stop();assert.deepEqual(f.cleared,[1]);assert.equal(f.session.active,false);
});
test('denial then permission granted retries with a new request without cached permission state',()=>{
  const f=fixture();f.session.start();f.requests[0].error({code:1});
  assert.equal(f.session.active,false);assert.equal(f.watches.length,0);
  f.session.start();f.requests[1].success('allowed');
  assert.equal(f.session.active,true);assert.equal(f.watches.length,1);assert.deepEqual(f.positions,['allowed']);
});
test('stop or background pause ignores a late initial result and cannot resurrect tracking',()=>{
  const f=fixture();f.session.start();f.session.stop();f.requests[0].success('late');
  assert.equal(f.watches.length,0);assert.deepEqual(f.positions,[]);
});
test('old request and watch callbacks cannot affect a restarted session',()=>{
  const f=fixture();f.session.start();f.requests[0].success('first');f.session.start();
  f.watches[0].error({code:1});f.watches[0].success('old');f.requests[1].success('new');
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.positions,['first','new']);assert.equal(f.session.active,true);
});
test('timeout and unavailable stay distinct from denial, can be retried',()=>{
  for(const code of [2,3]){
    const f=fixture();f.session.start();f.requests[0].error({code});
    assert.equal(f.errors[0].code,code);assert.equal(f.session.active,false);
    f.session.start();f.requests[1].success('recovered');assert.equal(f.watches.length,1);
  }
});
test('synchronous browser failure cannot leak a watcher',()=>{
  const f=fixture();f.geolocation.getCurrentPosition=success=>success('first');
  f.geolocation.watchPosition=(success,error)=>{error({code:1});return 27;};
  f.session.start();assert.equal(f.session.active,false);assert.deepEqual(f.cleared,[27]);
  f.geolocation.getCurrentPosition=()=>{throw new DOMException('Blocked','SecurityError');};
  f.session.start();assert.equal(f.errors.at(-1).code,1);
});
