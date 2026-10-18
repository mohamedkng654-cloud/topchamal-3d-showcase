import asyncio,json,os,uuid
from playwright.async_api import async_playwright
async def main():
 with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: auth=json.load(f)
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True);c=await b.new_context(viewport={'width':1280,'height':1800});page=await c.new_page();connection={};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def cap(r):
   if '/rest/v1/' in r.url:connection.update(base=r.url.split('/rest/v1/')[0]+'/rest/v1/',key=r.headers.get('apikey'))
  page.on('request',cap);await page.goto('http://localhost:8080');await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[auth['storage_key'],json.dumps(auth['session'])]);await page.goto('http://localhost:8080/admin/stories');await page.get_by_role('heading',name='قصص المتجر',exact=True).wait_for();await page.wait_for_timeout(1000)
  async def api(method,path,data=None):
   r=await c.request.fetch(connection['base']+path,method=method,headers={'apikey':connection['key'],'Authorization':'Bearer '+auth['session']['access_token'],'Prefer':'return=representation'},data=data);assert r.ok,str(r.status);t=await r.text();return json.loads(t) if t else None
  title='Story verification '+uuid.uuid4().hex[:8];sid=None
  try:
   await page.set_input_files('input[type=file]','/dev-server/public/topchamal-logo.jpg');await page.get_by_placeholder('مثلاً: عرض نهاية الأسبوع').fill(title);await page.get_by_role('button',name='نشر القصة',exact=True).click();await page.get_by_text('تم نشر القصة بنجاح لجميع الزوار.',exact=True).wait_for(timeout=30000);rows=await api('GET','store_stories');sid=next(r['id'] for r in rows if r['content'].get('title')==title)
   other=await b.new_context(viewport={'width':1280,'height':1800});visitor=await other.new_page();await visitor.goto('http://localhost:8080');await visitor.get_by_role('button',name='فتح قصة '+title,exact=True).wait_for(timeout=30000);print('PASS story uploaded in admin and visible to second browser')
   card=page.locator('.story-admin-card').filter(has_text=title);print('Story actions',await card.get_by_role('button').all_text_contents());await card.get_by_role('button',name='إيقاف',exact=True).click();await page.get_by_text('تم إيقاف القصة لجميع الزوار.',exact=True).wait_for();await visitor.reload();await visitor.locator('.loader').wait_for(state='detached');assert await visitor.get_by_role('button',name='فتح قصة '+title,exact=True).count()==0
   assert len(await api('GET','store_stories?id=eq.'+sid))==1;print('PASS inactive story hidden publicly and remains readable by admin')
   page.once('dialog',lambda d:d.accept());await card.get_by_role('button',name='حذف',exact=True).click();await card.wait_for(state='detached');sid=None;print('PASS story deletion persists')
  finally:
   if sid:await api('DELETE','store_stories?id=eq.'+sid)
  await b.close();print('Runtime errors',errors)
asyncio.run(main())
