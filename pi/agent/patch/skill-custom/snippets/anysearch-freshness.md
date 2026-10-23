**Freshness note:** the `x_latest` / `x_top` types return a heat × recency mix — results
are NOT in strict time order and can span weeks, so an older high-engagement post may
outrank a newer one. There is no documented server-side sort parameter (passing `sort=` produced no observable
change in local tests).
When the newest items matter, request the full `--max_results 10` and re-sort / filter the
returned items by their `Posted:` timestamp yourself (e.g. keep the last 24–72 hours).
For niche keywords the pool may contain few fresh posts; fall back to a general search
then.
