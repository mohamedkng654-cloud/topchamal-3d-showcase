<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the TanStack preview and separate Vite static export using one storefront component, so the storefront can deploy to ordinary static hosts without a runtime server.
- Keep public product data in JSON and media in local asset pointers, so merchandising does not depend on the original store at runtime.
- Use WhatsApp's prefilled share flow until a confirmed store phone number is supplied, to avoid sending orders to an invented recipient.
