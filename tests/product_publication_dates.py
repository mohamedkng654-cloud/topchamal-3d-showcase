"""Integration checks for automatic, private first-publication dates."""
import asyncio
import json
import os
import uuid
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f:
        minted = json.load(f)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        connection = {}
        def capture(request):
            if '/rest/v1/products' in request.url:
                connection['base'] = request.url.split('/rest/v1/')[0] + '/rest/v1/'
                connection['apikey'] = request.headers.get('apikey')
        page.on('request', capture)
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v]) => localStorage.setItem(k,v)', [minted['storage_key'], json.dumps(minted['session'])])
        await page.goto('http://localhost:8080/admin/products')
        await page.wait_for_timeout(3000)
        assert connection.get('base') and connection.get('apikey'), 'Catalog connection unavailable'
        headers = {'apikey': connection['apikey'], 'Authorization': 'Bearer ' + minted['session']['access_token'], 'Prefer': 'return=representation'}
        base = connection['base']
        slug = 'publication-check-' + uuid.uuid4().hex[:10]
        product_id = None
        async def api(method, path, data=None, auth=headers):
            response = await context.request.fetch(base + path, method=method, headers=auth, data=data)
            assert response.ok, 'Database request failed: ' + str(response.status)
            body = await response.text()
            return json.loads(body) if body else None
        try:
            rows = await api('POST', 'products', {'name':'Publication verification', 'slug':slug,'price_mad':10,'stock':1,'status':'draft'})
            product_id = rows[0]['id']
            path = 'product_publication_dates?product_id=eq.' + product_id
            assert await api('GET', path) == [], 'Draft must have no publication date'
            await api('PATCH', 'products?id=eq.'+product_id, {'status':'published'})
            dates = await api('GET', path)
            assert len(dates) == 1 and dates[0]['published_at'], 'Publishing must record date'
            first_date = dates[0]['published_at']
            await page.reload()
            await page.get_by_text(slug, exact=True).wait_for(timeout=30000)
            row = page.get_by_role('row').filter(has_text=slug)
            assert await row.locator('time').get_attribute('datetime') == first_date
            await row.screenshot(path='/tmp/browser/publication-dates/admin-date.png')
            public = {'apikey':connection['apikey']}
            response = await context.request.get(base + path, headers=public)
            assert response.status in (401,403) or (response.ok and await response.json() == []), 'Public must not access dates'
            await api('PATCH', 'products?id=eq.'+product_id, {'status':'draft'})
            await api('PATCH', 'products?id=eq.'+product_id, {'status':'published','price_mad':12})
            assert (await api('GET',path))[0]['published_at'] == first_date, 'Republishing must preserve first date'
            print('PASS: draft has no date; publish records date; admin list displays date; anonymous access denied; republishing preserves date')
        finally:
            if product_id:
                await api('DELETE','products?id=eq.'+product_id)
                assert await api('GET','product_publication_dates?product_id=eq.'+product_id) == [], 'Delete must remove date'
            await browser.close()

asyncio.run(main())
