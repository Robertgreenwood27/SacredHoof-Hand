// No network calls: exercise the real cron handler against in-memory storage
// and a stub mail transport. TypeScript is already a project dev dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
process.env.NEXT_PUBLIC_SITE_URL = 'https://sacredhoofandhand.com';
process.env.PRACTITIONER_EMAIL = 'shelby@example.com';
process.env.RESEND_API_KEY = 're_test_only';
process.env.CRON_SECRET = 'test-secret';
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const originalLoad = Module._load;
let rows = [], sent = [], fail = false, race = false;
function query(table) {
  const filters = []; let patch;
  const q = {
    select() { return q; }, order() { return q; }, limit() { return q; },
    update(value) { patch = value; return q; },
    insert() { return Promise.resolve({error:null}); },
    eq(k,v) { filters.push(r=>r[k]===v); return q; },
    in(k,v) { filters.push(r=>v.includes(r[k])); return q; },
    is(k,v) { filters.push(r=>(r[k]??null)===v); return q; },
    not(k,op,v) { filters.push(r=>(r[k]??null)!==v); return q; },
    gte(k,v) { filters.push(r=>r[k]>=v); return q; },
    lt(k,v) { filters.push(r=>r[k]<v); return q; },
    or(expr) { filters.push(r=>expr.split(',').some(part=>{
      const [key,op,...values]=part.split('.');
      return op==='is' ? r[key]==null : r[key]<values.join('.');
    })); return q; },
    run(single=false) {
      const result = rows.filter(r=>filters.every(f=>f(r)));
      if(patch) result.forEach(r=>Object.assign(r,patch));
      const data=result.map(r=>({...r}));
      if(race && patch?.followup_claimed_at && result[0]) result[0].status='cancelled';
      return {data:single?(data[0]??null):data,error:null};
    },
    maybeSingle() { return Promise.resolve(q.run(true)); },
    then(resolve,reject) { return Promise.resolve(q.run()).then(resolve,reject); },
  }; return q;
}
Module._load = function(request,parent,isMain) {
  if(request==='@/lib/supabase/server') return {createSupabaseAdminClient:()=>({from:query})};
  if(request==='@/lib/booking') return {expirePendingBookingHolds:async()=>{}};
  if(request==='@/lib/email') return {
    sendFollowUpEmail:async a=>{if(!fail)sent.push(['followup',a.appointment_id]);return {clientSent:!fail,practitionerSent:true};},
    sendReminderEmails:async(a,r)=>{if(!fail)sent.push(['reminder',a.appointment_id,r]);return {clientSent:!fail,practitionerSent:!fail};},
  };
  if(request.startsWith('@/')) request=path.join(root,'src',request.slice(2));
  return originalLoad.call(this,request,parent,isMain);
};
const {notificationWindows}=require('../src/lib/notification-windows.ts');
const {buildBookingEmails,buildReminderEmails,buildFollowUpEmail}=require('../src/lib/email.ts');
const {GET}=require('../src/app/api/cron/reminders/route.ts');
function fixture(id,status='confirmed',ends_at) {
  const w=notificationWindows(new Date());
  return {id,status,client_name:'<script>Client</script>',client_email:'client@example.com',
    service_name:'Reiki',service_id:'reiki-60',amount_cents:5500,notes:null,client_timezone:'America/Denver',
    starts_at:new Date(Date.parse(ends_at??w.followUpFrom)+3600000).toISOString(),
    ends_at:ends_at??new Date(Date.parse(w.followUpFrom)+7200000).toISOString()};
}
const run=()=>GET(new Request('https://example.com/api/cron/reminders',{headers:{authorization:'Bearer test-secret'}}));
test('Mountain calendar windows handle spring and autumn DST',()=>{
  const spring=notificationWindows(new Date('2026-03-10T13:00:00Z'));
  assert.equal(spring.followUpFrom,'2026-03-08T07:00:00.000Z');
  assert.equal(spring.followUpTo,'2026-03-09T06:00:00.000Z');
  const fall=notificationWindows(new Date('2026-11-03T13:00:00Z'));
  assert.equal(fall.followUpFrom,'2026-11-01T06:00:00.000Z');
  assert.equal(fall.followUpTo,'2026-11-02T07:00:00.000Z');
});
test('emails escape client names, expose replies, and link the free booking',()=>{
  const a=fixture('a');
  for(const html of [buildBookingEmails(a).clientHtml,buildReminderEmails(a).clientHtml,buildFollowUpEmail(a)]) {
    assert.ok(!html.includes('<script>Client'));
    assert.match(html,/reply to this email/i);
  }
  assert.match(buildFollowUpEmail(a),/https:\/\/sacredhoofandhand.com\/book\?service=free-intro/);
});
test('cron authorization, eligible follow-ups, duplicate prevention, failure retry and cancellation race',async()=>{
  assert.equal((await GET(new Request('https://example.com'))).status,401);
  rows=[fixture('confirmed'),fixture('completed','completed'),fixture('cancelled','cancelled'),fixture('pending','pending'),fixture('old','confirmed','2020-01-01T12:00:00.000Z')];
  sent=[];
  await run();
  assert.deepEqual(sent.map(s=>s[1]).sort(),['completed','confirmed']);
  await run(); assert.equal(sent.length,2);
  rows=[fixture('retry')];sent=[];fail=true;
  await run();assert.equal(rows[0].followup_claimed_at,null);assert.ok(!rows[0].followup_sent_at);
  fail=false;await run();assert.equal(sent.length,1);
  rows=[fixture('race')];sent=[];race=true;
  await run();assert.equal(sent.length,0);assert.equal(rows[0].followup_claimed_at,null);race=false;
});
test('same-day reminders exclude tomorrow and past sessions',async()=>{
  const now=Date.now(), w=notificationWindows(new Date());
  const upcoming=fixture('today');upcoming.starts_at=new Date(Math.min(now+60000,Date.parse(w.reminderTo)-1)).toISOString();
  rows=[upcoming,fixture('past'),{...fixture('tomorrow'),starts_at:w.reminderTo}];sent=[];
  await run();
  assert.equal(sent.filter(s=>s[0]==='reminder').length,2);
  assert.ok(sent.filter(s=>s[0]==='reminder').every(s=>s[1]==='today'));
});
