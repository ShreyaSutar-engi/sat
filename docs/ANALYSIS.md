# SAT Math Corpus Analysis

Source analysis of the provided official College Board SAT Math question sets. This
document is the reference that question generation, difficulty calibration, and
distractor construction in this app are built against.

**Corpus:** 1,039 official questions across 57 PDF sets (19 skills × 3 sets each),
plus 57 matching answer-key PDFs.

**Status of the data:** Every question is stored as a rendered image inside the PDFs;
only the item table (question number, official item ID, difficulty score) and the answer
key are in the text layer. Both tables were parsed programmatically and cross-checked;
the answer key aligned 1:1 with the item table for 1,006 of 1,039 items. The remaining 33
(all of Right Triangles and Trigonometry) had answers typeset as images, so every one of
those was solved directly and the answer recorded. 432 questions were additionally read
and transcribed in full — spanning all 19 skills — to build the template and distractor
catalog below.

---

## 1. Corpus composition

### 1.1 By content domain

| Domain | n | Share of corpus | MCQ | SPR | Mean difficulty |
|---|---:|---:|---:|---:|---:|
| Algebra | 340 | 32.7% | 270 | 70 | 464 |
| Advanced Math | 265 | 25.5% | 208 | 57 | 452 |
| Problem-Solving and Data Analysis | 262 | 25.2% | 201 | 61 | 511 |
| Geometry and Trigonometry | 172 | 16.6% | 119 | 53 | 456 |

### 1.2 By skill (College Board's own 19 skill labels)

| Skill | Domain | n | Share | MCQ | SPR | Mean diff |
|---|---|---:|---:|---:|---:|---:|
| Nonlinear Functions | Adv. Math | 110 | 10.6% | 89 | 21 | 489 |
| Linear Functions | Algebra | 86 | 8.3% | 72 | 14 | 477 |
| Nonlinear Equations and Systems | Adv. Math | 85 | 8.2% | 58 | 27 | 433 |
| Linear Equations in Two Variables | Algebra | 81 | 7.8% | 62 | 19 | 490 |
| Equivalent Expressions | Adv. Math | 70 | 6.7% | 61 | 9 | 418 |
| Linear Equations in One Variable | Algebra | 65 | 6.3% | 47 | 18 | 392 |
| Systems of Linear Equations | Algebra | 62 | 6.0% | 49 | 13 | 467 |
| Area and Volume | Geo/Trig | 59 | 5.7% | 45 | 14 | 433 |
| Ratios, Rates, Proportions, Units | PSDA | 57 | 5.5% | 36 | 21 | 388 |
| Percentages | PSDA | 52 | 5.0% | 37 | 15 | 409 |
| One-Variable Data | PSDA | 49 | 4.7% | 40 | 9 | 584 |
| Lines, Angles, and Triangles | Geo/Trig | 48 | 4.6% | 33 | 15 | 510 |
| Linear Inequalities | Algebra | 46 | 4.4% | 40 | 6 | 493 |
| Two-Variable Data | PSDA | 39 | 3.8% | 35 | 4 | 668 |
| Probability | PSDA | 36 | 3.5% | 26 | 10 | 585 |
| Right Triangles and Trigonometry | Geo/Trig | 33 | 3.2% | 20 | 13 | 473 |
| Circles | Geo/Trig | 32 | 3.1% | 21 | 11 | 402 |
| Sample Statistics and Margin of Error | PSDA | 18 | 1.7% | 16 | 2 | 508 |
| Evaluating Statistical Claims | PSDA | 11 | 1.1% | 11 | 0 | 516 |

### 1.3 The most important finding about distribution

**This corpus is not weighted like a real digital SAT form.** The operational Math
section is 44 questions weighted roughly:

| Domain | Real exam | This corpus | Gap |
|---|---:|---:|---:|
| Algebra | ~35% | 32.7% | −2 pts |
| Advanced Math | ~35% | 25.5% | **−10 pts** |
| Problem-Solving and Data Analysis | ~15% | 25.2% | **+10 pts** |
| Geometry and Trigonometry | ~15% | 16.6% | +2 pts |

A student who drills straight through this corpus in its natural proportions will
**under-train Advanced Math by about a third and over-train PSDA by about two-thirds.**

Consequence for the app: practice must be served on **exam weighting, not corpus
weighting**. Full-module simulation and adaptive mode both sample to the real-exam
distribution; the shortfall in Advanced Math is covered by generated questions built on
the Advanced Math templates catalogued in §4.

---

## 2. Question format

