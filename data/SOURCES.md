# StyleScent Dataset Sources & Provenance

This document records the provenance, methodology, and external source references for all datasets used in StyleScent.

---

## 1. Perfume Dataset (`data/perfumes.json`)

### Composite Ranking Methodology
*(From `data/raw/notes.txt`)*

> There is no official global ranking of men's perfumes. The ranks in this dataset are a composite built from several public rankings, retailer bestsellers, and community awards: a perfume ranks higher when more independent sources list it and when it places higher in each. Notes, longevity, and projection come from public sources and community consensus rather than laboratory measurements.

### Provenance & Honesty
- The perfume dataset is a **team-curated sample dataset** compiled from web research.
- All entries are initialized with `"verified": false` and are subject to manual note verification by team members prior to live demo usage.
- Scent attributes such as `time_of_day` and `vibe` are inferred using deterministic heuristic tables documented in `src/data/inference.js`.

### November 2026 expansion (entries p_021–p_042)
- Added 11 Nov 2026 to close the coverage gaps the audit found: college_fest (0 → 11), interview (1 → 6), budget (0 → 8), women (0 → 4), citrus family (0 → 3), summer (5 → 17). Total: 20 → 42 entries.
- These 22 entries are **team-research entries, not source-verified**: `verified: false`, `source_agreement: "low"`, `sources: []` (no URLs invented), `confidence: "medium"` except Zara Vibrant Leather, Jaguar Classic Black and Adidas Ice Dive (`"low"`). The team must check each entry's notes against a real retailer/community listing and fill in its `sources` before it is used in the live demo — the `data/VERIFY.md` checklist now lists all 42 entries as unverified.
- Demo check now passes: 4 entries match college_fest + autumn/winter + evening/night with no vanilla and no musk (Dior Sauvage, Paco Rabanne Invictus, Montblanc Explorer, Azzaro Wanted).

### Unique Research Sources by Domain

#### Retailers & Industry Guides
- **belvish.com**: Product listings and note breakdowns
  - https://belvish.com/products/viktor-rolf-spicebomb-extreme-edp-for-men
  - https://belvish.com/products/xerjoff-naxos-edp
- **bykilian.com**: Official luxury house product descriptions
  - https://www.bykilian.com/product/19797/82905/perfume/angels-share/the-liquors
- **elixirperfume.co.in**:
  - https://elixirperfume.co.in/products/angels-shere
- **feelingsexy.com.au**:
  - https://www.feelingsexy.com.au/terre-dhermes-by-hermes-15230
- **hnak.com**:
  - https://www.hnak.com/en-sa/parfums-de-marly-althair-edp
- **jomashop.com**: Longevity and performance guides
  - https://www.jomashop.com/blog/articles/which-creed-colognes-last-the-longest
- **libertineparfumerie.com.au**:
  - https://www.libertineparfumerie.com.au/products/parfums-de-marly-althair
- **nordstrom.com**: Bestseller cologne rankings
  - https://www.nordstrom.com/browse/men/grooming/cologne/bestsellers
  - https://www.nordstrom.com/browse/men/grooming/cologne/bestsellers?filterByBrand=hermes
- **nykaaman.com**:
  - https://www.nykaaman.com/jean-paul-gaultier-le-male-eau-de-parfum/reviews/1003519
- **theperfumeshop.com**:
  - https://www.theperfumeshop.com/jean-paul-gaultier/le-male-le-parfum/eau-de-parfum-spray/p/70800EDPJU?varSel=1250998
- **tirabeauty.com**:
  - https://www.tirabeauty.com/product/prada-lhomme-prada-eau-de-toilette-100ml-lbzwydxc5e
- **ulta.com**:
  - https://www.ulta.com/discover/fragrance/best-mens-cologne
- **m.shein.com**:
  - https://m.shein.com/za/Yves-Saint-Laurent-YSL-La-Nuit-De-L-Homme-60ml-EDT-Spray-p-487411282.html

