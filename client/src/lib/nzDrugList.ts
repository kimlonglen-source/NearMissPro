// Commonly-dispensed NZ community-pharmacy drugs (active substance names).
// Used as the second-tier autocomplete for the Record form — the first tier
// is the pharmacy's own usage history (stored in localStorage). This list
// fills the gap when a pharmacy's local history doesn't yet contain a drug
// that's being typed for the first time.
//
// Aligned to Pharmac Schedule (most-dispensed funded medicines) plus common
// OTC/private items, broadened to ~450 active substances across every major
// therapeutic area. Not exhaustive — staff can still type any drug name
// freely; this only powers suggestions and the "not in NZ drug list" hint.

export const NZ_DRUG_LIST: string[] = [
  // Analgesics
  'Paracetamol', 'Ibuprofen', 'Aspirin', 'Diclofenac', 'Naproxen', 'Codeine',
  'Tramadol', 'Morphine', 'Oxycodone', 'Methadone', 'Buprenorphine', 'Fentanyl',
  // Antibiotics
  'Amoxicillin', 'Amoxicillin clavulanate', 'Flucloxacillin', 'Cefalexin', 'Cephalexin',
  'Doxycycline', 'Trimethoprim', 'Nitrofurantoin', 'Erythromycin', 'Azithromycin',
  'Roxithromycin', 'Clarithromycin', 'Metronidazole', 'Ciprofloxacin', 'Cefaclor',
  // Cardiovascular
  'Atorvastatin', 'Simvastatin', 'Rosuvastatin', 'Pravastatin',
  'Amlodipine', 'Felodipine', 'Diltiazem', 'Verapamil',
  'Metoprolol', 'Bisoprolol', 'Atenolol', 'Carvedilol', 'Propranolol',
  'Quinapril', 'Cilazapril', 'Lisinopril', 'Enalapril', 'Perindopril',
  'Losartan', 'Candesartan', 'Valsartan', 'Telmisartan', 'Irbesartan',
  'Furosemide', 'Bumetanide', 'Bendrofluazide', 'Bendroflumethiazide', 'Spironolactone',
  'Indapamide', 'Hydrochlorothiazide', 'Doxazosin',
  'Digoxin', 'Amiodarone', 'Sotalol', 'Flecainide',
  // Anticoagulants
  'Warfarin', 'Dabigatran', 'Rivaroxaban', 'Apixaban', 'Enoxaparin', 'Heparin',
  'Aspirin', 'Clopidogrel', 'Ticagrelor', 'Prasugrel',
  // Diabetes
  'Metformin', 'Gliclazide', 'Glipizide', 'Glibenclamide',
  'Insulin', 'Insulin glargine', 'Insulin aspart', 'Insulin lispro', 'Insulin detemir',
  'Empagliflozin', 'Dapagliflozin', 'Sitagliptin', 'Vildagliptin', 'Linagliptin',
  // Respiratory
  'Salbutamol', 'Terbutaline', 'Ipratropium', 'Tiotropium',
  'Fluticasone', 'Beclometasone', 'Beclomethasone', 'Budesonide', 'Ciclesonide',
  'Salmeterol', 'Formoterol', 'Vilanterol',
  'Montelukast', 'Theophylline',
  'Loratadine', 'Cetirizine', 'Fexofenadine', 'Promethazine',
  // GI
  'Omeprazole', 'Pantoprazole', 'Lansoprazole', 'Rabeprazole', 'Esomeprazole',
  'Ranitidine', 'Famotidine', 'Domperidone', 'Metoclopramide', 'Ondansetron',
  'Loperamide', 'Lactulose', 'Macrogol', 'Bisacodyl', 'Senna',
  // CNS / Psychiatric
  'Citalopram', 'Escitalopram', 'Sertraline', 'Fluoxetine', 'Paroxetine',
  'Venlafaxine', 'Duloxetine', 'Mirtazapine', 'Bupropion', 'Amitriptyline',
  'Nortriptyline', 'Doxepin',
  'Quetiapine', 'Risperidone', 'Olanzapine', 'Clozapine', 'Aripiprazole', 'Haloperidol',
  'Diazepam', 'Lorazepam', 'Oxazepam', 'Temazepam', 'Zopiclone', 'Melatonin',
  'Gabapentin', 'Pregabalin', 'Carbamazepine', 'Lamotrigine', 'Sodium valproate', 'Phenytoin',
  'Topiramate', 'Levetiracetam',
  'Lithium', 'Methylphenidate', 'Atomoxetine',
  // Neurology
  'Levodopa', 'Carbidopa', 'Madopar', 'Sinemet', 'Pramipexole', 'Ropinirole',
  'Donepezil', 'Memantine', 'Rivastigmine',
  // Endocrine
  'Levothyroxine', 'Carbimazole',
  'Prednisone', 'Prednisolone', 'Hydrocortisone', 'Dexamethasone',
  'Alendronate', 'Risedronate', 'Denosumab',
  'Calcium', 'Cholecalciferol', 'Vitamin D',
  // Urology
  'Tamsulosin', 'Finasteride', 'Dutasteride', 'Sildenafil', 'Tadalafil',
  'Solifenacin', 'Oxybutynin',
  // Gout / Rheumatology
  'Allopurinol', 'Colchicine', 'Methotrexate', 'Sulfasalazine', 'Hydroxychloroquine',
  // Skin
  'Hydrocortisone cream', 'Betamethasone', 'Mometasone', 'Clobetasone',
  'Aciclovir', 'Acyclovir', 'Valaciclovir',
  // Eye
  'Latanoprost', 'Timolol', 'Brimonidine', 'Dorzolamide', 'Chloramphenicol',
  // Migraine
  'Sumatriptan', 'Rizatriptan',
  // Specialised / High-risk
  'Cyclosporin', 'Cyclosporine', 'Tacrolimus', 'Azathioprine',
  'Tamoxifen', 'Anastrozole', 'Letrozole',
  // Smoking cessation / Addiction
  'Nicotine', 'Varenicline', 'Naltrexone',
  // Vaccines / Other common
  'Iron', 'Ferrous sulfate', 'Ferrous fumarate', 'Folic acid', 'Vitamin B12', 'Cyanocobalamin',
  'Magnesium', 'Potassium', 'Sodium chloride',

  // ── Expanded coverage (NZ community pharmacy) ──────────────────────
  // Penicillins & related antibiotics
  'Phenoxymethylpenicillin', 'Benzylpenicillin', 'Benzathine penicillin',
  'Ampicillin', 'Dicloxacillin',
  'Cefuroxime', 'Cefixime', 'Ceftriaxone', 'Cefazolin',
  'Clindamycin', 'Lincomycin', 'Vancomycin',
  'Gentamicin', 'Tobramycin', 'Neomycin', 'Framycetin',
  'Norfloxacin', 'Ofloxacin', 'Levofloxacin', 'Moxifloxacin',
  'Co-trimoxazole', 'Sulfamethoxazole', 'Tinidazole', 'Ornidazole',
  'Fusidic acid', 'Mupirocin', 'Fosfomycin',
  'Rifampicin', 'Rifaximin', 'Isoniazid', 'Ethambutol', 'Pyrazinamide', 'Dapsone',
  // Antifungals
  'Fluconazole', 'Itraconazole', 'Voriconazole', 'Posaconazole',
  'Terbinafine', 'Griseofulvin', 'Nystatin', 'Amphotericin',
  'Clotrimazole', 'Miconazole', 'Ketoconazole', 'Econazole', 'Amorolfine',
  // Antivirals
  'Famciclovir', 'Oseltamivir', 'Zanamivir', 'Entecavir', 'Ribavirin',
  'Tenofovir', 'Emtricitabine', 'Lamivudine', 'Abacavir', 'Dolutegravir', 'Efavirenz',
  // Antimalarials / travel
  'Chloroquine', 'Mefloquine', 'Proguanil', 'Atovaquone', 'Primaquine', 'Quinine',
  // Cardiovascular — ACE / ARB / other antihypertensives
  'Ramipril', 'Trandolapril', 'Fosinopril', 'Captopril', 'Benazepril',
  'Olmesartan', 'Eprosartan',
  'Nifedipine', 'Lercanidipine', 'Isradipine', 'Nicardipine',
  'Nebivolol', 'Labetalol', 'Celiprolol', 'Pindolol', 'Nadolol',
  'Hydralazine', 'Methyldopa', 'Clonidine', 'Moxonidine',
  'Prazosin', 'Terazosin', 'Minoxidil',
  // Cardiovascular — nitrates / antianginals / antiarrhythmics
  'Isosorbide mononitrate', 'Isosorbide dinitrate', 'Glyceryl trinitrate',
  'Nicorandil', 'Ivabradine', 'Ranolazine', 'Perhexiline',
  'Mexiletine', 'Disopyramide', 'Quinidine', 'Dronedarone', 'Adenosine',
  // Cardiovascular — diuretics / lipid / heart failure
  'Chlortalidone', 'Metolazone', 'Amiloride', 'Triamterene', 'Eplerenone',
  'Ezetimibe', 'Fenofibrate', 'Bezafibrate', 'Gemfibrozil',
  'Colestyramine', 'Colestipol', 'Nicotinic acid', 'Evolocumab', 'Alirocumab',
  'Sacubitril valsartan',
  // Anticoagulant / haematology
  'Edoxaban', 'Fondaparinux', 'Dalteparin', 'Tinzaparin',
  'Tranexamic acid', 'Phytomenadione', 'Vitamin K', 'Protamine',
  'Ferric carboxymaltose', 'Iron sucrose', 'Epoetin', 'Darbepoetin',
  'Filgrastim', 'Pegfilgrastim',
  // Diabetes / endocrine — additional
  'Glimepiride', 'Tolbutamide', 'Acarbose', 'Pioglitazone', 'Repaglinide',
  'Liraglutide', 'Dulaglutide', 'Semaglutide', 'Exenatide',
  'Canagliflozin', 'Saxagliptin', 'Alogliptin',
  'Insulin isophane', 'Insulin degludec', 'Insulin glulisine', 'Glucagon',
  'Liothyronine', 'Propylthiouracil', 'Desmopressin', 'Cabergoline', 'Bromocriptine',
  'Fludrocortisone', 'Methylprednisolone', 'Triamcinolone', 'Cortisone',
  'Testosterone', 'Tibolone', 'Raloxifene', 'Teriparatide',
  'Zoledronic acid', 'Ibandronate', 'Pamidronate', 'Calcitriol', 'Alfacalcidol',
  // Respiratory — additional
  'Umeclidinium', 'Glycopyrronium', 'Aclidinium', 'Indacaterol', 'Olodaterol',
  'Fluticasone furoate', 'Mometasone furoate', 'Sodium cromoglicate', 'Nedocromil',
  'Roflumilast', 'Aminophylline', 'Carbocisteine', 'Bromhexine', 'Guaifenesin',
  'Pseudoephedrine', 'Phenylephrine', 'Xylometazoline', 'Oxymetazoline',
  // Antihistamines — additional
  'Chlorphenamine', 'Dexchlorpheniramine', 'Cyproheptadine', 'Ketotifen',
  'Desloratadine', 'Levocetirizine', 'Diphenhydramine', 'Cinnarizine',
  // GI — additional
  'Sucralfate', 'Misoprostol', 'Mesalazine', 'Balsalazide',
  'Prucalopride', 'Linaclotide', 'Docusate', 'Sodium picosulfate', 'Glycerol',
  'Ispaghula', 'Sterculia', 'Simeticone',
  'Prochlorperazine', 'Cyclizine', 'Hyoscine butylbromide', 'Hyoscine hydrobromide',
  'Mebeverine', 'Peppermint oil', 'Ursodeoxycholic acid', 'Pancreatin',
  'Aprepitant', 'Granisetron', 'Palonosetron',
  // CNS — additional antidepressants / antipsychotics
  'Moclobemide', 'Agomelatine', 'Vortioxetine', 'Trazodone', 'Clomipramine',
  'Imipramine', 'Dosulepin', 'Mianserin', 'Fluvoxamine', 'Desvenlafaxine',
  'Chlorpromazine', 'Trifluoperazine', 'Fluphenazine', 'Pericyazine',
  'Zuclopenthixol', 'Flupentixol', 'Amisulpride', 'Paliperidone', 'Lurasidone',
  'Asenapine', 'Sulpiride', 'Ziprasidone',
  // CNS — benzodiazepines / hypnotics / stimulants
  'Clonazepam', 'Nitrazepam', 'Alprazolam', 'Midazolam', 'Chlordiazepoxide',
  'Zolpidem', 'Buspirone', 'Modafinil', 'Dexamfetamine', 'Lisdexamfetamine',
  // Epilepsy — additional
  'Oxcarbazepine', 'Eslicarbazepine', 'Vigabatrin', 'Zonisamide', 'Lacosamide',
  'Perampanel', 'Ethosuximide', 'Phenobarbital', 'Primidone', 'Clobazam', 'Brivaracetam',
  // Neurology — Parkinson's / MS / migraine / spasticity
  'Entacapone', 'Selegiline', 'Rasagiline', 'Amantadine', 'Rotigotine', 'Apomorphine',
  'Benztropine', 'Procyclidine', 'Trihexyphenidyl', 'Riluzole', 'Tetrabenazine',
  'Baclofen', 'Tizanidine', 'Dantrolene',
  'Zolmitriptan', 'Naratriptan', 'Eletriptan', 'Almotriptan', 'Pizotifen',
  'Ergotamine', 'Galantamine', 'Nimodipine',
  // Women's health / contraception / HRT
  'Ethinylestradiol', 'Levonorgestrel', 'Norethisterone', 'Desogestrel',
  'Gestodene', 'Drospirenone', 'Cyproterone', 'Medroxyprogesterone',
  'Etonogestrel', 'Estradiol', 'Estriol', 'Conjugated oestrogens',
  'Ulipristal', 'Clomifene', 'Dydrogesterone', 'Progesterone', 'Danazol',
  // Urology — additional
  'Alfuzosin', 'Silodosin', 'Tolterodine', 'Fesoterodine', 'Darifenacin',
  'Trospium', 'Mirabegron', 'Vardenafil', 'Avanafil',
  // Eye — additional
  'Bimatoprost', 'Travoprost', 'Tafluprost', 'Betaxolol', 'Levobunolol',
  'Brinzolamide', 'Pilocarpine', 'Acetazolamide', 'Apraclonidine',
  'Ketorolac', 'Olopatadine', 'Fluorometholone', 'Cyclopentolate', 'Atropine',
  'Tropicamide', 'Hypromellose', 'Carmellose', 'Polyvinyl alcohol',
  // Ear / nose
  'Azelastine',
  // Skin / dermatology — additional
  'Calcipotriol', 'Tacalcitol', 'Coal tar', 'Dithranol', 'Salicylic acid',
  'Isotretinoin', 'Tretinoin', 'Adapalene', 'Benzoyl peroxide', 'Azelaic acid',
  'Ivermectin', 'Permethrin', 'Malathion', 'Crotamiton', 'Podophyllotoxin',
  'Imiquimod', 'Pimecrolimus', 'Clobetasol',
  'Fluocinolone', 'Desonide', 'Urea', 'Silver sulfadiazine',
  'Selenium sulfide',
  // Gout / rheumatology / immunology — additional
  'Febuxostat', 'Probenecid', 'Benzbromarone', 'Leflunomide', 'Penicillamine',
  'Mycophenolate', 'Sirolimus', 'Everolimus', 'Ciclosporin',
  'Etanercept', 'Adalimumab', 'Infliximab', 'Golimumab', 'Certolizumab',
  'Tocilizumab', 'Rituximab', 'Abatacept', 'Tofacitinib', 'Baricitinib',
  'Upadacitinib', 'Secukinumab', 'Ustekinumab', 'Apremilast', 'Anakinra',
  // Oncology / hormone therapy — additional
  'Exemestane', 'Fulvestrant', 'Bicalutamide', 'Flutamide', 'Goserelin',
  'Leuprorelin', 'Triptorelin', 'Abiraterone', 'Enzalutamide',
  'Imatinib', 'Nilotinib', 'Dasatinib', 'Erlotinib', 'Capecitabine',
  'Hydroxycarbamide', 'Mercaptopurine', 'Chlorambucil', 'Melphalan',
  'Temozolomide', 'Lenalidomide', 'Cyclophosphamide',
  // Anaesthetics / analgesia adjuncts
  'Lidocaine', 'Lignocaine', 'Bupivacaine', 'Prilocaine', 'Benzocaine',
  'Tapentadol', 'Ketamine', 'Nefopam',
  // Emergency / reversal / antidotes
  'Adrenaline', 'Naloxone', 'Flumazenil', 'Acetylcysteine',
  // Renal / electrolyte binders
  'Sevelamer', 'Calcium acetate', 'Lanthanum', 'Cinacalcet',
  'Sodium polystyrene sulfonate', 'Calcium polystyrene sulfonate',
  // Vitamins / supplements / OTC
  'Ascorbic acid', 'Thiamine', 'Pyridoxine', 'Riboflavin', 'Nicotinamide',
  'Biotin', 'Vitamin E', 'Vitamin A', 'Coenzyme Q10', 'Glucosamine',
  'Chondroitin', 'Fish oil', 'Zinc', 'Multivitamin', 'Electrolytes',
  'Oral rehydration salts',
  // Vaccines commonly given in NZ pharmacies
  'Influenza vaccine', 'Pneumococcal vaccine', 'Zoster vaccine',
  'Boostrix', 'Gardasil', 'MMR vaccine', 'COVID-19 vaccine',

  // ── More common NZ generics (gap-fill) ─────────────────────────────
  // Additional NSAIDs
  'Tenoxicam', 'Meloxicam', 'Piroxicam', 'Celecoxib', 'Etoricoxib',
  'Ketoprofen', 'Mefenamic acid', 'Indomethacin', 'Sulindac',
  // Other commonly-dispensed items that were missing
  'Betahistine', 'Orphenadrine', 'Dipyridamole', 'Hydroxyzine', 'Doxylamine',
  'Chlorhexidine', 'Sodium bicarbonate', 'Glucose', 'Potassium citrate',

  // ── Common NZ brand names ──────────────────────────────────────────
  // Staff often type the brand rather than the generic. This is a starter
  // set of the most-dispensed / OTC brands — NOT exhaustive (Pharmac brands
  // change, and the app also remembers any brand your team types). Includes
  // known sound-alike / look-alike pairs (e.g. Allergron/Allersoothe).
  'Allergron', 'Allersoothe', 'Phenergan',
  // OTC
  'Panadol', 'Nurofen', 'Voltaren', 'Telfast', 'Claratyne', 'Zyrtec',
  'Gaviscon', 'Mylanta', 'Berocca', 'Codral', 'Lemsip', 'Canesten',
  'Lamisil', 'Daktarin', 'Betadine', 'Panadeine',
  // NSAID brands
  'Tilcotil', 'Mobic', 'Celebrex', 'Arcoxia', 'Ponstan',
  // Respiratory
  'Ventolin', 'Bricanyl', 'Atrovent', 'Seretide', 'Symbicort', 'Flixotide',
  'Serevent', 'Pulmicort', 'Spiriva',
  'Beclazone', 'Qvar', 'Breo', 'Anoro', 'Trelegy', 'Ultibro', 'Spiolto',
  'Onbrez', 'Seebri', 'Incruse', 'Relvar', 'Oxis', 'Foradil', 'Vannair',
  // GI
  'Losec', 'Somac', 'Nexium', 'Zoton', 'Motilium', 'Maxolon', 'Buscopan',
  'Movicol', 'Coloxyl', 'Laxsol', 'Dulcolax',
  // Cardiovascular
  'Cardizem', 'Betaloc', 'Noten', 'Coversyl', 'Inhibace', 'Cozaar', 'Diovan',
  'Lipex', 'Crestor', 'Lipitor', 'Marevan', 'Cartia', 'Plavix',
  // Anticoagulant (newer)
  'Pradaxa', 'Xarelto', 'Eliquis',
  // Diabetes
  'Diamicron', 'Glucophage', 'Jardiance', 'Trajenta', 'Januvia',
  'Lantus', 'Levemir', 'NovoRapid', 'Humalog', 'Protaphane', 'Actrapid',
  // CNS / psychiatric
  'Prozac', 'Aropax', 'Cipramil', 'Lexapro', 'Efexor', 'Zoloft',
  'Valium', 'Rivotril', 'Imovane', 'Seroquel', 'Zyprexa',
  'Neurontin', 'Lyrica', 'Epilim', 'Tegretol', 'Lamictal',
  // Pain / opioids
  'Tramal', 'Sevredol', 'm-Eslon', 'OxyContin', 'OxyNorm',
  // Antibiotics
  'Amoxil', 'Augmentin', 'Klacid', 'Zithromax', 'Flagyl', 'Keflex',
  // Thyroid / bone / gout / eye / migraine
  'Eltroxin', 'Fosamax', 'Actonel', 'Prolia', 'Zyloprim', 'Xalatan', 'Imigran',
  // Contraceptives / HRT
  'Microgynon', 'Yasmin', 'Loette', 'Levlen', 'Marvelon', 'Mercilon',
  'Jadelle', 'Mirena', 'Depo-Provera',
];