| Format | n | Share |
|---|---:|---:|
| Multiple choice (4 options, A–D) | 798 | 76.8% |
| Student-produced response (grid-in) | 241 | 23.2% |

This matches the real exam closely (~75% / ~25%), so format ratio can be preserved as-is.

### 2.1 Answer-key position is uniform — no gaming it

| Key | n | Share |
|---|---:|---:|
| A | 204 | 25.6% |
| B | 219 | 27.4% |
| C | 180 | 22.6% |
| D | 195 | 24.4% |

No exploitable positional bias. **Generated questions must randomize the correct position
uniformly**, or the app would teach a pattern that does not exist on the real test.

### 2.2 SPR conventions observed in the corpus

- Answers may be integers (`480`), decimals (`0.2`, `518.4`, `24.5`), fractions (`135/8`,
  `10/3`, `7/6`, `-49/150`), or negative (`-419`, `-52`, `-22`).
- **Some SPR items accept multiple distinct correct answers.** Observed: `11, -7`
  (absolute-value equation), `0, 3` and `15, -5` (quadratic roots), `7, 8, 13` and
  `8, 9` (integer-range answers), `10/3, 15/4, 25/6` (a family of valid values).
  The grader must accept any listed value, and must accept equivalent forms
  (`0.5` = `1/2`, `135/8` = `16.875`).
- No SPR answer in the corpus uses a radical or π — those are always MCQ. Generation
  must respect this: **an answer that cannot be typed as a decimal or fraction must be
  multiple choice.**

---

## 3. Difficulty

Each item carries a numeric difficulty score in the source tables, ranging **211 to 1,200**
(mean 472, median ~450). It behaves as a monotonic difficulty/expected-solve-time proxy:
trivially procedural items sit near 210–370, multi-step modelling items near 550–700, and
the handful above 900 are genuinely hard synthesis problems.

Working tertiles for the whole bank:

| Band | Score | n | Share |
|---|---|---:|---:|
| Easy | < 400 | 338 | 32.5% |
| Medium | 400–559 | 463 | 44.6% |
| Hard | ≥ 560 | 238 | 22.9% |

Hardest skills by mean score: Two-Variable Data (668), Probability (585),
One-Variable Data (584), Lines/Angles/Triangles (510).
Easiest: Ratios/Rates (388), Linear Equations in One Variable (392), Circles (402).

### 3.1 What actually makes a hard question hard

Difficulty in this corpus is almost never "harder arithmetic." It comes from six
identifiable sources:

1. **Step count without signposting.** Easy: `5p + 180 = 250, find p` (d=369). Hard: find
   the radius of a circle through three plotted points, then report the circumference as a
   multiple of π (d=872) — three chained sub-results, none of them prompted.
2. **Answering a transformed quantity, not the variable.** `If 3x − 27 = 24, what is
   x − 9?` (d=391) is arithmetically trivial but traps students who solve for `x` and stop.
   This device recurs constantly and is the single cheapest difficulty lever in the corpus.
3. **Abstract parameters instead of numbers.** `(b − 2)x = 8 has no solution, find b`
   (d=425); `9x + 5 = a(x + b) has no solutions, which must be true?` (d=520). Same algebra,
   but the student must reason about *structure* rather than compute.
4. **Reading a model rather than a value.** Scatterplot questions that require reading the
   *line of best fit* rather than the nearest data point (d=636); interpreting what a
   coefficient *means* in context rather than computing with it (d=499).
5. **Scale-factor reasoning.** Linear vs. area (k²) vs. volume (k³) relationships. Nearly
   every similar-figures item in the corpus is built on this, and difficulty tracks whether
   the student must invert the ratio (d=644 vs. d=433 for the direct version).
6. **Inference scope.** The statistics items are conceptually hard, not computationally
   hard: what population can a result generalize to, and what does a margin of error
   actually bound. `Which must be true?` with a "None" option runs d=515–609.

**Design rule taken from this:** to make a generated question harder, add a step,
ask for a transformed quantity, or parameterize a constant — *never* make the numbers uglier.

---

## 4. Recurring stems and structural templates

Frequency counts below are from the 432 fully transcribed questions.

### 4.1 The dominant question frames

| Frame | Typical wording | Notes |
|---|---|---|
| Direct evaluation | "What is the **value** of …" (45×) | The workhorse. Also length (24×), area (17×), slope (13×), volume (11×), measure (6×) |
| Equivalence | "Which **expression is equivalent to** …" (9×) | Almost all of Equivalent Expressions |
| Modelling | "Which **equation represents this** situation?" (9×) | Student builds the model, doesn't solve it |
| Logical necessity | "Which **must be true**?" (5×) | Often with a "None"/"Neither" option that is frequently correct |
| Table-matching | "Which **table gives three x values and their corresponding y values**?" (4×) | Four candidate tables; tests function evaluation |
| Interpretation | "Which is the **best interpretation** of [coefficient] in this context?" | No computation at all |
| Roman-numeral | "I only / II only / I and II only / Neither" | 5 instances; used to force full case-checking |
| Graph/figure read | "…of the graph shown", "In the figure above…" | See §5 |

