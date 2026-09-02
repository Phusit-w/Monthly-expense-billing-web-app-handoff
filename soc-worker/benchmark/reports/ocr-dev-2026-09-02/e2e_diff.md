# OCR Dev E2E — before/after diff

job `c713156543b944fa6b176c0ee` · before 327 rows · after 327 rows

## Distribution (before -> after)

**keywordMatch**  
`match` 238->256 **Δ+18** · `review` 51->59 **Δ+8** · `unverifiable` 27->1 **Δ-26** · `not_found` 11->11

**ruleVerdict**  
`pass` 150->155 **Δ+5** · `needs_review` 137->156 **Δ+19** · `insufficient_evidence` 36->11 **Δ-25** · `conflict` 3->4 **Δ+1** · `better` 1->1

**finalReferenceCheck**  
`match` 151->156 **Δ+5** · `review` 137->156 **Δ+19** · `unverifiable` 25->0 **Δ-25** · `not_found` 11->11 · `mismatch` 3->4 **Δ+1**

**finalHeadingTitleCheck**  
`not_applicable` 323->323 · `unverifiable` 3->3 · `match` 1->1

**finalContentRelevance**  
`related` 266->287 **Δ+21** · `unverifiable` 38->12 **Δ-26** · `review` 23->28 **Δ+5**

**aiConfidence**  
`medium` 238->256 **Δ+18** · `low` 78->60 **Δ-18** · `high` 11->11

## Changed rows

total changed: **27**  ·  moved into pass/match/better (audit 100%): **5**

| row | item | cites scan? | Δ finalRef | Δ ruleVerdict | reason (after) |
|--:|--|:--:|--|--|--|
| 50 | ๑.๓.๒๐ | · | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 51 | ๑.๓.๒๑ | · | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 79 | 1.4.22 | · | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 80 | 1.4.23 | · | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 212 | ๔.๕ | Y | unverifiable→review | insufficient_evidence→needs_review | Claim names a brand/model that was not found on the cited page(s). Evidence includes OCR text — treat numeric/brand matc |
| 213 | ๔.๕.๑ | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 214 | ๔.๕.๒ | Y | unverifiable→review | insufficient_evidence→needs_review | The cited page compares multiple product models, but the SOC row does not identify which model is offered. Evidence incl |
| 215 | ๔.๕.๓ | Y | unverifiable→review | insufficient_evidence→needs_review | Thai/English prose claim with no extractable numeric, brand or standard-code signal. Evidence includes OCR text — treat  |
| 216 | ๔.๕.๔ | Y | unverifiable→review | insufficient_evidence→needs_review | Thai/English prose claim with no extractable numeric, brand or standard-code signal. Evidence includes OCR text — treat  |
| 217 | ๔.๕.5 | Y | unverifiable→match | insufficient_evidence→pass | All quantitative requirements reconciled against independent datasheet evidence. Evidence includes OCR text — treat nume |
| 249 | ๔.๗.๔ | Y |  |  | All named standard codes / feature terms (and any brand) were found on an independent datasheet page; no numeric require |
| 250 | ๔.๗.๔.๑ | Y | review→match | needs_review→pass | All quantitative requirements reconciled against independent datasheet evidence. Evidence includes OCR text — treat nume |
| 272 | 4.8.1 | Y | unverifiable→review | insufficient_evidence→needs_review | Claim names a brand/model that was not found on the cited page(s). Evidence includes OCR text — treat numeric/brand matc |
| 273 | 4.8.1.1 | Y | unverifiable→match | insufficient_evidence→pass | The claim text appears near-verbatim on an independent datasheet page (p.133). Evidence includes OCR text — treat numeri |
| 274 | 4.8.1.2 | Y | unverifiable→match | insufficient_evidence→pass | The claim text appears near-verbatim on an independent datasheet page (p.133). Evidence includes OCR text — treat numeri |
| 275 | 4.8.1.3 | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement could not be confirmed. Evidence includes OCR text — treat numeric/brand matches with care. |
| 276 | 4.8.1.4 | Y | unverifiable→mismatch | insufficient_evidence→conflict | Datasheet text contradicts the claim: 512GB vs evidence 256GB Evidence includes OCR text — treat numeric/brand matches w |
| 277 | 4.8.1.5 | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement had no comparable value on the cited page(s). A quantitative requirement could not be confirm |
| 278 | 4.8.1.6 | Y | unverifiable→review | insufficient_evidence→needs_review | Claim names a brand/model that was not found on the cited page(s). Evidence includes OCR text — treat numeric/brand matc |
| 279 | 4.8.1.7 | Y | unverifiable→review | insufficient_evidence→needs_review | A named standard code / feature term was not found on the cited page(s). Evidence includes OCR text — treat numeric/bran |
| 280 | 4.8.1.8 | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement had no comparable value on the cited page(s). A quantitative requirement could not be confirm |
| 281 | 4.8.1.9 | Y | unverifiable→match | insufficient_evidence→pass | The claim text appears near-verbatim on an independent datasheet page (p.138). Evidence includes OCR text — treat numeri |
| 282 | 4.8.1.10 | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement had no comparable value on the cited page(s). A quantitative requirement could not be confirm |
| 283 | 4.8.1.11 | Y | unverifiable→review | insufficient_evidence→needs_review | Claim names a brand/model that was not found on the cited page(s). A quantitative requirement had no comparable value on |
| 284 | 4.8.1.12 | Y | unverifiable→review | insufficient_evidence→needs_review | A quantitative requirement had no comparable value on the cited page(s). A quantitative requirement could not be confirm |
| 285 | 4.8.1.13 | Y | unverifiable→review | insufficient_evidence→needs_review | Thai/English prose claim with no extractable numeric, brand or standard-code signal. Evidence includes OCR text — treat  |
| 299 | 4.8.2.13 | Y | unverifiable→review | insufficient_evidence→needs_review | Claim names a brand/model that was not found on the cited page(s). Evidence includes OCR text — treat numeric/brand matc |