// Lowercase set for fast lookup. Built once at module load.
const NZ_DRUG_SET = new Set(NZ_DRUG_LIST.map(d => d.toLowerCase()));

/** True if the drug name appears in the bundled NZ list (case-insensitive). */
export function isKnownNzDrug(name: string): boolean {
  if (!name) return false;
  return NZ_DRUG_SET.has(name.trim().toLowerCase());
}

/**
 * Score each NZ drug for autocomplete relevance against the user's query.
 * Returns the top N matches sorted: prefix matches first, then contains.
 */
export function searchNzDrugs(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const drug of NZ_DRUG_LIST) {
    const lower = drug.toLowerCase();
    if (lower.startsWith(q)) prefix.push(drug);
    else if (lower.includes(q)) contains.push(drug);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

// ── Pharmacy-local history (localStorage) ────────────────────────────
// Drugs the staff at this pharmacy have logged before, in order of most-recent-first.
// Used as the FIRST tier of autocomplete so canonical spelling propagates from
// internal usage rather than the bundled list.

const HISTORY_KEY = 'nmp.drug_history.v1';
const HISTORY_LIMIT = 100;

export function readDrugHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}

export function recordDrugInHistory(name: string) {
  if (!name || !name.trim()) return;
  const clean = name.trim();
  const existing = readDrugHistory();
  // De-dupe case-insensitively but keep the user's original casing on first entry.
  const lower = clean.toLowerCase();
  const filtered = existing.filter(s => s.toLowerCase() !== lower);
  const next = [clean, ...filtered].slice(0, HISTORY_LIMIT);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

export function searchDrugHistory(query: string, limit = 5): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const history = readDrugHistory();
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const drug of history) {
    const lower = drug.toLowerCase();
    if (lower.startsWith(q)) prefix.push(drug);
    else if (lower.includes(q)) contains.push(drug);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}