### 4.2 Signature structural devices

- **"Figure not drawn to scale"** appears on essentially every geometry diagram. Answers
  must never be obtainable by measuring the picture.
- **Solve-for-a-composite**: ask for `x − 9`, `3x + 8`, `2(x − 8)`, `x + 4`, `b/a`, `a + d`,
  `a + b + c`, `rt`, `k + n`, `4a`. Extremely common and a reliable difficulty lever.
- **No-solution / infinitely-many-solutions** conditions on a parameter — appears in
  both Linear Equations in One Variable and Nonlinear Equations and Systems.
- **Same stem, two difficulties**: e.g. similar-figure perimeter given the ratio (d=573)
  vs. given both perimeters and asked to invert (d=644). Generation should exploit this.
- **Context nouns** are consistent and mundane: money (46×), triangles (44×), circles (40×),
  percent (23×), rectangles (14×), miles (10×), samples/random (20×), cylinders (9×).
  Generated questions should stay in this register — no whimsical scenarios.

---

## 5. Figures and stimuli

Of the 432 transcribed questions, **78% have no visual stimulus at all**; 22% carry a
figure, table, or graph:

- Coordinate-plane line graphs (read slope / intercept / a point)
- Scatterplots with a line of best fit
- Right triangles with two labelled sides or an angle, "not drawn to scale"
- Parallel lines cut by a transversal
- Circles with central angles, arcs, or points on a grid
- Two-way frequency tables (probability)
- Value tables (`x | y`), including four-table answer choices
- Box plots, bar/line graphs
- Solid figures (rectangular prisms, cylinders, cones)

Implication: the majority of the bank can be delivered as pure typeset math, and figures,
where needed, are simple enough to render as inline SVG rather than bitmaps.

---

## 6. Distractor taxonomy — the core of the analysis

Every wrong answer in this corpus encodes a specific, reproducible student error. Random
wrong numbers essentially do not occur. These are the recurring families, each observed
many times across the 432 transcribed items.

### 6.1 Arithmetic and procedural

| # | Family | Mechanism | Example |
|---|---|---|---|
| D1 | **Inverse operation** | Divides where multiplication is required, or vice versa | Area of rectangle asks `l×w`; distractor gives `l+w` |
| D2 | **Partial solve** | Stops at the variable when a transformed quantity was asked | `3x − 27 = 24`, asks `x − 9` → distractor is `x = 17` |
| D3 | **Copied given** | The distractor is a number lifted straight from the stem | Asks for the third side; distractor is one of the two given sides |
| D4 | **Off-by-one rounding** | Floors when the context requires ceiling, or vice versa | 50 rolls ÷ 12 per pack → distractor `4` instead of `5` |
| D5 | **Dropped constant factor** | Forgets ½ in triangle area, ⅓ in cone volume | `bh` instead of `½bh` |

### 6.2 Formula and substitution

| # | Family | Mechanism | Example |
|---|---|---|---|
| D6 | **Diameter-for-radius** | Uses `d` where `r` belongs in a squared term | Cylinder with `d=8`: distractor `π(8)²h` |
| D7 | **Unsquared / un-rooted** | Reports `r²` instead of `r`, or skips the square root | `(x−6)²+(y−3)²=81` → distractor radius `81` |
| D8 | **Wrong power of the scale factor** | Uses `k` where `k²` (area) or `k³` (volume) is needed, or the reverse | Sides ×246 → area distractor `492` (=2·246) instead of `246²` |
| D9 | **Inverted ratio** | Applies the reciprocal scale factor | Perimeter 50→150 with side 6: distractor `2` instead of `18` |

### 6.3 Algebraic manipulation

| # | Family | Mechanism | Example |
|---|---|---|---|
| D10 | **Sign / failed distribution** | Minus sign not distributed across a full parenthesis | `(2x+3) − (x−7)` → distractor `x − 4` |
| D11 | **Middle-term omission** | Expands `(a+b)²` as `a² + b²` | `(a + b/2)²` → distractor `a² + b²/4` |
| D12 | **Perfect-square vs difference-of-squares swap** | Factors `x² − 5` as `(x−√5)²` | Introduces a spurious middle term |
| D13 | **Exponent arithmetic** | Adds exponents when subtracting, or multiplies when adding | `11x³ − 5x³` → distractor `6x⁶` |
| D14 | **Off-by-one on a telescoping/series result** | Correct form, wrong index | `(1−p)(1+…+p⁶)` → distractor `1 − p⁶` instead of `1 − p⁷` |

