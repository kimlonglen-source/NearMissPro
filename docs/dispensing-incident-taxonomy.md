# Dispensing Incident Taxonomy (NZ community pharmacy)

Canonical list seeded into `checkbox_options` by `supabase/migrate_workflow_stage.sql`.
**Scope: dispensing incidents only.** Vaccination, OTC sales, system/IT failures, and
procedural/privacy breaches are out of scope.

Labels use plain bench English — no training needed to recognise any chip.

## Layer 1 — workflow stage (`error_step`)

| Stage | Used when |
|---|---|
| Script entered into PMS | Data entry of a prescription into the dispensing software |
| Drug picked from shelf | Selection of the medication from stock |
| Counted / measured | Counting tablets or measuring a liquid |
| Label generated | Any issue that originated at label-print stage |
| Final check (pharmacist) | Pharmacist's final verification step |
| Bagging / handed to patient | Assembly and handover |
| Controlled drug dispensing | CD-specific register / witness / safe issues |
| Compliance pack packing | Weekly blister / sachet packing |

## Layer 2 — sub-errors

Top 6–8 per stage are default-visible. Rarer items reveal under "More…".

### Script entered into PMS
Wrong patient · Wrong drug entered · Wrong strength entered · Wrong directions · Wrong quantity entered · Repeat dispensed too early · Allergy missed or overridden · Interaction missed · Wrong frequency · Wrong route · Repeat overdue (continuity gap) · Duplicate therapy missed · Renal or hepatic dose adjustment missed · Paediatric dose error · Geriatric dose error · Pregnancy or breastfeeding category missed · Pharmac Special Authority not checked · Wrong Pharmac brand supplied · NHI / HPI mismatch · Wrong subsidy code · PSO treated as patient script · NZePS prescription not actioned · Out-of-date prescription (>6 months) · Forged or altered prescription accepted · Verbal or phone order misheard · Faxed prescription misread · Hospital discharge misinterpreted

### Drug picked from shelf
Wrong drug — look-alike packaging · Wrong drug — sound-alike name · Wrong strength picked · Wrong formulation picked · Expired stock · Damaged tablets · Wrong brand (bioequivalence) · Wrong pack size · Recalled stock dispensed · Section 29 documentation issue

### Counted / measured
Wrong quantity counted · Wrong volume measured (liquid) · Mixed strengths in same container · Tablet-splitting error · Cross-contamination during counting · Compounding calculation error · Wrong diluent or base in compound · Wrong concentration in compound

### Label generated
Typo on label · Missing CAL (cautionary advisory label) · Wrong CAL applied · Label on wrong item / wrong bottle · Missing label entirely · Wrong dispensed date · Wrong expiry on label · Pharmacist initials missing

*Note: Data errors that originated in PMS entry (wrong drug/strength/directions/quantity/frequency/route/patient) are logged under "Script entered into PMS" where they originated, not here — avoids duplication.*

### Final check (pharmacist)
Pharmacist missed an upstream error · Wrong item presented for check · Documentation incomplete · Check bypassed during peak

### Bagging / handed to patient
Wrong patient given the bag · Bag mixed up between patients · Bag missing an item · Bag contains extra item · Counselling missed · Counselling incorrect · New-medicine counselling missed · Inhaler or device technique not shown · Driving or alcohol warning missed · ID not checked for CD pickup

### Controlled drug dispensing
CD register entry missed · CD second-check skipped · CD dispensed early · Methadone wrong dose dispensed · Methadone observed dose not witnessed · CD safe left unlocked · CD destroyed without proper witness · Out-of-date CD prescription dispensed

### Compliance pack packing
Wrong day / time slot · Wrong drug in pack · Wrong patient's pack · Missing dose from pack · Extra dose in pack

## Layer 3 — conditional capture (optional)

Triggered when the selected sub-error implies one of these details:

| Trigger contains | Fields shown | Columns written |
|---|---|---|
| "drug" | Intended drug, Given drug (autocomplete + PHI-scanned free-text fallback) | `drug_name`, `dispensed_drug` |
| "strength" | Intended strength, Given strength | `prescribed_strength`, `dispensed_strength` |
| "quantity" or "volume" | Intended qty, Counted qty (numeric) | `prescribed_quantity`, `dispensed_quantity` |
| "formulation" | Intended → Given dropdown | `correct_formulation`, `dispensed_formulation` |

All Layer 3 fields are optional — fast-path submission never requires typing.