#### Editorial Reviews & Fragrance Blogs
- **fehman.com**: Olfactory note architecture reviews
  - https://www.fehman.com/blogs/news/bleu-de-chanel-review-scent-notes-performance
  - https://www.fehman.com/blogs/news/creed-aventus-notes-explained-top-heart-base
- **forbes.com**: Curated best-of editorial selections
  - https://www.forbes.com/sites/forbes-personal-shopper/article/best-cologne-for-men/
- **fregranzo.com**:
  - https://www.fregranzo.com/fragrance/louis-vuitton/imagination/
- **mahadiperfumes.com**:
  - https://mahadiperfumes.com/blogs/news/dior-sauvage-elixir-review-complete-guide-by-mahadi-perfumes-authentic-luxury-fragrance
- **michael84.co.uk**: Independent menswear fragrance reviews
  - https://www.michael84.co.uk/bleu-de-chanel-parfum-review/
  - https://www.michael84.co.uk/dior-sauvage-elixir-fragrance-review/
  - https://www.michael84.co.uk/le-male-le-parfum-jean-paul-gaultier-review/
- **odora.it**:
  - https://www.odora.it/en/perfumes/chanel-bleu-de-chanel-parfum
- **perfumdle.com**:
  - https://perfumdle.com/en/parfum/dior-dior-homme-intense/
- **realmenrealstyle.com**: Top men's fragrances roundups
  - https://www.realmenrealstyle.com/25-top-mens-fragrances-2025/
- **scentgrail.com**:
  - https://scentgrail.com/holy-grail-scents/terre-dhermes-review/
- **scento.com**: Seasonal fragrance guides
  - https://www.scento.com/blog/best-creed-perfumes-for-men-legendary-picks
  - https://www.scento.com/fr/blog/best-winter-perfumes-for-men
  - https://www.scento.com/perfumes/spicebomb-extreme-viktor-rolf
- **theperfumeescape.com**:
  - https://theperfumeescape.com/bleu-de-chanel-review-performance-dupes-modern-classic/
- **thescentlibrary.pk**:
  - https://thescentlibrary.pk/blogs/guides/top-10-mens-perfumes-of-all-time
- **whatscent.app**:
  - https://whatscent.app/magazine/bleu-de-chanel-edp-review

#### Fragrance Communities & Award Rankings
- **parfumo.com**: Community top rankings
  - https://www.parfumo.com/Perfumes
  - https://www.parfumo.com/Perfumes/Tops/Men
  - https://www.parfumo.com/Perfumes/Tops/Unisex
- **reddit.com** (`r/fragrance`, `r/Colognes`, `r/DesiFragranceAddicts`):
  - https://www.reddit.com/r/Colognes/comments/15m95te/new_parfums_de_marly_althair_review/
  - https://www.reddit.com/r/DesiFragranceAddicts/comments/1hgzzti/new_dior_homme_parfum_2025_thoughts/
  - https://www.reddit.com/r/fragrance/comments/1nwjvbg/robb_report_on_the_case_declaring_the_50_greatest/
  - https://www.reddit.com/r/fragrance/comments/1q0xi3o/2025_fragrantica_community_award_winners_are_out/
- **research.jgu.edu.in**:
  - https://research.jgu.edu.in/page/10/?vid=N5jqGBMDKps&fastly=520
- **youtube.com**:
  - https://www.youtube.com/watch?v=dy7Tve-axbA

---

## 2. Styling Datasets

The styling datasets are **hand-authored styling rules**, not scraped facts:
- **`data/colour_rules.json`**: Authored by the StyleScent team based on classic colour wheel theory (complementary, analogous, triadic, neutral pairing) and seasonal fashion palettes.
- **`data/patterns.json`**: Authored based on menswear pattern matching principles (print scale contrast, solid ground anchors, and print clash avoidance).
- **`data/tone_map.json`**: Authored by the team to bridge wardrobe aesthetic moods (e.g. dark and bold, pastel, formal suiting) with corresponding olfactory fragrance vibe tags.