### 6.4 Modelling and interpretation

| # | Family | Mechanism | Example |
|---|---|---|---|
| D15 | **Swapped variables** | Coefficient attached to the wrong quantity | Sandwiches 1.5 min, salads 1.9 → distractor `1.9x + 1.5y` |
| D16 | **Slope/intercept swap** | Rate and starting value exchanged | Rises 8 ft/s from 15 ft → distractor `h = 15s + 8` |
| D17 | **Coefficient vs. product vs. variable** | Names `2.00` when asked about `2.00x`, or vice versa | Interpretation items |
| D18 | **Inequality direction flip** | "at most" rendered as `≥` | `15s + 25p ≥ 120` |
| D19 | **Percent-as-integer** | Uses `89h` or `0.089h` for "89% of h" | Decimal placement |
| D20 | **Percent base error** | Divides by the new value instead of the original | 1.00→1.60 → distractor `62.5%` instead of `60%` |

### 6.5 Geometry and trigonometry

| # | Family | Mechanism | Example |
|---|---|---|---|
| D21 | **Complementary/reciprocal trig confusion** | Returns `cos` when `sin` is asked, or `tan B` for `tan A` | `tan A = 20/21` → distractor `21/20` |
| D22 | **Scale-invariance missed** | Believes a trig ratio changes when the triangle is scaled | "AB is 2.9 × DE" is deliberately irrelevant |
| D23 | **Supplement vs. corresponding angle** | Gives `180 − x` where `x` is correct | Parallel-lines items |
| D24 | **Centre-sign error** | Reads `(x+8)²` as centre `+8` | Circle equations |

### 6.6 Statistics and data

| # | Family | Mechanism | Example |
|---|---|---|---|
| D25 | **Sample statistic treated as population parameter** | "87% of the sample" → "87% of the town" | Nearly every Evaluating Statistical Claims item |
| D26 | **Generalization beyond the sampling frame** | Extends to a wider population than was sampled | "All professors in the US" from a CSU history sample |
| D27 | **Margin of error applied to individuals** | Bounds each value rather than the mean | 27.8 ± 0.02 oz |
| D28 | **Point-not-line** | Reads a data point instead of the line of best fit | Scatterplot prediction |
| D29 | **Wrong table margin** | Uses a cell, row, or column where the grand total belongs | Two-way tables |
| D30 | **Mean/median/mode substitution** | Returns the mode when the median is asked | `2,2,2,3,4,4,11` → distractor `2` |

**Generation rule:** every generated MCQ must map each of its three distractors to a
specific numbered family above, and must record which one. A distractor that cannot be
named is not allowed in the bank.

---

## 7. Rules for generated questions

Derived directly from the sections above.

1. **Content weighting** follows the real exam (35/35/15/15), not the corpus.
2. **Format ratio** ~77% MCQ / ~23% SPR, matching the corpus and the real exam.
3. **Correct-answer position** uniform across A–D.
4. **Difficulty** is assigned on the same 211–1200 scale, generated to the
   32/45/23 easy/medium/hard split, and raised only by the four legitimate levers in §3.1.
5. **Every distractor** carries a `misconception` tag from the §6 taxonomy.
6. **Answer must be unique.** Quadratics that admit two roots are either asked as SPR with
   both accepted, or constrained ("the positive solution").
7. **SPR answers must be typeable**: integer, decimal, or fraction. Never a radical or π.
8. **Numbers stay clean** — the corpus overwhelmingly uses integers and one- or
   two-decimal values.
9. **Register stays plain**: money, distance, students, samples, standard shapes.
10. **Geometry figures carry "Figure not drawn to scale"** and must be solvable without
    measuring.
11. **Verification**: every generated item is checked by evaluating the correct answer
    symbolically/numerically, confirming each distractor is *different* from the key and
    from every other distractor, and confirming no distractor is also a valid answer.

---

## 8. Files

| File | Contents |
|---|---|
| `data/corpus-index.csv` | All 1,039 items: set, question number, official item ID, difficulty, verified answer, skill, domain, format |
| `data/corpus-annotated.psv` | 432 fully transcribed items: stem, choices, and per-distractor misconception analysis |
| `docs/ANALYSIS.md` | This document |
