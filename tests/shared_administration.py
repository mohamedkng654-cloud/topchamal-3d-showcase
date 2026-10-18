import asyncio,json,os,uuid
from playwright.async_api import async_playwright
async def main():
 with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: auth=json.load(f)
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  ctx=await browser.new_context(viewport={'width':1280,'height':1800}); page=await ctx.new_page(); errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
  connection={}
  def capture(req):
   if '/rest/v1/products' in req.url: connection.update(base=req.url.split('/rest/v1/')[0]+'/rest/v1/',key=req.headers.get('apikey'))
  page.on('request',capture)
  await page.goto('http://localhost:8080'); await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[auth['storage_key'],json.dumps(auth['session'])]); await page.goto('http://localhost:8080/admin/products')
  await page.get_by_placeholder('اسم المنتج',exact=True).wait_for(); await page.wait_for_timeout(1500)
  print('Layout:',await page.locator('.admin-shell,.admin-main,.admin-sidebar,.admin-content,.dashboard-page').evaluate_all('(els)=>els.map(e=>({cls:e.className,x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width,display:getComputedStyle(e).display}))'))
  anon=await browser.new_context(viewport={'width':1280,'height':1800}); visitor=await anon.new_page(); await visitor.goto('http://localhost:8080/admin/products'); await visitor.get_by_role('heading',name='مرحباً بعودتك').wait_for(timeout=30000); assert '/admin/login' in visitor.url; print('PASS signed-out admin redirects to login')
  slug='sync-test-'+uuid.uuid4().hex[:8]; name='Sync verification '+slug
  async def api(method,path,data=None):
   r=await ctx.request.fetch(connection['base']+path,method=method,headers={'apikey':connection['key'],'Authorization':'Bearer '+auth['session']['access_token'],'Prefer':'return=representation'},data=data)
   assert r.ok, str(r.status)
   t=await r.text();return json.loads(t) if t else None
  product_id=None; order_id=None
  try:
   form=page.locator('form').first
   await page.get_by_placeholder('اسم المنتج',exact=True).fill(name);await page.get_by_placeholder('product-slug').fill(slug)
   await form.get_by_label('السعر *',exact=True).fill('125');await form.get_by_label('المخزون',exact=True).fill('4');await form.locator('label').filter(has_text='الحالة').locator('select').select_option('published');await page.get_by_placeholder('https://...',exact=True).fill('http://localhost:8080/topchamal-logo.jpg')
   await form.get_by_role('button',name='إضافة المنتج',exact=True).click()
   row=page.get_by_role('row').filter(has_text=slug);await row.wait_for(timeout=30000)
   product_id=(await api('GET','products?slug=eq.'+slug))[0]['id']
   await visitor.goto('http://localhost:8080');await visitor.get_by_role('button',name='أضف '+name+' إلى السلة',exact=True).wait_for(timeout=30000);print('PASS UI create visible to independent visitor')
   await row.get_by_role('button',name='تعديل',exact=True).click();name+=' edited';await page.get_by_placeholder('اسم المنتج',exact=True).fill(name);await form.get_by_label('السعر *',exact=True).fill('175');print('Save buttons',await form.get_by_role('button').all_text_contents());await form.get_by_role('button',name='حفظ التعديلات',exact=True).click()
   await visitor.reload();await visitor.get_by_role('button',name='أضف '+name+' إلى السلة',exact=True).wait_for(timeout=30000)
   card=visitor.locator('.product-card').filter(has_text=name);assert '175' in await card.inner_text();print('PASS UI edit name and price visible on second browser')
   await card.get_by_role('button',name='أضف '+name+' إلى السلة',exact=True).click();await visitor.get_by_role('button',name='إتمام الطلب',exact=True).click()
   await visitor.locator('input[name=name]').fill('Sync checkout verification');await visitor.locator('input[name=phone]').fill('0612345678');await visitor.locator('input[name=city]').fill('Casablanca')
   await visitor.evaluate('window.open=(url)=>{window.__whatsapp=url;return {closed:false}}')
   await visitor.get_by_role('button',name='تأكيد الطلب وفتح واتساب',exact=True).click();await visitor.wait_for_function('window.__whatsapp');url=await visitor.evaluate('window.__whatsapp');assert url.startswith('https://wa.me/212716313000?text=');orders=await api('GET','orders?customer_name=eq.Sync%20checkout%20verification');order_id=orders[-1]['id'];assert float(orders[-1]['total_mad'])==175;print('PASS checkout saves shared order before direct WhatsApp chat')
   await page.reload(); row=page.get_by_role('row').filter(has_text=slug);await row.get_by_role('button',name='تعديل',exact=True).click();await form.locator('label').filter(has_text='الحالة').locator('select').select_option('draft');await form.get_by_role('button',name='حفظ التعديلات',exact=True).click();await page.wait_for_timeout(700);await visitor.goto('http://localhost:8080');await visitor.wait_for_timeout(2500);assert await visitor.get_by_role('button',name='أضف '+name+' إلى السلة',exact=True).count()==0;print('PASS unpublished product disappears')
   page.once('dialog',lambda d:d.accept());await row.get_by_role('button',name='حذف',exact=True).click();await page.get_by_text('هذا المنتج مرتبط بطلب؛ تمت أرشفته بدلاً من حذفه.',exact=True).wait_for();assert (await api('GET','products?id=eq.'+product_id))[0]['status']=='archived';print('PASS ordered product archived instead of deleted')
   await api('DELETE','orders?id=eq.'+order_id);order_id=None
   await page.reload();row=page.get_by_role('row').filter(has_text=slug);page.once('dialog',lambda d:d.accept());await row.get_by_role('button',name='حذف',exact=True).click();await row.wait_for(state='detached');assert await api('GET','products?id=eq.'+product_id)==[];product_id=None;print('PASS UI delete removed product')
  finally:
   if order_id:await api('DELETE','orders?id=eq.'+order_id)
   if product_id:await api('DELETE','products?id=eq.'+product_id)
  await page.goto('http://localhost:8080/admin/site');await page.get_by_label('عنوان الصفحة',exact=True).wait_for();field=page.get_by_label('عنوان الصفحة',exact=True);old=await field.input_value()
  try:
   await field.fill('Shared heading verification');await page.get_by_role('button',name='حفظ معلومات الموقع',exact=True).click();await page.get_by_text('تم حفظ معلومات الموقع لجميع الزوار.',exact=True).wait_for();await visitor.reload();await visitor.get_by_role('heading',name='Shared heading verification',exact=False).wait_for();print('PASS settings saved from admin appear in independent public browser')
  finally:
   await field.fill(old);await page.get_by_role('button',name='حفظ معلومات الموقع',exact=True).click()
  await page.screenshot(path='/tmp/browser/shared-admin/final-admin.png');await visitor.set_viewport_size({'width':360,'height':625});await visitor.reload();await visitor.locator('.loader').wait_for(state='detached');await visitor.screenshot(path='/tmp/browser/shared-admin/final-mobile.png');print('Errors',errs)
  await browser.close()
asyncio.run(main())
