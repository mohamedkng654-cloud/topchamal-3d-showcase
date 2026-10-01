# Google Search Console setup

The site SEO files are prepared for the custom domain `https://topchamal.ma`.

## Sitemap

Submit this URL in Google Search Console:

`https://topchamal.ma/sitemap.xml`

The sitemap currently lists the public storefront homepage. Private admin routes are intentionally excluded.

## Robots

The live robots file is:

`https://topchamal.ma/robots.txt`

It allows public storefront crawling, blocks `/admin` and `/api/`, and points crawlers to the sitemap.

## Verify the domain

1. Open [Google Search Console](https://search.google.com/search-console).
2. Click **Add property**.
3. Prefer **Domain** property and enter `topchamal.ma`.
4. Copy the TXT record Google provides.
5. Add that TXT record at the DNS provider managing `topchamal.ma`.
6. Return to Search Console and click **Verify**.
7. Open **Sitemaps**, enter `sitemap.xml`, and submit it.

## HTML-tag alternative

If DNS verification is not available, choose the **URL-prefix** property instead. Copy Google's HTML-tag value and set it as:

```env
VITE_GOOGLE_SITE_VERIFICATION=your-google-verification-token
```

Rebuild and redeploy. The app will emit the `google-site-verification` meta tag in the document head. Do not commit a private credential; the verification token is intended to be public.

## Checks after deployment

- `https://topchamal.ma/` returns the storefront and contains a canonical URL.
- `https://topchamal.ma/robots.txt` returns HTTP 200.
- `https://topchamal.ma/sitemap.xml` returns HTTP 200 and valid XML.
- `/admin` remains blocked from crawling and protected by authentication.
