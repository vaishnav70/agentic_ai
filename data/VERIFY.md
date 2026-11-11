# StyleScent Data Quality & Verification Audit

Generated: 2026-11-11T13:35:35.998Z
Total Fragrances: **42**
Verified Entries: **0 / 42 (0.0%)**

## 1. Coverage Distributions

### By Olfactory Family
| Family | Count |
|---|---|
| woody | 15 |
| floral | 3 |
| citrus | 3 |
| fresh | 7 |
| oriental | 7 |
| gourmand | 3 |
| aromatic | 3 |
| fruity | 1 |

### By Season
| Season | Count |
|---|---|
| spring | 23 |
| summer | 17 |
| autumn | 32 |
| winter | 28 |

### By Occasion
| Occasion | Count |
|---|---|
| college_fest | 11 |
| office | 18 |
| date_night | 26 |
| wedding | 18 |
| casual | 19 |
| interview | 6 |
| party | 26 |
| festival_traditional | 3 |

### By Price Band
| Price Band | Count |
|---|---|
| budget | 8 |
| mid | 11 |
| premium | 23 |
| null | 0 |

### By Projection
| Projection | Count |
|---|---|
| soft | 1 |
| moderate | 16 |
| strong | 19 |
| null | 6 |

### By Target Demographic
| Demographic | Count |
|---|---|
| men | 35 |
| unisex | 3 |
| women | 4 |

## 2. Audit Warnings

- ⚠️ Occasion "festival_traditional" has only 3 fragrances (threshold: 6).
- ⚠️ 6 entries have null projection: Dior Homme Intense, XJ 1861 Naxos, Imagination, Dior Homme Parfum, MYSLF Eau de Parfum, Gentleman Réserve Privée
- ⚠️ 2 entries have null longevity: MYSLF Eau de Parfum, Gentleman Réserve Privée
- ⚠️ 9 entries have "low" confidence: Dior Homme Intense, XJ 1861 Naxos, Imagination, Dior Homme Parfum, MYSLF Eau de Parfum, Gentleman Réserve Privée, Vibrant Leather, Classic Black, Ice Dive
- ⚠️ 22 entries have "low" source agreement: Sauvage, Invictus, Explorer, Wanted, L'Homme, H24, Colonia, Allure Homme Sport, Voyage, Cool Water, Club de Nuit Intense Man, Asad, Vibrant Leather, Classic Black, Ice Dive, Khamrah, CK One, Man Eau Fraiche, La Vie Est Belle, Good Girl, J'adore, Black Opium

## 3. Demo Coverage Check

> Criteria: Occasion = `college_fest` AND Season ∈ {`autumn`, `winter`} AND Time ∈ {`evening`, `night`} AND Notes exclude `vanilla` and `musk`.

Matching Fragrances Found: **4**
| ID | Name | Brand | Price Band | Longevity |
|---|---|---|---|---|
| p_021 | Sauvage | Dior | premium | medium |
| p_022 | Invictus | Paco Rabanne | mid | medium |
| p_023 | Explorer | Montblanc | mid | medium |
| p_024 | Wanted | Azzaro | mid | medium |

## 4. Unverified Entries Checklist

The following **42** entries require team verification prior to judging demo usage:

| ID | Fragrance Name | Brand | Family | Confidence | Verified |
|---|---|---|---|---|:---:|
| p_001 | Aventus | Creed | fruity | high | [ ] |
| p_002 | Bleu de Chanel Eau de Parfum | Chanel | woody | high | [ ] |
| p_003 | Dior Homme Intense | Dior | woody | low | [ ] |
| p_004 | Sauvage Elixir | Dior | woody | high | [ ] |
| p_005 | XJ 1861 Naxos | Xerjoff | oriental | low | [ ] |
| p_006 | Terre d'Hermès | Hermès | woody | high | [ ] |
| p_007 | Layton | Parfums de Marly | woody | high | [ ] |
| p_008 | Imagination | Louis Vuitton | fresh | low | [ ] |
| p_009 | Spicebomb Extreme | Viktor & Rolf | oriental | high | [ ] |
| p_010 | Le Male Le Parfum | Jean Paul Gaultier | oriental | high | [ ] |
| p_011 | Althaïr | Parfums de Marly | gourmand | high | [ ] |
| p_012 | La Nuit de L'Homme | Yves Saint Laurent | woody | high | [ ] |
| p_013 | Dior Homme Parfum | Dior | woody | low | [ ] |
| p_014 | Angels' Share | By Kilian | oriental | high | [ ] |
| p_015 | Bleu de Chanel Parfum | Chanel | woody | high | [ ] |
| p_016 | Green Irish Tweed | Creed | fresh | high | [ ] |
| p_017 | Viking | Creed | aromatic | high | [ ] |
| p_018 | Royal Oud | Creed | woody | high | [ ] |
| p_019 | MYSLF Eau de Parfum | Yves Saint Laurent | floral | low | [ ] |
| p_020 | Gentleman Réserve Privée | Givenchy | woody | low | [ ] |
| p_021 | Sauvage | Dior | fresh | medium | [ ] |
| p_022 | Invictus | Paco Rabanne | fresh | medium | [ ] |
| p_023 | Explorer | Montblanc | woody | medium | [ ] |
| p_024 | Wanted | Azzaro | woody | medium | [ ] |
| p_025 | L'Homme | Prada | woody | medium | [ ] |
| p_026 | H24 | Hermès | aromatic | medium | [ ] |
| p_027 | Colonia | Acqua di Parma | citrus | medium | [ ] |
| p_028 | Allure Homme Sport | Chanel | woody | medium | [ ] |
| p_029 | Voyage | Nautica | fresh | medium | [ ] |
| p_030 | Cool Water | Davidoff | fresh | medium | [ ] |
| p_031 | Club de Nuit Intense Man | Armaf | oriental | medium | [ ] |
| p_032 | Asad | Lattafa | oriental | medium | [ ] |
| p_033 | Vibrant Leather | Zara | woody | low | [ ] |
| p_034 | Classic Black | Jaguar | aromatic | low | [ ] |
| p_035 | Ice Dive | Adidas | fresh | low | [ ] |
| p_036 | Khamrah | Lattafa | gourmand | medium | [ ] |
| p_037 | CK One | Calvin Klein | citrus | medium | [ ] |
| p_038 | Man Eau Fraiche | Versace | citrus | medium | [ ] |
| p_039 | La Vie Est Belle | Lancôme | floral | medium | [ ] |
| p_040 | Good Girl | Carolina Herrera | oriental | medium | [ ] |
| p_041 | J'adore | Dior | floral | medium | [ ] |
| p_042 | Black Opium | Yves Saint Laurent | gourmand | medium | [ ] |
