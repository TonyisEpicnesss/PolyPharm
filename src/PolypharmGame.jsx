import React, { useState, useEffect, useMemo } from "react";

/* ============================================================================
   POLYPHARM  —  a psychiatric drug-drug interaction card game
   Built for USMLE Step 2 CK / clerkship-level high-yield content.

   Two interaction axes:
     AXIS 1  CLEARANCE   how the drug leaves the body, and what blocks that
     AXIS 2  PD TYPE     what the drug does at receptors, and what stacks

   All content is clerkship high-yield. Specific CYP isoenzyme identities are
   deliberately omitted (not tested); drugs are typed only as inhibitor,
   inducer, or substrate.
   ============================================================================ */

/* ------------------------------------------------------------------ storage */
/* Tries the artifact persistence API, falls back to memory. When you self-host,
   swap the body of these two functions for localStorage. */
const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private browsing or quota full: play on without saving */
    }
  },
};

/* ------------------------------------------------------------- PD type chart */
const PD_TYPES = {
  SER: { label: "Serotonergic", color: "rose" },
  QT: { label: "QT prolonging", color: "red" },
  ACH: { label: "Anticholinergic", color: "violet" },
  SED: { label: "Sedating", color: "blue" },
  DA: { label: "Dopamine blocking", color: "teal" },
  SZ: { label: "Lowers seizure threshold", color: "amber" },
};

/* symmetric 6x6. kind: syndrome | additive | protective | none */
const PD_MATRIX = {
  "SER|SER": { kind: "syndrome", name: "Serotonin syndrome", note: "Clonus, hyperreflexia, agitation, hyperthermia, diarrhea. Lower limbs worse than upper. Treat with cyproheptadine." },
  "QT|QT": { kind: "syndrome", name: "Torsades de pointes", note: "Polymorphic VT on a prolonged QT. Treat with IV magnesium." },
  "ACH|ACH": { kind: "syndrome", name: "Anticholinergic toxidrome", note: "Hot as a hare, dry as a bone, red as a beet, blind as a bat, mad as a hatter. Treat with physostigmine." },
  "DA|DA": { kind: "syndrome", name: "EPS and NMS risk", note: "Lead-pipe rigidity, hyperthermia, autonomic instability, elevated CK. Treat with dantrolene or bromocriptine." },
  "SZ|SZ": { kind: "syndrome", name: "Seizure", note: "Additive lowering of the seizure threshold. Bupropion plus tramadol is the classic pairing." },

  "ACH|DA": { kind: "protective", name: "Anticholinergic treats EPS", note: "This is why benztropine is co-prescribed with a high-potency antipsychotic. Works for acute dystonia and parkinsonism, but worsens tardive dyskinesia." },
  "SED|SZ": { kind: "protective", name: "Benzodiazepine raises seizure threshold", note: "Benzodiazepines are anticonvulsants. This combination is protective, not additive." },

  "SER|QT": { kind: "additive", name: "Additive QT prolongation", note: "Several serotonergic agents also prolong QT." },
  "SER|SED": { kind: "additive", name: "Additive sedation", note: "" },
  "SER|DA": { kind: "additive", name: "Increased EPS risk", note: "Serotonergic agents can worsen extrapyramidal symptoms." },
  "SER|SZ": { kind: "additive", name: "Additive seizure risk", note: "" },
  "QT|DA": { kind: "additive", name: "Additive QT prolongation", note: "Many antipsychotics prolong QT in their own right." },
  "ACH|SED": { kind: "additive", name: "Delirium risk", note: "Especially dangerous in older adults." },
  "SED|DA": { kind: "additive", name: "Oversedation", note: "" },
  "DA|SZ": { kind: "additive", name: "Additive seizure risk", note: "Antipsychotics lower the seizure threshold; clozapine does so dose-dependently." },
};

function pdLookup(a, b) {
  return PD_MATRIX[`${a}|${b}`] || PD_MATRIX[`${b}|${a}`] || { kind: "none" };
}

/* ---------------------------------------------------------- clearance routes */
const CLEARANCE = {
  hep: { label: "Liver metabolized", short: "Hepatic", color: "amber" },
  ren: { label: "Renally cleared", short: "Renal", color: "cyan" },
  gluc: { label: "Glucuronidated only", short: "Glucuronidated", color: "lime" },
};

const ROLES = {
  inh: "Enzyme inhibitor",
  ind: "Enzyme inducer",
  renblock: "Blocks renal clearance",
  glucinh: "Blocks glucuronidation",
  pdinh: "Blocks prodrug activation",
};

/* ------------------------------------------------------------------- the deck */
/* eff = what condition this card treats and how strongly
   ti  = therapeutic index 1 (razor thin) to 5 (forgiving)
   fields: contra = instant loss, avoid = heavy penalty, caution = light penalty */

const DRUGS = [
  /* ---------- ward 1 : mood ---------- */
  { id: "sertraline", name: "Sertraline", cls: "SSRI", ward: 1, rar: "common",
    moa: "Blocks the serotonin reuptake transporter, raising synaptic serotonin",
    ind: ["MDD", "OCD", "PTSD", "Panic disorder", "PMDD"],
    se: ["GI upset", "Sexual dysfunction", "Hyponatremia (SIADH)"],
    buzz: "First-line SSRI; safest in cardiac disease and pregnancy",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 4, eff: { depression: 3, gad: 3, panic: 3 }, fields: {} },

  { id: "escitalopram", name: "Escitalopram", cls: "SSRI", ward: 1, rar: "common",
    moa: "Blocks the serotonin reuptake transporter (S-enantiomer of citalopram)",
    ind: ["MDD", "GAD"],
    se: ["Sexual dysfunction", "Hyponatremia", "Nausea"],
    buzz: "Cleanest SSRI interaction profile",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 4, eff: { depression: 3, gad: 3, panic: 3 }, fields: {} },

  { id: "citalopram", name: "Citalopram", cls: "SSRI", ward: 1, rar: "uncommon",
    moa: "Blocks the serotonin reuptake transporter",
    ind: ["MDD"],
    se: ["Dose-dependent QT prolongation", "Sexual dysfunction"],
    buzz: "The SSRI with an FDA dose ceiling for QT: 40 mg, or 20 mg if elderly or hepatically impaired",
    antidep: true, pd: ["SER", "QT"], clr: "hep", role: null, ti: 3, eff: { depression: 3 }, fields: { geriatric: "caution", qt: "avoid" } },

  { id: "fluoxetine", name: "Fluoxetine", cls: "SSRI", ward: 1, rar: "uncommon",
    moa: "Blocks the serotonin reuptake transporter; long half-life active metabolite",
    ind: ["MDD", "OCD", "Bulimia nervosa", "Panic disorder"],
    se: ["Insomnia", "Sexual dysfunction", "Activation"],
    buzz: "Longest half-life SSRI, so it needs a 5-week washout before an MAOI",
    antidep: true, pd: ["SER"], clr: "hep", role: "pdinh", ti: 3, eff: { depression: 3 }, fields: {}, washout: 5 },

  { id: "paroxetine", name: "Paroxetine", cls: "SSRI", ward: 1, rar: "uncommon",
    moa: "Blocks the serotonin reuptake transporter; also antimuscarinic",
    ind: ["MDD", "Social anxiety disorder", "Panic disorder"],
    se: ["Weight gain", "Sedation", "Worst discontinuation syndrome", "Anticholinergic effects"],
    buzz: "Most anticholinergic and most sedating SSRI; shortest half-life so worst withdrawal",
    antidep: true, pd: ["SER", "ACH"], clr: "hep", role: "pdinh", ti: 3, eff: { depression: 3, gad: 3, panic: 2 }, fields: { pregnancy: "avoid", geriatric: "avoid" } },

  { id: "venlafaxine", name: "Venlafaxine", cls: "SNRI", ward: 1, rar: "common",
    moa: "Blocks serotonin and norepinephrine reuptake",
    ind: ["MDD", "GAD", "Neuropathic pain"],
    se: ["Dose-dependent hypertension", "Discontinuation syndrome", "Diaphoresis"],
    buzz: "Check the blood pressure; it climbs at higher doses",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 3, eff: { depression: 3, gad: 3, panic: 2 }, fields: {} },

  { id: "duloxetine", name: "Duloxetine", cls: "SNRI", ward: 1, rar: "common",
    moa: "Blocks serotonin and norepinephrine reuptake",
    ind: ["MDD", "GAD", "Diabetic neuropathy", "Fibromyalgia"],
    se: ["Hepatotoxicity", "Nausea", "Dry mouth"],
    buzz: "Approved for both depression and chronic musculoskeletal pain, so it treats both problems with one drug",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 3, eff: { depression: 3, gad: 3, pain: 3 }, fields: { hepatic: "avoid" } },

  { id: "bupropion", name: "Bupropion", cls: "NDRI", ward: 1, rar: "uncommon",
    moa: "Blocks norepinephrine and dopamine reuptake; no serotonergic activity",
    ind: ["MDD", "Smoking cessation", "Seasonal affective disorder"],
    se: ["Lowers seizure threshold", "Insomnia", "Weight loss"],
    buzz: "No sexual dysfunction and no weight gain, but contraindicated in eating disorders and seizure history",
    antidep: true, pd: ["SZ"], clr: "hep", role: "pdinh", ti: 3, eff: { depression: 3 }, fields: { eating_disorder: "contra", seizure_hx: "contra" } },

  { id: "mirtazapine", name: "Mirtazapine", cls: "Alpha-2 antagonist", ward: 1, rar: "common",
    moa: "Blocks presynaptic alpha-2 autoreceptors, increasing NE and serotonin release; potent H1 blocker",
    ind: ["MDD", "MDD with insomnia or poor appetite", "Anxiety with insomnia"],
    se: ["Weight gain", "Sedation", "Increased appetite"],
    buzz: "The antidepressant you choose for the thin, sleepless, elderly depressed patient",
    antidep: true, sedTier: "mild", pd: ["SER", "SED"], clr: "hep", role: null, ti: 4, eff: { depression: 3, gad: 2, insomnia: 2 }, fields: {} },

  { id: "trazodone", name: "Trazodone", cls: "SARI", ward: 1, rar: "common",
    moa: "Serotonin antagonist and reuptake inhibitor; strong H1 and alpha-1 blockade",
    ind: ["Insomnia", "MDD (higher doses)"],
    se: ["Priapism", "Orthostatic hypotension", "Sedation"],
    buzz: "Priapism is the board answer. Widely used for sleep, but the AASM suggests against it for insomnia and it is Beers-listed in older adults.",
    antidep: true, sedTier: "mild", beersInsomnia: true, pd: ["SER", "SED"], clr: "hep", role: null, ti: 4, eff: { insomnia: 2, depression: 1 }, fields: { geriatric: "avoid" } },

  /* ---------- ward 2 : anxiety and sleep ---------- */
  { id: "lorazepam", name: "Lorazepam", cls: "Benzodiazepine", ward: 2, rar: "common",
    moa: "Increases the FREQUENCY of GABA-A chloride channel opening",
    ind: ["Acute anxiety", "Status epilepticus", "Alcohol withdrawal", "Catatonia"],
    se: ["Sedation", "Dependence", "Falls", "Anterograde amnesia"],
    buzz: "L in LOT: glucuronidated only, so it is safe in liver failure",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "gluc", role: null, ti: 3, eff: { gad: 3, panic: 3, insomnia: 2, agitation: 3, etoh_wd: 3 }, fields: { geriatric: "avoid" } },

  { id: "oxazepam", name: "Oxazepam", cls: "Benzodiazepine", ward: 2, rar: "common",
    moa: "Increases the FREQUENCY of GABA-A chloride channel opening",
    ind: ["Anxiety", "Alcohol withdrawal in liver disease"],
    se: ["Sedation", "Dependence", "Falls"],
    buzz: "O in LOT: glucuronidated only, so it is safe in liver failure",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "gluc", role: null, ti: 3, eff: { gad: 3, panic: 2, agitation: 2, etoh_wd: 3 }, fields: { geriatric: "avoid" } },

  { id: "temazepam", name: "Temazepam", cls: "Benzodiazepine", ward: 2, rar: "common",
    moa: "Increases the FREQUENCY of GABA-A chloride channel opening",
    ind: ["Insomnia"],
    se: ["Sedation", "Dependence", "Falls"],
    buzz: "T in LOT: glucuronidated only, so it is safe in liver failure",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "gluc", role: null, ti: 3, eff: { insomnia: 3, gad: 2 }, fields: { geriatric: "avoid" } },

  { id: "alprazolam", name: "Alprazolam", cls: "Benzodiazepine", ward: 2, rar: "uncommon",
    moa: "Increases the FREQUENCY of GABA-A chloride channel opening",
    ind: ["Panic disorder", "Acute anxiety"],
    se: ["High abuse potential", "Rebound anxiety", "Sedation"],
    buzz: "Short acting and highly reinforcing, so it has the worst dependence profile of the benzodiazepines",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "hep", role: null, ti: 2, eff: { gad: 3, panic: 4 }, fields: { geriatric: "avoid", hepatic: "avoid" } },

  { id: "diazepam", name: "Diazepam", cls: "Benzodiazepine", ward: 2, rar: "uncommon",
    moa: "Increases the FREQUENCY of GABA-A chloride channel opening; long-acting active metabolites",
    ind: ["Alcohol withdrawal", "Muscle spasm", "Status epilepticus"],
    se: ["Prolonged sedation", "Accumulation in the elderly", "Falls"],
    buzz: "Long half-life with active metabolites, so it accumulates badly in older adults",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "hep", role: null, ti: 3, eff: { gad: 3, panic: 3, agitation: 3, etoh_wd: 3 }, fields: { geriatric: "avoid", hepatic: "avoid" } },

  { id: "buspirone", name: "Buspirone", cls: "5-HT1A partial agonist", ward: 2, rar: "common",
    moa: "Partial agonist at 5-HT1A receptors; no GABA activity",
    ind: ["GAD"],
    se: ["Dizziness", "Headache"],
    buzz: "No sedation, no dependence, no withdrawal, but takes 2 weeks to work",
    pd: ["SER"], clr: "hep", role: null, ti: 4, eff: { gad: 3 }, fields: {} },

  { id: "hydroxyzine", name: "Hydroxyzine", cls: "H1 antihistamine", ward: 2, rar: "common",
    moa: "Blocks H1 histamine receptors; also antimuscarinic",
    ind: ["Anxiety", "Pruritus", "Insomnia"],
    se: ["Sedation", "Dry mouth", "QT prolongation at high dose"],
    buzz: "The non-addictive anxiolytic, but the anticholinergic burden makes it a poor choice in the elderly",
    beersInsomnia: true, pd: ["ACH", "SED"], clr: "hep", role: null, ti: 4, eff: { gad: 2, insomnia: 2 }, fields: { geriatric: "avoid" } },

  { id: "zolpidem", name: "Zolpidem", cls: "Non-benzodiazepine hypnotic", ward: 2, rar: "common",
    moa: "Selective agonist at the BZ1 subtype of the GABA-A receptor",
    ind: ["Insomnia"],
    se: ["Complex sleep behaviors", "Next-day sedation", "Falls"],
    buzz: "Sleep-driving and sleep-eating are the board buzzwords",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "hep", role: null, ti: 3, eff: { insomnia: 3 }, fields: { geriatric: "avoid" } },

  { id: "phenobarbital", name: "Phenobarbital", cls: "Barbiturate", ward: 2, rar: "rare",
    moa: "Increases the DURATION of GABA-A chloride channel opening",
    ind: ["Refractory seizures", "Neonatal seizures"],
    se: ["Respiratory depression", "No reversal agent", "Sedation"],
    buzz: "Barbi-DUR-ates increase DURation; fre-BENZO-diazepines increase FREquency. Also a potent enzyme inducer.",
    sedTier: "strong", beersInsomnia: true, pd: ["SED"], clr: "hep", role: "ind", ti: 2, eff: { agitation: 2 }, fields: { geriatric: "avoid" } },

  { id: "flumazenil", name: "Flumazenil", cls: "Benzodiazepine antagonist", ward: 2, rar: "rare",
    moa: "Competitive antagonist at the benzodiazepine binding site on GABA-A",
    ind: ["Benzodiazepine overdose reversal"],
    se: ["Precipitates seizures in chronic benzodiazepine users"],
    buzz: "The antidote that can kill: it triggers withdrawal seizures in dependent patients",
    pd: [], clr: "hep", role: null, ti: 3, eff: {}, fields: {}, antidote: "SED" },

  /* ---------- ward 3 : psychosis ---------- */
  { id: "haloperidol", name: "Haloperidol", cls: "Typical antipsychotic (high potency)", ward: 3, rar: "uncommon",
    moa: "D2 receptor antagonist",
    ind: ["Schizophrenia", "Acute agitation", "Delirium", "Tourette syndrome"],
    se: ["EPS", "Tardive dyskinesia", "NMS", "Hyperprolactinemia", "QT prolongation"],
    buzz: "High potency means high EPS and low anticholinergic effect. IV form prolongs QT most.",
    stabilizer: true, pd: ["DA", "QT"], clr: "hep", role: null, ti: 3, eff: { psychosis: 3, agitation: 3 }, fields: { geriatric: "caution", qt: "avoid" } },

  { id: "chlorpromazine", name: "Chlorpromazine", cls: "Typical antipsychotic (low potency)", ward: 3, rar: "uncommon",
    moa: "D2 receptor antagonist with strong muscarinic, H1 and alpha-1 blockade",
    ind: ["Schizophrenia", "Intractable hiccups"],
    se: ["Corneal and lens deposits", "Orthostatic hypotension", "Sedation", "QT prolongation"],
    buzz: "Corneal deposits for chlorproMAZINE, retinal deposits for thioRIDAZINE",
    stabilizer: true, pd: ["DA", "QT", "ACH", "SED"], clr: "hep", role: null, ti: 3, eff: { psychosis: 3, agitation: 2 }, fields: { geriatric: "avoid", qt: "avoid" } },

  { id: "risperidone", name: "Risperidone", cls: "Atypical antipsychotic", ward: 3, rar: "common",
    moa: "D2 and 5-HT2A receptor antagonist",
    ind: ["Schizophrenia", "Bipolar mania", "Irritability in autism"],
    se: ["Hyperprolactinemia", "EPS at higher doses", "Weight gain"],
    buzz: "Highest prolactin elevation of the atypicals: gynecomastia, galactorrhea, amenorrhea",
    stabilizer: true, pd: ["DA"], clr: "hep", role: null, ti: 3, eff: { psychosis: 3, mania: 2 }, fields: { geriatric: "caution" } },

  { id: "olanzapine", name: "Olanzapine", cls: "Atypical antipsychotic", ward: 3, rar: "common",
    moa: "D2 and 5-HT2A receptor antagonist with muscarinic and H1 blockade",
    ind: ["Schizophrenia", "Bipolar mania", "Acute agitation"],
    se: ["Worst metabolic syndrome", "Weight gain", "Sedation", "Dyslipidemia"],
    buzz: "Most weight gain and metabolic risk of the atypicals. Levels rise when a patient stops smoking.",
    stabilizer: true, pd: ["DA", "SED", "ACH"], clr: "hep", role: null, ti: 4, eff: { psychosis: 3, mania: 3, agitation: 3 }, fields: { geriatric: "caution", smoking_cessation: "caution" } },

  { id: "quetiapine", name: "Quetiapine", cls: "Atypical antipsychotic", ward: 3, rar: "common",
    moa: "D2 and 5-HT2A antagonist with the loosest D2 binding of the class",
    ind: ["Schizophrenia", "Bipolar depression", "Bipolar mania"],
    se: ["Sedation", "Weight gain", "Orthostatic hypotension", "Cataracts"],
    buzz: "Lowest EPS risk, so it is the antipsychotic of choice in Parkinson disease psychosis (with clozapine)",
    stabilizer: true, pd: ["DA", "SED"], clr: "hep", role: null, ti: 4, eff: { psychosis: 3, bipolar_dep: 3, insomnia: 2 }, fields: { geriatric: "caution" } },

  { id: "aripiprazole", name: "Aripiprazole", cls: "Atypical antipsychotic", ward: 3, rar: "common",
    moa: "D2 PARTIAL agonist and 5-HT1A partial agonist",
    ind: ["Schizophrenia", "Bipolar mania", "Adjunct in MDD"],
    se: ["Akathisia", "Insomnia", "Impulse control problems"],
    buzz: "The partial agonist: least weight gain, least prolactin, but the most akathisia",
    stabilizer: true, pd: ["DA"], clr: "hep", role: null, ti: 4, eff: { psychosis: 3, mania: 2, depression: 1 }, fields: {} },

  { id: "ziprasidone", name: "Ziprasidone", cls: "Atypical antipsychotic", ward: 3, rar: "uncommon",
    moa: "D2 and 5-HT2A receptor antagonist",
    ind: ["Schizophrenia", "Bipolar mania"],
    se: ["QT prolongation", "Requires food for absorption"],
    buzz: "Greatest QT prolongation of the atypicals; needs a 500 kcal meal to be absorbed",
    stabilizer: true, pd: ["DA", "QT"], clr: "hep", role: null, ti: 3, eff: { psychosis: 3, mania: 2 }, fields: { qt: "avoid" } },

  { id: "clozapine", name: "Clozapine", cls: "Atypical antipsychotic", ward: 3, rar: "black_box",
    moa: "Weak D2 and strong 5-HT2A antagonist with high D4 affinity",
    ind: ["Treatment-resistant schizophrenia", "Reduces suicidality in schizophrenia"],
    se: ["Agranulocytosis", "Myocarditis", "Dose-dependent seizures", "Sialorrhea", "Metabolic syndrome"],
    buzz: "The only drug proven for treatment-resistant schizophrenia; requires ANC monitoring. Levels rise sharply when a patient quits smoking.",
    stabilizer: true, pd: ["DA", "SED", "ACH", "SZ"], clr: "hep", role: null, ti: 1, eff: { psychosis: 5 }, fields: { geriatric: "avoid", smoking_cessation: "avoid" } },

  { id: "benztropine", name: "Benztropine", cls: "Anticholinergic", ward: 3, rar: "common",
    moa: "Muscarinic receptor antagonist, restoring dopamine-acetylcholine balance in the striatum",
    ind: ["Acute dystonia", "Drug-induced parkinsonism"],
    se: ["Dry mouth", "Constipation", "Urinary retention", "Confusion"],
    buzz: "Treats acute dystonia and parkinsonism but WORSENS tardive dyskinesia",
    pd: ["ACH"], clr: "hep", role: null, ti: 4, eff: { eps: 3 }, fields: { geriatric: "avoid" } },

  { id: "diphenhydramine", name: "Diphenhydramine", cls: "H1 antihistamine", ward: 3, rar: "common",
    moa: "Blocks H1 histamine receptors; also a muscarinic antagonist",
    ind: ["Acute dystonia", "Allergic reactions", "Insomnia"],
    se: ["Sedation", "Anticholinergic effects", "Delirium in the elderly"],
    buzz: "A Beers criteria drug: never a good sleep aid in an older adult",
    beersInsomnia: true, pd: ["ACH", "SED"], clr: "hep", role: null, ti: 4, eff: { eps: 2, insomnia: 2 }, fields: { geriatric: "avoid" } },

  { id: "propranolol", name: "Propranolol", cls: "Non-selective beta blocker", ward: 3, rar: "common",
    moa: "Non-selective beta-adrenergic receptor antagonist",
    ind: ["Akathisia", "Performance anxiety", "Essential tremor", "Lithium tremor"],
    se: ["Bradycardia", "Bronchospasm", "Fatigue"],
    buzz: "First-line for akathisia, and the fix for a lithium-induced tremor",
    pd: [], clr: "hep", role: null, ti: 4, eff: { akathisia: 3 }, fields: { asthma: "contra" } },

  /* ---------- ward 4 : mood stabilizers ---------- */
  { id: "lithium", name: "Lithium", cls: "Mood stabilizer", ward: 4, rar: "black_box",
    moa: "Inhibits inositol monophosphatase and GSK-3, blunting second messenger signaling",
    ind: ["Bipolar I maintenance", "Acute mania", "Reduces suicide risk"],
    se: ["Coarse tremor", "Hypothyroidism", "Nephrogenic diabetes insipidus", "Ebstein anomaly", "Leukocytosis"],
    buzz: "Renally cleared with a razor-thin index. NSAIDs, thiazides and ACE inhibitors all push it into toxicity.",
    stabilizer: true, pd: [], clr: "ren", role: null, ti: 1, eff: { mania: 4, bipolar_maint: 4 }, fields: { pregnancy: "avoid", renal: "contra", geriatric: "caution" } },

  { id: "valproate", name: "Valproate", cls: "Mood stabilizer / anticonvulsant", ward: 4, rar: "rare",
    moa: "Increases GABA availability and blocks voltage-gated sodium channels",
    ind: ["Acute mania", "Mixed episodes", "Seizures", "Migraine prophylaxis"],
    se: ["Hepatotoxicity", "Pancreatitis", "Neural tube defects", "Weight gain", "Alopecia", "Hyperammonemia"],
    buzz: "The single worst psychotropic teratogen. Also inhibits glucuronidation, which is what doubles lamotrigine levels.",
    stabilizer: true, pd: [], clr: "hep", role: "inh", role2: "glucinh", ti: 2, eff: { mania: 4, bipolar_maint: 3 }, fields: { pregnancy: "contra", hepatic: "contra" } },

  { id: "lamotrigine", name: "Lamotrigine", cls: "Mood stabilizer / anticonvulsant", ward: 4, rar: "rare",
    moa: "Blocks voltage-gated sodium channels, reducing glutamate release",
    ind: ["Bipolar depression", "Bipolar maintenance", "Seizures"],
    se: ["Stevens-Johnson syndrome", "Rash", "Headache"],
    buzz: "Titrate slowly or you cause SJS. Glucuronidated only, so valproate doubles its level and inducers halve it.",
    stabilizer: true, pd: [], clr: "gluc", role: null, ti: 2, eff: { bipolar_dep: 4, bipolar_maint: 3 }, fields: {} },

  { id: "carbamazepine", name: "Carbamazepine", cls: "Mood stabilizer / anticonvulsant", ward: 4, rar: "rare",
    moa: "Blocks voltage-gated sodium channels",
    ind: ["Acute mania", "Trigeminal neuralgia", "Focal seizures"],
    se: ["Agranulocytosis", "Aplastic anemia", "SIADH with hyponatremia", "SJS", "Neural tube defects"],
    buzz: "A potent enzyme inducer that induces its own metabolism. Screen for HLA-B*1502 in patients of Asian ancestry.",
    stabilizer: true, pd: [], clr: "hep", role: "ind", ti: 2, eff: { mania: 3, pain: 2 }, fields: { pregnancy: "contra" } },

  { id: "oxcarbazepine", name: "Oxcarbazepine", cls: "Anticonvulsant", ward: 4, rar: "uncommon",
    moa: "Blocks voltage-gated sodium channels",
    ind: ["Focal seizures", "Bipolar disorder (off-label)"],
    se: ["Hyponatremia", "Dizziness", "Rash"],
    buzz: "Less enzyme induction than carbamazepine but more hyponatremia",
    stabilizer: true, pd: [], clr: "hep", role: "ind", ti: 3, eff: { mania: 2 }, fields: { pregnancy: "avoid" } },


  { id: "acetaminophen", name: "Acetaminophen", cls: "Analgesic / antipyretic", ward: 4, rar: "common",
    moa: "Weak central COX inhibition; mechanism still incompletely defined",
    ind: ["Mild to moderate pain", "Fever"],
    se: ["Hepatotoxicity in overdose"],
    buzz: "The analgesic that does not touch renal clearance, so it is the safe choice on lithium. Overdose antidote is N-acetylcysteine.",
    pd: [], clr: "hep", role: null, ti: 4, eff: { pain: 2 }, fields: { hepatic: "caution" } },

  { id: "nystatin", name: "Nystatin", cls: "Polyene antifungal", ward: 5, rar: "common",
    moa: "Binds ergosterol in the fungal membrane and forms pores",
    ind: ["Oral candidiasis", "Esophageal candidiasis"],
    se: ["Minimal; it is barely absorbed"],
    buzz: "Topical and poorly absorbed, which is exactly why it is the answer for thrush in a patient on warfarin",
    pd: [], clr: "hep", role: null, ti: 5, eff: { infection: 3 }, fields: {} },

  /* ---------- ward 5 : consult-liaison ---------- */
  { id: "warfarin", name: "Warfarin", cls: "Anticoagulant", ward: 5, rar: "rare",
    moa: "Inhibits vitamin K epoxide reductase, blocking synthesis of factors II, VII, IX and X",
    ind: ["Atrial fibrillation", "Mechanical valve", "VTE"],
    se: ["Bleeding", "Skin necrosis", "Teratogenic"],
    buzz: "The classic victim drug. Always Think When Outdoors: anti-epileptics, theophylline, WARFARIN, OCPs.",
    pd: [], clr: "hep", role: null, ti: 1, eff: { anticoag: 4 }, fields: { pregnancy: "contra" } },

  { id: "ocp", name: "Combined OCP", cls: "Contraceptive", ward: 5, rar: "common",
    moa: "Estrogen and progestin suppress the LH surge and inhibit ovulation",
    ind: ["Contraception", "Menstrual regulation", "Acne"],
    se: ["VTE risk", "Hypertension", "Breakthrough bleeding"],
    buzz: "An enzyme inducer causes contraceptive failure. This is the classic carbamazepine counseling point.",
    pd: [], clr: "hep", role: null, ti: 4, eff: { contraception: 4 }, fields: {} },

  { id: "fluconazole", name: "Fluconazole", cls: "Azole antifungal", ward: 5, rar: "uncommon",
    moa: "Inhibits fungal lanosterol 14-alpha-demethylase, blocking ergosterol synthesis",
    ind: ["Candidiasis", "Cryptococcal meningitis"],
    se: ["Hepatotoxicity", "QT prolongation"],
    buzz: "F in SICKFACES.COM: a classic enzyme inhibitor",
    pd: ["QT"], clr: "hep", role: "inh", ti: 4, eff: { infection: 3 }, fields: {} },

  { id: "ciprofloxacin", name: "Ciprofloxacin", cls: "Fluoroquinolone", ward: 5, rar: "uncommon",
    moa: "Inhibits bacterial DNA gyrase and topoisomerase IV",
    ind: ["UTI", "Gram-negative infections"],
    se: ["Tendon rupture", "QT prolongation", "Lowers seizure threshold"],
    buzz: "C in SICKFACES.COM. Also carries tendon rupture and QT risk.",
    pd: ["QT", "SZ"], clr: "hep", role: "inh", ti: 4, eff: { infection: 3 }, fields: {} },

  { id: "clarithromycin", name: "Clarithromycin", cls: "Macrolide", ward: 5, rar: "uncommon",
    moa: "Binds the 50S ribosomal subunit, blocking translocation",
    ind: ["Community-acquired pneumonia", "H. pylori regimens"],
    se: ["QT prolongation", "GI upset", "Metallic taste"],
    buzz: "E in SICKFACES.COM (erythromycin and the macrolides). Azithromycin is the exception with far less inhibition.",
    pd: ["QT"], clr: "hep", role: "inh", ti: 4, eff: { infection: 3 }, fields: {} },

  { id: "omeprazole", name: "Omeprazole", cls: "Proton pump inhibitor", ward: 5, rar: "common",
    moa: "Irreversibly inhibits the gastric H+/K+ ATPase",
    ind: ["GERD", "Peptic ulcer disease"],
    se: ["Hypomagnesemia", "C. difficile risk", "B12 deficiency"],
    buzz: "O in SICKFACES.COM",
    pd: [], clr: "hep", role: "inh", ti: 5, eff: { gerd: 3 }, fields: {} },

  { id: "metronidazole", name: "Metronidazole", cls: "Nitroimidazole antibiotic", ward: 5, rar: "uncommon",
    moa: "Forms toxic free radicals that damage bacterial DNA",
    ind: ["C. difficile", "Bacterial vaginosis", "Anaerobic infections"],
    se: ["Disulfiram-like reaction with alcohol", "Metallic taste", "Peripheral neuropathy"],
    buzz: "M in SICKFACES.COM. The alcohol reaction is the other board point.",
    pd: [], clr: "hep", role: "inh", ti: 4, eff: { infection: 3 }, fields: {} },

  { id: "rifampin", name: "Rifampin", cls: "Antimycobacterial", ward: 5, rar: "uncommon",
    moa: "Inhibits bacterial DNA-dependent RNA polymerase",
    ind: ["Tuberculosis", "Meningococcal prophylaxis"],
    se: ["Orange body fluids", "Hepatotoxicity"],
    buzz: "R in Chronic alcoholics Steal Phen-Phen and Never Refuse Greasy Carbs. The most potent inducer on the list.",
    pd: [], clr: "hep", role: "ind", ti: 4, eff: { infection: 3 }, fields: {} },

  { id: "phenytoin", name: "Phenytoin", cls: "Anticonvulsant", ward: 5, rar: "rare",
    moa: "Blocks voltage-gated sodium channels; zero-order kinetics at therapeutic doses",
    ind: ["Focal and tonic-clonic seizures", "Status epilepticus"],
    se: ["Gingival hyperplasia", "Hirsutism", "Nystagmus and ataxia", "Megaloblastic anemia"],
    buzz: "P in the inducer mnemonic. Gingival hyperplasia is the giveaway on a stem.",
    pd: [], clr: "hep", role: "ind", ti: 1, eff: { seizure_ctrl: 4 }, fields: { pregnancy: "avoid" } },

  { id: "stjohnswort", name: "St. John's wort", cls: "Herbal supplement", ward: 5, rar: "uncommon",
    moa: "Uncertain; has serotonergic activity and potently induces drug metabolism",
    ind: ["Self-treated depression"],
    se: ["Serotonin syndrome", "Contraceptive failure", "Photosensitivity"],
    buzz: "S in the inducer mnemonic AND serotonergic. The supplement your patient forgets to mention.",
    antidep: true, pd: ["SER"], clr: "hep", role: "ind", ti: 4, eff: { depression: 1 }, fields: {} },

  { id: "tramadol", name: "Tramadol", cls: "Atypical opioid", ward: 5, rar: "rare",
    moa: "Weak mu-opioid agonist that also blocks serotonin and norepinephrine reuptake; a PRODRUG requiring metabolism",
    ind: ["Moderate pain"],
    se: ["Seizures", "Serotonin syndrome", "Nausea"],
    buzz: "Triple threat: serotonergic, seizure-lowering, and a prodrug. Enzyme inhibitors make it stop working for pain.",
    sedTier: "strong", pd: ["SER", "SZ", "SED"], clr: "hep", role: null, ti: 2, eff: { pain: 3 }, fields: { seizure_hx: "avoid" }, prodrug: true },

  { id: "codeine", name: "Codeine", cls: "Opioid", ward: 5, rar: "uncommon",
    moa: "PRODRUG converted to morphine by hepatic metabolism",
    ind: ["Mild to moderate pain", "Cough"],
    se: ["Constipation", "Sedation", "Respiratory depression"],
    buzz: "The prodrug inversion: an enzyme inhibitor causes analgesic FAILURE, not toxicity",
    sedTier: "strong", pd: ["SED"], clr: "hep", role: null, ti: 3, eff: { pain: 3 }, fields: {}, prodrug: true },

  { id: "oxycodone", name: "Oxycodone", cls: "Opioid", ward: 5, rar: "common",
    moa: "Mu-opioid receptor agonist",
    ind: ["Moderate to severe pain"],
    se: ["Respiratory depression", "Constipation", "Dependence"],
    buzz: "Combined with a benzodiazepine this carries an FDA black box warning for respiratory depression",
    sedTier: "strong", pd: ["SED"], clr: "hep", role: null, ti: 2, eff: { pain: 4 }, fields: { geriatric: "caution" } },

  { id: "linezolid", name: "Linezolid", cls: "Oxazolidinone antibiotic", ward: 5, rar: "rare",
    moa: "Binds the 50S ribosomal subunit; also a reversible non-selective MAO inhibitor",
    ind: ["MRSA", "VRE"],
    se: ["Serotonin syndrome", "Thrombocytopenia", "Peripheral neuropathy"],
    buzz: "The antibiotic that is secretly an MAOI. This is a favorite board trap with SSRIs.",
    pd: ["SER"], clr: "hep", role: null, ti: 3, eff: { infection: 4 }, fields: {}, maoi: true },

  { id: "dextromethorphan", name: "Dextromethorphan", cls: "Antitussive", ward: 5, rar: "common",
    moa: "NMDA receptor antagonist with serotonergic activity",
    ind: ["Cough"],
    se: ["Serotonin syndrome", "Dissociation at high dose"],
    buzz: "The over-the-counter cough syrup that contributes to serotonin syndrome",
    pd: ["SER"], clr: "hep", role: null, ti: 4, eff: { cough: 3 }, fields: {} },

  { id: "ondansetron", name: "Ondansetron", cls: "5-HT3 antagonist", ward: 5, rar: "common",
    moa: "Blocks 5-HT3 receptors in the chemoreceptor trigger zone and gut",
    ind: ["Nausea and vomiting"],
    se: ["QT prolongation", "Headache", "Constipation"],
    buzz: "The antiemetic that prolongs QT and adds to serotonin burden",
    pd: ["QT", "SER"], clr: "hep", role: null, ti: 4, eff: { nausea: 3 }, fields: { qt: "caution" } },

  { id: "ibuprofen", name: "Ibuprofen", cls: "NSAID", ward: 5, rar: "common",
    moa: "Reversibly inhibits COX-1 and COX-2; reduces renal prostaglandin synthesis",
    ind: ["Pain", "Fever", "Inflammation"],
    se: ["GI bleeding", "Acute kidney injury", "Hypertension"],
    buzz: "Reduces renal clearance, which is exactly how it drives lithium into toxicity",
    pd: [], clr: "hep", role: "renblock", ti: 4, eff: { pain: 2 }, fields: { renal: "avoid" } },

  { id: "hctz", name: "Hydrochlorothiazide", cls: "Thiazide diuretic", ward: 5, rar: "common",
    moa: "Blocks the Na-Cl cotransporter in the distal convoluted tubule",
    ind: ["Hypertension", "Edema"],
    se: ["Hyponatremia", "Hypokalemia", "Hyperuricemia", "Hypercalcemia"],
    buzz: "Volume depletion drives proximal reabsorption of lithium, raising its level",
    pd: [], clr: "ren", role: "renblock", ti: 4, eff: { htn: 3 }, fields: {} },

  { id: "lisinopril", name: "Lisinopril", cls: "ACE inhibitor", ward: 5, rar: "common",
    moa: "Inhibits angiotensin converting enzyme, reducing angiotensin II",
    ind: ["Hypertension", "Heart failure", "Diabetic nephropathy"],
    se: ["Dry cough", "Hyperkalemia", "Angioedema"],
    buzz: "Reduces lithium clearance. Also the classic dry cough on a vignette.",
    pd: [], clr: "ren", role: "renblock", ti: 4, eff: { htn: 3 }, fields: { pregnancy: "contra" } },


  { id: "doxepin_ld", name: "Doxepin (low dose)", cls: "TCA at hypnotic dose", ward: 6, rar: "uncommon",
    moa: "At 3 to 6 mg it is a nearly pure H1 antihistamine, without the anticholinergic and cardiac effects seen at antidepressant doses",
    ind: ["Sleep maintenance insomnia"],
    se: ["Mild next-day sedation"],
    buzz: "The one hypnotic the AASM actually suggests using, and the safe way to give a TCA to an older adult",
    antidep: false, sedTier: "mild", pd: ["SED"], clr: "hep", role: null, ti: 4, eff: { insomnia: 3 }, fields: {} },

  { id: "ramelteon", name: "Ramelteon", cls: "Melatonin receptor agonist", ward: 6, rar: "uncommon",
    moa: "Agonist at MT1 and MT2 melatonin receptors in the suprachiasmatic nucleus",
    ind: ["Sleep onset insomnia"],
    se: ["Dizziness", "Rare hyperprolactinemia"],
    buzz: "No dependence, no Beers listing, no respiratory depression. The geriatric-safe hypnotic.",
    sedTier: "mild", pd: [], clr: "hep", role: null, ti: 5, eff: { insomnia: 2 }, fields: {} },

  { id: "daptomycin", name: "Daptomycin", cls: "Lipopeptide antibiotic", ward: 5, rar: "uncommon",
    moa: "Inserts into the bacterial membrane and causes depolarization",
    ind: ["MRSA skin and soft tissue infection", "MRSA bacteremia"],
    se: ["Myopathy with elevated CK", "Eosinophilic pneumonia"],
    buzz: "The MRSA drug with no serotonergic activity, so it is the answer when the patient is on an SSRI. Never use it for pneumonia; surfactant inactivates it.",
    pd: [], clr: "ren", role: null, ti: 4, eff: { infection: 4 }, fields: {} },

  /* ---------- ward 7 : treatment resistant ---------- */
  { id: "phenelzine", name: "Phenelzine", cls: "MAOI", ward: 7, rar: "black_box",
    moa: "Irreversibly inhibits monoamine oxidase A and B",
    ind: ["Atypical depression", "Treatment-resistant depression"],
    se: ["Hypertensive crisis with tyramine", "Serotonin syndrome", "Orthostatic hypotension"],
    buzz: "Requires a tyramine-free diet: no aged cheese, cured meats, or red wine",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 1, eff: { depression: 5 }, fields: {}, maoi: true },

  { id: "tranylcypromine", name: "Tranylcypromine", cls: "MAOI", ward: 7, rar: "black_box",
    moa: "Irreversibly inhibits monoamine oxidase A and B",
    ind: ["Treatment-resistant depression"],
    se: ["Hypertensive crisis", "Serotonin syndrome", "Insomnia"],
    buzz: "Same tyramine restrictions; more activating than phenelzine",
    antidep: true, pd: ["SER"], clr: "hep", role: null, ti: 1, eff: { depression: 5 }, fields: {}, maoi: true },

  { id: "amitriptyline", name: "Amitriptyline", cls: "Tricyclic antidepressant", ward: 7, rar: "black_box",
    moa: "Blocks serotonin and norepinephrine reuptake; also blocks muscarinic, H1, alpha-1 and cardiac sodium channels",
    ind: ["MDD", "Neuropathic pain", "Migraine prophylaxis"],
    se: ["Convulsions, Coma, Cardiotoxicity", "Anticholinergic effects", "Orthostatic hypotension"],
    buzz: "The 3 C's of TCA overdose: Convulsions, Coma, Cardiotoxicity. Treat with sodium bicarbonate for a wide QRS.",
    antidep: true, beersInsomnia: true, pd: ["SER", "ACH", "SED", "QT"], clr: "hep", role: null, ti: 1, eff: { depression: 4, pain: 3 }, fields: { geriatric: "avoid", qt: "avoid" } },

  { id: "nortriptyline", name: "Nortriptyline", cls: "Tricyclic antidepressant", ward: 7, rar: "rare",
    moa: "Blocks norepinephrine reuptake more than serotonin; less muscarinic blockade than amitriptyline",
    ind: ["MDD", "Neuropathic pain"],
    se: ["Anticholinergic effects", "Cardiotoxicity in overdose", "Orthostatic hypotension"],
    buzz: "The best-tolerated TCA in older adults, though still a Beers criteria drug",
    antidep: true, beersInsomnia: true, pd: ["SER", "ACH", "SED", "QT"], clr: "hep", role: null, ti: 2, eff: { depression: 4, pain: 3 }, fields: { geriatric: "avoid", qt: "avoid" } },
];

const DRUG_BY_ID = Object.fromEntries(DRUGS.map((d) => [d.id, d]));

function dbLink(name) {
  return `https://go.drugbank.com/unearth/q?query=${encodeURIComponent(name)}&searcher=drugs`;
}

/* --------------------------------------------------------------- the wards */
const WARDS = [
  {
    n: 1, name: "Outpatient mood clinic",
    teaches: "Pharmacodynamic stacking on the serotonergic axis",
    core: ["sertraline", "escitalopram", "duloxetine", "bupropion"],
    pool: ["citalopram", "fluoxetine", "paroxetine", "venlafaxine", "trazodone", "mirtazapine"],
    drop: "fluoxetine",
    cases: [
      { id: "w1c1", title: "New diagnosis", vignette: "34F with 3 months of low mood, anhedonia and poor sleep. No other medications. No medical history.",
        need: { depression: 3 }, fields: [], onboard: [], hint: "Any first-line agent will clear this." },
      { id: "w1c2", title: "The pain patient", vignette: "45M with MDD who takes tramadol daily for chronic back pain. He wants something for his mood.",
        need: { depression: 3 }, fields: [], onboard: ["tramadol"],
        secondary: { label: "Pain still controlled", need: { pain: 3 },
          failTitle: "His back pain is now untreated",
          failBody: "Stopping tramadol was the right call, but you left him with no analgesia. One antidepressant on this ward is approved for chronic musculoskeletal pain as well as depression." },
        hint: "Tramadol is serotonergic, seizure-lowering and sedating all at once, so nothing pairs with it cleanly. Stop it, but replace what it was doing." },
      { id: "w1c3", title: "Boss: augmentation", vignette: "28F with MDD, 8 weeks on fluoxetine at full dose with only a partial response. The team wants to push the response further today.",
        need: { depression: 4 }, fields: [], onboard: ["fluoxetine"], boss: true, hint: "An MAOI would be the classic next step, but check the half-life first. Otherwise, what can you safely add on top of an SSRI?" },
    ],
  },
  {
    n: 2, name: "Anxiety and insomnia",
    teaches: "The sedation axis and glucuronidation as a liver bypass",
    core: ["lorazepam", "buspirone", "hydroxyzine", "mirtazapine"],
    pool: ["oxazepam", "temazepam", "alprazolam", "diazepam", "zolpidem", "phenobarbital", "flumazenil"],
    drop: "temazepam",
    cases: [
      { id: "w2c1", title: "Panic", vignette: "31F with panic disorder, no substance history, wants something that will not be habit forming.",
        need: { panic: 3 }, fields: [], onboard: [],
        hint: "Buspirone is the reflex answer for non-addictive anxiolysis, but it is only effective in generalized anxiety. Guidelines do not support it in panic disorder." },
      { id: "w2c2", title: "Post-op", vignette: "62F on scheduled oxycodone after a hip replacement, now anxious and not sleeping on the ward.",
        need: { gad: 2 }, fields: [], onboard: ["oxycodone"], locked: ["oxycodone"],
        secondary: { label: "Sleeping again", need: { insomnia: 2 },
          failTitle: "She is calmer but still awake all night",
          failBody: "You treated the anxiety and left the insomnia. One agent on this ward treats both without being a strong CNS depressant on top of her opioid." },
        hint: "A benzodiazepine on top of an opioid is the FDA black box combination. Look for something that helps both anxiety and sleep without being a strong sedative." },
      { id: "w2c3", title: "Boss: cirrhosis", vignette: "70M with alcohol-related cirrhosis, now in withdrawal and agitated. Bilirubin and INR are both up.",
        need: { etoh_wd: 3 }, fields: ["hepatic", "geriatric"], onboard: [], boss: true,
        hint: "Alcohol withdrawal is the one setting where benzodiazepines are clearly indicated. Only three of them survive a failing liver." },
    ],
  },
  {
    n: 3, name: "Inpatient psychosis",
    teaches: "Dopamine blockade, QT stacking, and the anticholinergic rescue",
    core: ["risperidone", "olanzapine", "benztropine", "aripiprazole"],
    pool: ["haloperidol", "chlorpromazine", "quetiapine", "ziprasidone", "diphenhydramine", "propranolol"],
    drop: "clozapine",
    cases: [
      { id: "w3c1", title: "First episode", vignette: "24M brought in with 6 months of paranoid delusions and auditory hallucinations. Healthy otherwise.",
        need: { psychosis: 3 }, fields: [], onboard: [], hint: "Almost any antipsychotic wins here. Watch what else you add." },
      { id: "w3c2", title: "Twisted neck", vignette: "40M started on haloperidol 2 days ago, now with his neck twisted to one side and his eyes rolled upward.",
        need: { eps: 3 }, fields: [], onboard: ["haloperidol"], hint: "This is acute dystonia. One of the protective cells on the type chart applies." },
      { id: "w3c3", title: "Boss: long QT", vignette: "55F with schizophrenia and a baseline QTc of 480 ms. She needs an antipsychotic restarted.",
        need: { psychosis: 3 }, fields: ["qt"], onboard: [], boss: true, hint: "Two of the atypicals are far safer here than the rest." },
    ],
  },
  {
    n: 4, name: "Bipolar and mood stabilizers",
    teaches: "Therapeutic index, renal clearance, and glucuronidation blockade",
    core: ["lithium", "lamotrigine", "quetiapine", "acetaminophen"],
    pool: ["valproate", "carbamazepine", "oxcarbazepine", "aripiprazole", "olanzapine"],
    drop: "valproate",
    cases: [
      { id: "w4c1", title: "Mania", vignette: "30F with 5 days of no sleep, grandiosity and spending sprees. Not pregnant, normal renal function.",
        need: { mania: 4 }, fields: [], onboard: [], manic: true,
        hint: "First-line for acute mania is lithium, valproate or an atypical antipsychotic. Adding an antidepressant to a manic episode is the classic error." },
      { id: "w4c2", title: "The knee", vignette: "35M stable on lithium for 4 years, now with knee osteoarthritis pain asking what he can take.",
        need: { pain: 2 }, fields: [], onboard: ["lithium"],
        secondary: { label: "Mood still stabilized", need: { bipolar_maint: 3 },
          failTitle: "You stopped his mood stabilizer to treat a sore knee",
          failBody: "Deprescribing lithium does avoid the interaction, but 4 years of stability is not worth trading for an analgesic choice. Keep the lithium and pick a safer painkiller." },
        hint: "NSAIDs reduce renal clearance and push lithium into toxicity. Pick an analgesic that does not touch the kidney." },
      { id: "w4c3", title: "Boss: pregnancy", vignette: "26F with bipolar disorder, 8 weeks pregnant, presenting with a depressive episode.",
        need: { bipolar_dep: 3 }, fields: ["pregnancy"], onboard: [], boss: true, bipolarDep: true,
        hint: "Valproate and carbamazepine are out in the first trimester. Lamotrigine and quetiapine are the first-line choices in pregnancy, and antidepressant monotherapy is not an option in bipolar depression." },
    ],
  },
  {
    n: 5, name: "Consult-liaison",
    teaches: "Enzyme inhibitors, inducers, and the prodrug inversion",
    core: ["warfarin", "ocp", "fluconazole", "nystatin", "linezolid", "daptomycin"],
    pool: ["ciprofloxacin", "clarithromycin", "omeprazole", "metronidazole", "rifampin", "phenytoin", "stjohnswort", "codeine", "oxycodone", "ibuprofen", "hctz", "lisinopril", "ondansetron", "dextromethorphan"],
    drop: "tramadol",
    cases: [
      { id: "w5c1", title: "The thrush", vignette: "68M on warfarin for atrial fibrillation, INR stable at 2.4, now with oral candidiasis needing treatment.",
        need: { infection: 3 }, fields: [], onboard: ["warfarin"],
        secondary: { label: "Anticoagulation maintained", need: { anticoag: 4 },
          failTitle: "You stopped his anticoagulation to treat thrush",
          failBody: "Stopping warfarin does avoid the interaction, but he has atrial fibrillation and now an unprotected stroke risk. Pick an antifungal that does not interact instead." },
        hint: "Warfarin has the narrowest therapeutic index in the deck, and enzyme inhibitors make it bleed. One antifungal here is barely absorbed." },
      { id: "w5c2", title: "Seizures and the pill", vignette: "23F on the combined oral contraceptive, newly diagnosed with bipolar disorder, needs a mood stabilizer.",
        need: { mania: 3, contraception: 4 }, fields: [], onboard: ["ocp"], hint: "Inducers do not poison the patient. They make the other drug stop working, and here the other drug is her contraception." },
      { id: "w5c3", title: "Boss: the cellulitis", vignette: "48F on sertraline for MDD, admitted with MRSA cellulitis that has failed vancomycin.",
        need: { infection: 4 }, fields: [], onboard: ["sertraline"], boss: true,
        secondary: { label: "Depression still treated", need: { depression: 3 },
          failTitle: "You stopped her antidepressant to make room for an antibiotic",
          failBody: "Stopping the SSRI does remove the interaction, but there is an MRSA agent with no serotonergic activity at all. Treat both problems." },
        hint: "One antibiotic on this ward is secretly an MAOI. There is another MRSA agent that is not." },
    ],
  },
  {
    n: 6, name: "Special populations",
    teaches: "Field conditions: pregnancy, geriatric, renal and hepatic",
    core: ["propranolol", "doxepin_ld", "olanzapine", "aripiprazole"],
    pool: ["sertraline", "quetiapine", "lamotrigine", "oxazepam", "ramelteon", "trazodone", "valproate", "mirtazapine"],
    drop: "nortriptyline",
    cases: [
      { id: "w6c1", title: "The nursing home", vignette: "84F with chronic insomnia in a skilled nursing facility. Two falls in the last 6 months. CBT for insomnia has already been started.",
        need: { insomnia: 2 }, fields: ["geriatric"], onboard: [],
        hint: "Benzodiazepines, z-drugs, antihistamines and trazodone are all Beers-listed here. The AASM suggests low-dose doxepin, and a melatonin receptor agonist is another safe option." },
      { id: "w6c2", title: "Dialysis", vignette: "57M with end-stage renal disease on hemodialysis, presenting with a manic episode.",
        need: { mania: 3 }, fields: ["renal"], onboard: [], hint: "The usual first-line agent for mania is renally cleared." },
      { id: "w6c3", title: "Boss: agitated delirium", vignette: "62F admitted with pneumonia, now with fluctuating attention, disorganized thinking and agitation overnight. QTc is 470 ms. No alcohol history.",
        need: { agitation: 3 }, fields: ["qt"], onboard: [], boss: true, delirium: true,
        hint: "The APA recommends against benzodiazepines in delirium unless it is withdrawal. With a QTc of 470 you also want the antipsychotic with the least QT effect." },
    ],
  },
  {
    n: 7, name: "Treatment-resistant clinic",
    teaches: "One-hit interactions and the narrowest therapeutic indices",
    core: ["clozapine", "nortriptyline", "propranolol"],
    pool: ["phenelzine", "tranylcypromine", "amitriptyline", "lithium", "aripiprazole"],
    drop: "phenelzine",
    cases: [
      { id: "w7c1", title: "Treatment resistance", vignette: "36M with schizophrenia, now with persistent positive symptoms after two adequate 6-week trials of different antipsychotics at therapeutic doses, with confirmed adherence. Baseline ANC is normal.",
        need: { psychosis: 5 }, fields: [], onboard: [],
        hint: "Two failed adequate trials is the threshold that defines treatment resistance, and only one drug is indicated at that point." },
      { id: "w7c2", title: "The quitter", vignette: "44M stable on clozapine for years, admitted after quitting smoking cold turkey 5 days ago. Now sedated and confused.",
        need: { psychosis: 3 }, fields: ["smoking_cessation"], onboard: ["clozapine"], hint: "Stopping an inducer is itself an interaction." },
      { id: "w7c3", title: "Boss: atypical depression", vignette: "39F with atypical depression, off fluoxetine for 10 days, and the team wants to start phenelzine now.",
        need: { depression: 5 }, fields: [], onboard: [], boss: true, recent: { id: "fluoxetine", weeksOff: 1.4 },
        hint: "Count the weeks, not the days. If the MAOI is off the table today, augmentation is how you reach the target." },
    ],
  },
];

/* ------------------------------------------------------------- the engine */
const RARITY = {
  common: { label: "Common", weight: 55, ring: "ring-slate-300", chip: "bg-slate-100 text-slate-700" },
  uncommon: { label: "Uncommon", weight: 28, ring: "ring-cyan-400", chip: "bg-cyan-100 text-cyan-800" },
  rare: { label: "Rare", weight: 13, ring: "ring-violet-400", chip: "bg-violet-100 text-violet-800" },
  black_box: { label: "Black box", weight: 4, ring: "ring-red-500", chip: "bg-red-100 text-red-800" },
};

const FIELD_LABEL = {
  pregnancy: "Pregnancy", geriatric: "Geriatric", renal: "Renal failure",
  hepatic: "Liver failure", qt: "Long QT", smoking_cessation: "Smoking cessation",
  eating_disorder: "Eating disorder", seizure_hx: "Seizure history", asthma: "Asthma",
};

function baseRisk(ti) { return (6 - ti) * 4; }

/* the whole ruleset lives here */
function evaluate(regimen, patient) {
  const log = [];
  let safety = 100;
  let lost = false;
  const effTotals = {};
  const suppressed = new Set();

  const cards = regimen.map((id) => DRUG_BY_ID[id]);

  /* ---- one-hit interactions ---- */
  const maois = cards.filter((c) => c.maoi);
  for (const m of maois) {
    for (const c of cards) {
      if (c.id === m.id) continue;
      if (c.pd.includes("SER")) {
        log.push({ sev: "fatal", title: "MAOI plus a serotonergic agent",
          body: `${m.name} plus ${c.name} produces serotonin syndrome. This combination is never given together.`,
          axis: "One-hit" });
        lost = true;
      }
    }
  }
  /* washout against a drug the patient recently stopped */
  if (maois.length && patient.recent) {
    const prev = DRUG_BY_ID[patient.recent.id];
    if (prev?.washout && patient.recent.weeksOff < prev.washout) {
      log.push({ sev: "fatal", title: "Washout not complete",
        body: `${prev.name} needs ${prev.washout} weeks to clear before an MAOI is safe, and only ${patient.recent.weeksOff} weeks have passed. Two weeks is enough for the other SSRIs, but not for this one.`,
        axis: "One-hit" });
    }
  }
  /* washout: an MAOI added on top of a long half-life SSRI still in the regimen */
  const washCards = cards.filter((c) => c.washout);
  if (maois.length && washCards.length) {
    log.push({ sev: "fatal", title: "Washout violation",
      body: `${washCards[0].name} needs a ${washCards[0].washout}-week washout before an MAOI is started. Two weeks is enough for the other SSRIs, not for this one.`,
      axis: "One-hit" });
    lost = true;
  }
  /* valproate onto lamotrigine */
  if (regimen.includes("valproate") && regimen.includes("lamotrigine")) {
    log.push({ sev: "fatal", title: "Valproate blocks glucuronidation of lamotrigine",
      body: "Lamotrigine levels roughly double, and the rash risk becomes Stevens-Johnson syndrome. This pairing is legal only if the lamotrigine dose is halved first.",
      axis: "Clearance" });
    lost = true;
  }

  /* ---- axis 1 : clearance ---- */
  const inhibitors = cards.filter((c) => c.role === "inh");
  const prodrugBlockers = cards.filter((c) => c.role === "pdinh");
  const inducers = cards.filter((c) => c.role === "ind");
  const renBlockers = cards.filter((c) => c.role === "renblock");
  const glucInhibitors = cards.filter((c) => c.role2 === "glucinh" || c.id === "valproate");

  for (const victim of cards) {
    /* enzyme inhibitor onto a liver-metabolized drug */
    if (victim.clr === "hep") {
      for (const p of inhibitors) {
        if (p.id === victim.id) continue;
        const dmg = baseRisk(victim.ti) * 5;
        safety -= dmg;
        log.push({ sev: dmg >= 80 ? "fatal" : "danger", title: `${p.name} raises ${victim.name}`,
          body: `An enzyme inhibitor onto a liver-metabolized drug means the level climbs. ${victim.name} has a therapeutic index of ${victim.ti} out of 5, so the hit is ${dmg} points.`,
          axis: "Clearance" });
      }
      if (victim.prodrug) {
        for (const p of [...prodrugBlockers, ...inhibitors]) {
          if (p.id === victim.id) continue;
          suppressed.add(victim.id);
          log.push({ sev: "warn", title: "Prodrug inversion",
            body: `${p.name} blocks the metabolism that ACTIVATES ${victim.name}. The active drug level falls, so the patient gets no pain relief. This is the opposite of what blocking metabolism usually does.`,
            axis: "Clearance" });
        }
      }
      for (const p of inducers) {
        if (p.id === victim.id) continue;
        suppressed.add(victim.id);
        log.push({ sev: "warn", title: `${p.name} lowers ${victim.name}`,
          body: `An enzyme inducer speeds metabolism, so ${victim.name} drops to roughly a fifth of its effect. Nobody is poisoned. The treatment simply fails.`,
          axis: "Clearance" });
      }
    }
    /* renal blockade */
    if (victim.clr === "ren" && victim.ti <= 2) {
      for (const p of renBlockers) {
        if (p.id === victim.id) continue;
        const dmg = baseRisk(victim.ti) * 5;
        safety -= dmg;
        log.push({ sev: "fatal", title: `${p.name} raises ${victim.name}`,
          body: `${victim.name} is cleared by the kidney. NSAIDs, thiazides and ACE inhibitors all reduce that clearance. With a therapeutic index of ${victim.ti}, the level goes toxic fast.`,
          axis: "Clearance" });
      }
    }
    /* glucuronidation blockade, and inducers still lower glucuronidated drugs */
    if (victim.clr === "gluc") {
      for (const p of inducers) {
        if (p.id === victim.id) continue;
        suppressed.add(victim.id);
        log.push({ sev: "warn", title: `${p.name} lowers ${victim.name}`,
          body: `Glucuronidation is induced too, so ${victim.name} falls below a useful level.`,
          axis: "Clearance" });
      }
      for (const p of inhibitors) {
        if (p.id === victim.id) continue;
        log.push({ sev: "good", title: `${victim.name} is spared`,
          body: `${victim.name} is glucuronidated only, so it bypasses the enzyme ${p.name} inhibits. No interaction.`,
          axis: "Clearance" });
      }
    }
  }

  /* ---- fields ---- */
  for (const f of patient.fields) {
    for (const c of cards) {
      const lvl = c.fields?.[f];
      if (!lvl) continue;
      if (lvl === "contra") {
        log.push({ sev: "fatal", title: `${c.name} is contraindicated in ${FIELD_LABEL[f].toLowerCase()}`,
          body: c.buzz, axis: "Field" });
        lost = true;
      } else if (lvl === "avoid") {
        safety -= 30;
        log.push({ sev: "danger", title: `${c.name} should be avoided in ${FIELD_LABEL[f].toLowerCase()}`,
          body: c.buzz, axis: "Field" });
      } else {
        safety -= 12;
        log.push({ sev: "warn", title: `${c.name} needs caution in ${FIELD_LABEL[f].toLowerCase()}`,
          body: c.buzz, axis: "Field" });
      }
    }
    /* organ failure acts on the clearance axis exactly like a perpetrator */
    if (f === "hepatic") {
      for (const c of cards) {
        if (c.clr === "hep") {
          const dmg = baseRisk(c.ti) * 2;
          safety -= dmg;
          log.push({ sev: "danger", title: `A failing liver raises ${c.name}`,
            body: "The liver failure field does the same thing an enzyme inhibitor does. Glucuronidated drugs are the exception.",
            axis: "Clearance" });
        } else if (c.clr === "gluc") {
          log.push({ sev: "good", title: `${c.name} is safe in liver failure`,
            body: "Glucuronidation is preserved when phase I oxidation is not. Lorazepam, Oxazepam and Temazepam are the LOT.",
            axis: "Clearance" });
        }
      }
    }
    if (f === "renal") {
      for (const c of cards) {
        if (c.clr === "ren") {
          const dmg = baseRisk(c.ti) * 3;
          safety -= dmg;
          log.push({ sev: "fatal", title: `A failing kidney raises ${c.name}`,
            body: "Renally cleared drugs accumulate. This is why lithium is not the answer in renal disease.",
            axis: "Clearance" });
        }
      }
    }
    if (f === "geriatric") {
      const treatingSleep = Object.keys(patient.need).includes("insomnia") ||
        Object.keys(patient.secondary?.need || {}).includes("insomnia");
      if (treatingSleep) {
        for (const c of cards) {
          if (c.beersInsomnia) {
            log.push({ sev: "fatal", title: `${c.name} is Beers-listed for insomnia in older adults`,
              body: "The AGS Beers Criteria advise against this specifically for treating insomnia in older adults, and the AASM suggests against it too. Falls, next-day impairment and cognitive effects outweigh any sleep benefit. Low-dose doxepin or a melatonin receptor agonist are the safer options.",
              axis: "Guideline" });
          }
        }
      }
    }
    if (f === "qt") {
      for (const c of cards) {
        if (c.pd.includes("QT")) {
          safety -= 25;
          log.push({ sev: "danger", title: `${c.name} prolongs QT in a patient who already has a long QT`,
            body: "Adding a QT-prolonging drug to an already prolonged baseline is how torsades happens. Prefer an agent with no QT typing at all.",
            axis: "Field" });
        }
      }
    }
    if (f === "smoking_cessation") {
      for (const c of cards) {
        if (c.id === "clozapine" || c.id === "olanzapine") {
          safety -= c.id === "clozapine" ? 60 : 20;
          log.push({ sev: c.id === "clozapine" ? "fatal" : "warn", title: `Stopping smoking raises ${c.name}`,
            body: "Tobacco smoke induces the metabolism of clozapine and olanzapine. Quitting removes that induction and the level climbs, sometimes to the point of seizure.",
            axis: "Clearance" });
        }
      }
    }
  }

  /* ---- sedation tiering: benzo+opioid is a black box, mirtazapine+opioid is not ---- */
  const sedCards = cards.filter((c) => c.pd.includes("SED"));
  for (let i = 0; i < sedCards.length; i++) {
    for (let j = i + 1; j < sedCards.length; j++) {
      const a = sedCards[i], b = sedCards[j];
      const strong = (a.sedTier === "strong" ? 1 : 0) + (b.sedTier === "strong" ? 1 : 0);
      if (strong === 2) {
        safety -= 60;
        log.push({ sev: "fatal", title: "Respiratory depression",
          body: `${a.name} plus ${b.name}. Two strong CNS depressants together. The benzodiazepine plus opioid combination carries an FDA black box warning.`,
          axis: "PD type" });
      } else if (strong === 1) {
        safety -= 20;
        log.push({ sev: "warn", title: "Additive sedation",
          body: `${a.name} plus ${b.name}. One strong sedative plus a mildly sedating agent. Monitor, but this is not the black box combination.`,
          axis: "PD type" });
      } else {
        safety -= 10;
        log.push({ sev: "warn", title: "Mild additive sedation",
          body: `${a.name} plus ${b.name}. Both are mildly sedating.`, axis: "PD type" });
      }
    }
  }

  /* ---- bipolar rules (CANMAT/ISBD and APA): antidepressants and mania ---- */
  if (patient.manic) {
    for (const c of cards) {
      if (c.antidep) {
        log.push({ sev: "fatal", title: `${c.name} can worsen an acute manic episode`,
          body: "Antidepressants may precipitate or exacerbate mania and should be tapered and stopped in an acute manic episode, not started.",
          axis: "Guideline" });
      }
    }
  }
  if (patient.bipolarDep) {
    const hasStabilizer = cards.some((c) => c.stabilizer);
    for (const c of cards) {
      if (c.antidep && !hasStabilizer) {
        log.push({ sev: "fatal", title: `${c.name} as monotherapy risks a switch into mania`,
          body: "Antidepressant monotherapy is not recommended in bipolar I depression. First-line options are quetiapine, lurasidone, lithium or lamotrigine.",
          axis: "Guideline" });
      }
    }
  }
  /* ---- delirium (APA 2024): benzodiazepines are recommended against ---- */
  if (patient.delirium) {
    for (const c of cards) {
      if (c.sedTier === "strong" && c.pd.includes("SED")) {
        safety -= 55;
        log.push({ sev: "fatal", title: `${c.name} is recommended against in delirium`,
          body: "The APA 2024 delirium guideline recommends benzodiazepines not be used in patients with delirium unless there is a specific indication such as alcohol withdrawal. They prolong and worsen it.",
          axis: "Guideline" });
      }
    }
  }

  /* ---- axis 2 : PD stacking ---- */
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j];
      for (const ta of a.pd) {
        for (const tb of b.pd) {
          const hit = pdLookup(ta, tb);
          if (hit.kind === "none") continue;
          if (hit.kind === "syndrome") {
            safety -= 60;
            log.push({ sev: "fatal", title: hit.name,
              body: `${a.name} and ${b.name} are both ${PD_TYPES[ta].label.toLowerCase()}. ${hit.note}`,
              axis: "PD type" });
          } else if (hit.kind === "additive") {
            safety -= 20;
            log.push({ sev: "warn", title: hit.name,
              body: `${a.name} plus ${b.name}. ${hit.note}`, axis: "PD type" });
          } else if (hit.kind === "protective") {
            safety = Math.min(100, safety + 10);
            log.push({ sev: "good", title: hit.name,
              body: `${a.name} plus ${b.name}. ${hit.note}`, axis: "PD type" });
          }
        }
      }
    }
  }

  /* ---- every drug needs an indication ---- */
  const targets = new Set([
    ...Object.keys(patient.need),
    ...(patient.secondary ? Object.keys(patient.secondary.need) : []),
  ]);
  for (const c of cards) {
    if ((patient.onboard || []).includes(c.id)) continue;
    const helps = Object.keys(c.eff || {}).some((k) => targets.has(k));
    if (!helps) {
      safety -= 8;
      log.push({ sev: "warn", title: `${c.name} has no indication in this patient`,
        body: "Every drug on the list should be treating something. Adding an agent that does not address this patient's problem only adds interaction risk.",
        axis: "Care quality" });
    }
  }

  /* ---- efficacy ---- */
  for (const c of cards) {
    const mult = suppressed.has(c.id) ? 0.2 : 1;
    for (const [k, v] of Object.entries(c.eff || {})) {
      effTotals[k] = (effTotals[k] || 0) + v * mult;
    }
  }

  safety = Math.max(0, Math.round(safety));
  if (safety <= 0) lost = true;
  if (log.some((e) => e.sev === "fatal")) lost = true;

  const met = Object.entries(patient.need).every(([k, v]) => (effTotals[k] || 0) >= v);
  const secondary = patient.secondary || null;
  const secondaryMet = !secondary
    ? true
    : Object.entries(secondary.need).every(([k, v]) => (effTotals[k] || 0) >= v);
  if (secondary && !secondaryMet) {
    log.push({ sev: "warn", title: secondary.failTitle,
      body: secondary.failBody, axis: "Care quality" });
  }
  const bar = patient.boss ? 65 : 1;
  const underBar = met && !lost && safety < bar;
  const status = lost ? "lost" : underBar ? "harmed" : met ? "won" : "incomplete";
  const grade = safety >= 90 ? "Clean clear" : "Cleared, with avoidable harm";

  return { log, safety, effTotals, status, suppressed, grade, bar, secondaryMet, secondary };
}

/* ------------------------------------------------------------- pack pulls */
function weightedPull(pool, missed) {
  const boosted = [...pool, ...missed.filter((m) => pool.includes(m))];
  const entries = boosted.map((id) => {
    const d = DRUG_BY_ID[id];
    return { id, w: RARITY[d.rar].weight };
  });
  const total = entries.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.id; }
  return entries[entries.length - 1].id;
}

/* ---------------------------------------------------------- references */
const REF_GROUPS = [
  {
    group: "Defining the problem: how common and how costly psychiatric interactions are",
    items: [
      { t: "Hefner G, Wolff J, Hahn M, et al. Prevalence and sort of pharmacokinetic drug-drug interactions in hospitalized psychiatric patients. J Neural Transm. 2020;127:1185-1198." },
      { t: "Demler TL. Psychiatric Drug-Drug Interactions: A Refresher. US Pharmacist. 2012. Source for the figures that psychotropics account for up to half of ADRs in hospitalized psychiatric patients, and that roughly a quarter of ADR-related admissions stem from interactions.", u: "https://www.uspharmacist.com/article/psychiatric-drug-drug-interactions-a-refresher" },
      { t: "FDA / Centers for Education and Research on Therapeutics. Preventable Adverse Drug Reactions: A Focus on Drug Interactions. Teaching module; source for the $136 billion figure and the exponential rise in ADR risk past four medications. The original FDA page has since been retired, so this mirrors the module.", u: "https://crediblemeds.org/application/files/3516/1573/8318/CERT_Lecture_Guide.pdf" },
      { t: "de Andrade Santos TNG, et al. Prevalence of clinically manifested drug interactions in hospitalized patients: a systematic review and meta-analysis. PLoS One. 2020." },
    ],
  },
  {
    group: "Why a game: evidence that game-based teaching works in pharmacology",
    items: [
      { t: "Bergs J, et al. Serious gaming as a potential training tool for recognition of adverse drug reactions: side-effect exposure, medical education (SeeMe). Evaluated in 157 medical students; correct answers roughly doubled after the intervention.", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11458730/" },
      { t: "Open-Access Web-Based Gamification in Pharmacology Education for Medical Students. JMIR Med Educ. 2025. Three pharmacology games; students scored significantly higher than controls." },
      { t: "Game-based learning in medical education. Review describing how serious games combine feedback, testing and spaced repetition with active participation." },
    ],
  },
  {
    group: "Building the interaction engine",
    items: [
      { t: "FDA. Drug Development and Drug Interactions: Table of Substrates, Inhibitors and Inducers. Source for the strong / moderate inhibitor definitions that set the damage multipliers in this game.", u: "https://www.fda.gov/drugs/drug-interactions-labeling/drug-development-and-drug-interactions-table-substrates-inhibitors-and-inducers" },
      { t: "CredibleMeds QTdrugs Lists. Source for the Known / Possible / Conditional risk tiering behind the QT typing.", u: "https://crediblemeds.org/" },
      { t: "First Aid for the USMLE Step 1. Source for the three mnemonics the game teaches: SICKFACES.COM, Chronic alcoholics Steal Phen-Phen and Never Refuse Greasy Carbs, and Always Think When Outdoors. No mnemonic in this game is invented." },
      { t: "DrugBank Online. The monograph link on every card, and the source consulted for mechanism, indications and adverse effects.", u: "https://go.drugbank.com/" },
    ],
  },
  {
    group: "Guidelines used to verify every patient encounter",
    items: [
      { t: "American Psychiatric Association. Practice Guideline for the Prevention and Treatment of Delirium. 2024. Recommends benzodiazepines not be used in delirium absent a specific indication. This corrected the three-organ boss case.", u: "https://www.psychiatry.org/news-room/news-releases/apa-published-updated-guideline-for-delirium" },
      { t: "Yatham LN, et al. CANMAT and ISBD Guidelines for the Management of Patients with Bipolar Disorder. 2018, with the 2023 evidence update. First-line agents for acute mania and bipolar depression, and the rule against antidepressant monotherapy.", u: "https://www.canmat.org/wp-content/uploads/2019/07/Yatham-LN-2018-CANMAT-ISBD-guidelines-for-bipolar-disorder-Bipol-Disord.pdf" },
      { t: "CANMAT and ISBD Guidelines for the Treatment of Bipolar Disorder: Summary and a 2023 Update of Evidence.", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11058959/" },
      { t: "Sateia MJ, et al. Clinical Practice Guideline for the Pharmacologic Treatment of Chronic Insomnia in Adults. American Academy of Sleep Medicine. Suggests against trazodone and in favor of low-dose doxepin. This corrected the nursing home case.", u: "https://jcsm.aasm.org/doi/10.5664/jcsm.6470" },
      { t: "American Geriatrics Society Beers Criteria for Potentially Inappropriate Medication Use in Older Adults. Basis for the geriatric field, applied by indication rather than as a blanket ban." },
      { t: "NICE. Delirium: prevention, diagnosis and management in hospital and long-term care.", u: "https://www.ncbi.nlm.nih.gov/books/NBK553009/" },
      { t: "Howes OD, et al. Treatment-Resistant Schizophrenia: TRRIP Working Group Consensus Guidelines. Two failed adequate trials, not three, is the threshold for clozapine.", u: "https://www.psychiatrist.com/jcp/clinical-guidance-on-treatment-resistant-schizophrenia/" },
      { t: "Pharmacotherapy for Anxiety Disorders: From First-Line Options to Treatment Resistance. Focus (APA). Basis for excluding buspirone from panic disorder.", u: "https://psychiatryonline.org/doi/full/10.1176/appi.focus.20200048" },
      { t: "Mood stabilizers in pregnancy and lactation. Basis for the pregnancy field, including lamotrigine as the preferred option and valproate and carbamazepine as first-trimester contraindications.", u: "https://pubmed.ncbi.nlm.nih.gov/26330649/" },
      { t: "Bipolar Disorders: Evaluation and Treatment. American Family Physician. 2021. Antidepressant monotherapy is contraindicated in manic episodes and bipolar I.", u: "https://www.aafp.org/pubs/afp/issues/2021/0215/p227.html" },
    ],
  },
];

/* --------------------------------------------------------------- audio */
/* SHRIMP1.opus and SHRIMP2.opus must sit next to index.html (Vite: /public). */
const TRACKS = ["SHRIMP1.opus", "SHRIMP2.opus"];

function useMusic(volume, muted) {
  const ref = React.useRef(null);
  const startedRef = React.useRef(false);
  const volRef = React.useRef(volume);
  const muteRef = React.useRef(muted);
  const [started, setStarted] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [track, setTrack] = React.useState(null);

  /* keep refs current so callbacks never read stale volume */
  React.useEffect(() => { volRef.current = volume; muteRef.current = muted; }, [volume, muted]);

  const playRandom = React.useCallback(() => {
    const src = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    if (!ref.current) {
      ref.current = new Audio();
      ref.current.preload = "auto";
      ref.current.addEventListener("ended", () => playRandom());
      ref.current.addEventListener("error", () => setFailed(true));
    }
    ref.current.src = src;
    ref.current.volume = muteRef.current ? 0 : volRef.current;
    setTrack(src);
    const p = ref.current.play();
    if (p && p.then) {
      p.then(() => {
        /* only now is playback genuinely running */
        startedRef.current = true;
        setStarted(true);
        setBlocked(false);
      }).catch((err) => {
        if (err && err.name === "NotAllowedError") {
          /* autoplay blocked: stay unstarted so the next click retries */
          startedRef.current = false;
          setStarted(false);
          setBlocked(true);
        } else {
          setFailed(true);
        }
      });
    } else {
      startedRef.current = true;
      setStarted(true);
    }
  }, []);

  const start = React.useCallback(() => {
    if (startedRef.current) return;
    playRandom();
  }, [playRandom]);

  /* attempt on load, then retry on any interaction anywhere until it takes */
  React.useEffect(() => {
    start();
    const onFirst = () => start();
    const evts = ["pointerdown", "mousedown", "click", "keydown", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, onFirst, { passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, onFirst));
  }, [start]);

  React.useEffect(() => {
    if (ref.current) ref.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  React.useEffect(() => {
    return () => { if (ref.current) { ref.current.pause(); ref.current.src = ""; } };
  }, []);

  return { start, started, blocked, failed, track, skip: playRandom };
}

/* ---------------------------------------------------------- difficulty */
const DIFFICULTIES = {
  m3:      { id: "m3",      label: "M3",            lives: Infinity, hints: "always", reveal: "full",  blurb: "Infinite lives. Full cards, hints always on." },
  m4:      { id: "m4",      label: "M4",            lives: 8,        hints: "onmiss", reveal: "full",  blurb: "8 lives. Full cards. Hint after a wrong answer." },
  intern:  { id: "intern",  label: "Intern",        lives: 5,        hints: "onmiss", reveal: "noclass", blurb: "5 lives. Drug class hidden. You should know it." },
  chief:   { id: "chief",   label: "Chief resident", lives: 3,       hints: "onmiss", reveal: "bare",  blurb: "3 lives. Class and side effects hidden." },
  attend:  { id: "attend",  label: "Attending",     lives: 1,        hints: "never",  reveal: "bare",  blurb: "1 life. Class and side effects hidden. No hints." },
};
const DIFF_ORDER = ["m3", "m4", "intern", "chief", "attend"];

const LOSS_HEADLINES = [
  { paper: "The Daily Chart Review", head: "Dr. {name} Sued Into Oblivion After Prescribing Every Serotonergic Drug At Once",
    sub: "Plaintiff's expert witness described the medication list as \u201cmore of a suggestion than a plan.\u201d" },
  { paper: "Morbidity Weekly", head: "Local Physician Dr. {name} Discovers Nine New Drug Interactions, All In The Same Patient",
    sub: "The pharmacy has requested that Dr. {name} be issued a pager that only receives messages." },
  { paper: "The Pharmacy Times-Picayune", head: "Dr. {name} Loses License, Immediately Applies To Be A Medical Consultant For Television",
    sub: "Sources confirm the QTc is still pending." },
];
const WIN_HEADLINES = [
  { paper: "The Daily Chart Review", head: "Dr. {name} Named Psychiatrist Of The Year For Never Once Stacking Two QT Drugs",
    sub: "Colleagues describe the achievement as \u201cfrankly a little smug about it.\u201d" },
  { paper: "Morbidity Weekly", head: "Dr. {name} Completes Entire Formulary Without A Single Serotonin Syndrome",
    sub: "The pharmacy has reportedly stopped calling, which is the highest honor available." },
  { paper: "The Pharmacy Times-Picayune", head: "Dr. {name} Discharges Final Patient Alive, Well, And On A Reasonable Number Of Medications",
    sub: "Lamotrigine was titrated slowly. It was beautiful." },
];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* minecraft-style heart row: full, half, empty */
function Hearts({ current, max }) {
  if (max === Infinity) {
    return (
      <div className="flex items-center gap-1.5" title="Infinite lives">
        <Heart fill="full" />
        <span className="text-sm font-bold text-slate-200">&#8734;</span>
      </div>
    );
  }
  const slots = [];
  for (let i = 0; i < max; i++) {
    const v = current - i;
    slots.push(v >= 1 ? "full" : v >= 0.5 ? "half" : "empty");
  }
  return (
    <div className="flex items-center gap-0.5" title={`${current} of ${max} lives`}>
      {slots.map((k, i) => <Heart key={i} fill={k} />)}
    </div>
  );
}

const PILL_KINDS = [
  { a: "#f87171", b: "#fca5a5", shape: "capsule" },
  { a: "#60a5fa", b: "#bfdbfe", shape: "capsule" },
  { a: "#fbbf24", b: "#fde68a", shape: "capsule" },
  { a: "#34d399", b: "#a7f3d0", shape: "capsule" },
  { a: "#f472b6", b: "#fbcfe8", shape: "capsule" },
  { a: "#e2e8f0", b: "#e2e8f0", shape: "round" },
  { a: "#c4b5fd", b: "#c4b5fd", shape: "round" },
  { a: "#fed7aa", b: "#fed7aa", shape: "oblong" },
  { a: "#a5f3fc", b: "#a5f3fc", shape: "oblong" },
];

function Rule({ label, children }) {
  return (
    <div className="mt-2 flex gap-3">
      <div className="w-28 shrink-0 text-xs font-semibold text-slate-700">{label}</div>
      <div className="flex-1 text-xs leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

function HowToPlayPanel({ onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-900 bg-opacity-80 p-4">
      <div className="my-4 w-full max-w-2xl rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">How to play</h2>
            <p className="mt-1 text-sm text-slate-600">
              Treat the patient without harming them. That is the whole game.
            </p>
          </div>
          <button onClick={onClose} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Close
          </button>
        </div>

        {/* ---- the loop ---- */}
        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">The basic loop</h3>
          <ol className="mt-2 space-y-1.5">
            {[
              "Pick a case from a ward.",
              "Read the patient. Note any home medications they are already taking.",
              "Add drugs from your formulary until the treatment target is filled.",
              "Sign the orders to find out what happened.",
              "Clear the ward boss to unlock the next ward.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <span className="shrink-0 font-mono text-slate-400">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- navigation ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Getting around</h3>
          <Rule label="Wards">
            The main map. Each ward has two regular cases and one boss, marked in red. Cleared cases
            turn green. Locked wards open when you beat the previous boss.
          </Rule>
          <Rule label="Binder">
            Every card in the game. The ones you own are shown in full; the rest are dashed
            placeholders telling you which ward they come from. Tap any owned card to enlarge it.
          </Rule>
          <Rule label="Type chart">
            Your reference sheet. Both interaction matrices plus the mnemonics the game teaches. Open
            it mid-case if you get stuck; there is no penalty for looking.
          </Rule>
          <Rule label="Open pack">
            Top right. Lights up amber when you have packs waiting.
          </Rule>
        </section>

        {/* ---- inside a case ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Inside a case</h3>
          <Rule label="Your formulary">
            Every card you own, on the right. Tap one to add it to the regimen.
          </Rule>
          <Rule label="Current regimen">
            What the patient is on right now. Tap Stop to remove something you added.
          </Rule>
          <Rule label="Home meds">
            Drugs the patient arrived on. You can Deprescribe most of them, and sometimes that is
            exactly the right move. Anything marked Required cannot be stopped.
          </Rule>
          <Rule label="Sign the orders">
            Commits your regimen and scores it. Reset puts the patient back to their home medications
            so you can try a different approach.
          </Rule>
        </section>

        {/* ---- the meters ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">The three meters</h3>
          <div className="mt-2 space-y-2">
            <div className="rounded border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-8 rounded bg-emerald-500" />
                <span className="text-xs font-semibold">Patient safety</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Starts at 100. Interactions, contraindications and unnecessary drugs all take points
                off. Hit zero and you lose the case. On most difficulties this is hidden until you
                sign.
              </p>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-8 rounded bg-cyan-600" />
                <span className="text-xs font-semibold">Treatment target</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                What you actually have to fix. This is why prescribing nothing never wins. A drug
                only fills this bar if it treats the problem in front of you.
              </p>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-8 rounded bg-violet-500" />
                <span className="text-xs font-semibold">Care quality</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Only on some cases. Tracks the thing you must not break while solving the main
                problem, such as leaving the patient's pain untreated or stopping their
                anticoagulation. Missing it still clears the case but costs half a life.
              </p>
            </div>
          </div>
        </section>

        {/* ---- how drugs interact ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">How drugs interact</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Every card has two typings, and they fail in opposite directions.
          </p>
          <Rule label="Clearance">
            How the drug leaves the body: liver, kidney, or glucuronidation. Block that route and the
            level climbs toward toxicity. Speed it up and the drug stops working. Organ failure does
            the same thing a drug can.
          </Rule>
          <Rule label="Receptor type">
            What the drug does at receptors: serotonergic, QT prolonging, anticholinergic, sedating,
            dopamine blocking, or seizure threshold lowering. Stack two of the same type and you get
            a named syndrome.
          </Rule>
          <Rule label="Two exceptions">
            Not every combination is bad. Two pairings on the type chart are protective and will
            raise your safety score. Find them.
          </Rule>
          <Rule label="Fields">
            Orange tags on a patient, such as pregnancy or long QT. They re-score every card on the
            board. A drug that is fine in one patient can be contraindicated in the next.
          </Rule>
          <Rule label="Indications">
            Adding a drug that treats nothing this patient has costs you points. Every drug on the
            list should be doing a job.
          </Rule>
        </section>

        {/* ---- packs ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Cards and packs</h3>
          <Rule label="Earning packs">
            One pack per case cleared, three for a boss. Press Open pack in the header to open one.
          </Rule>
          <Rule label="What is inside">
            Five cards drawn from your current ward and every ward before it. At least one Rare or
            better is guaranteed if you have gone a while without one.
          </Rule>
          <Rule label="Guaranteed cards">
            Entering a ward hands you its core drugs automatically, and every boss drops a specific
            card. You can always win every case with the cards you are guaranteed, so bad luck can
            never block you.
          </Rule>
          <Rule label="Rarity">
            Rarity means clinical danger, not power. Common cards are forgiving. Black Box cards like
            clozapine and the MAOIs are powerful and will end a case if you misuse them.
          </Rule>
          <Rule label="Repeat offenders">
            Cards you have made mistakes with are weighted more heavily in future packs, so the game
            keeps handing you the ones you have not learned yet.
          </Rule>
        </section>

        {/* ---- lives ---- */}
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Lives and difficulty</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-1 pr-2 font-semibold">Level</th>
                  <th className="py-1 pr-2 font-semibold">Lives</th>
                  <th className="py-1 pr-2 font-semibold">Cards show</th>
                  <th className="py-1 font-semibold">Hints</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  ["M3", "Infinite", "Everything", "Always on"],
                  ["M4", "8", "Everything", "After a mistake"],
                  ["Intern", "5", "No drug class", "After a mistake"],
                  ["Chief resident", "3", "No class or side effects", "After a mistake"],
                  ["Attending", "1", "No class or side effects", "Never"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-slate-100">
                    {r.map((c, i) => <td key={i} className="py-1 pr-2">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Rule label="Losing a life">
            A full heart for killing or seriously harming the patient. Half a heart for leaving them
            undertreated, for avoidable harm, or for missing the care quality bar.
          </Rule>
          <Rule label="Boss cases">
            Bosses demand a genuinely clean regimen, not just a surviving patient. Scraping through
            with a damaged patient will not clear one.
          </Rule>
          <Rule label="Running out">
            At zero hearts your career ends and you get the front page you deserve. On M3 you cannot
            lose, so use it to learn the type chart.
          </Rule>
        </section>

        {/* ---- tips ---- */}
        <section className="mt-5 rounded border border-cyan-200 bg-cyan-50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-900">If you are stuck</h3>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-cyan-900">
            <li>Read the interaction log after signing. It explains every hit in full, and that is the actual teaching.</li>
            <li>Check the patient's home medications before adding anything. Most traps are already on the board.</li>
            <li>Open the Type chart tab mid-case. It is free.</li>
            <li>Tap any card to read its mechanism, uses, warnings and a link to the full monograph.</li>
            <li>Fewer drugs is usually the answer. If a drug is not treating something, take it off.</li>
            <li>Failed a case? Links to every drug involved appear so you can read up before retrying.</li>
          </ul>
        </section>

        <button onClick={onClose} className="mt-5 w-full rounded bg-slate-900 py-2.5 text-sm font-bold text-white">
          Back
        </button>
      </div>
    </div>
  );
}

function AboutPanel({ onClose }) {
  let n = 0;
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-900 bg-opacity-80 p-4">
      <div className="my-4 w-full max-w-2xl rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">About POLYPHARM</h2>
            <p className="mt-1 text-sm text-slate-600">
              A psychiatric drug interaction card game by Tony and CIMED
            </p>
          </div>
          <button onClick={onClose} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Close
          </button>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Why this exists</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            This game started as a needs assessment on a psychiatry clerkship. The observation was
            simple: an advanced practice provider spent an entire morning teaching another APP about
            drug interactions in psychiatric medications. That is a lot of senior clinician time spent
            transferring knowledge that has no standard curriculum and no durable delivery method.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The resulting need statement: a way to better memorize drug-drug interactions focusing on
            psychiatric drugs, in order to reduce adverse drug reactions in patients on multiple
            medications. The underlying pharmacology is already well understood. What is missing is a
            way to make it stick.
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">How it was built</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The design borrows from type-matchup games. Drug interactions really are a matchup matrix,
            so the mechanic that makes the game work is the same one that carries the teaching. Every
            card has two typings: how the drug is cleared, and what it does at receptors. Those two
            axes fail in opposite directions. Blocking clearance causes toxicity; inducing it causes
            treatment failure; stacking receptor effects causes a named syndrome.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Two deliberate choices shape the content. Specific CYP isoenzyme identities were left out
            because they are not tested at this level; drugs are typed only as inhibitor, inducer or
            substrate. And two cells of the type chart are protective rather than harmful, because a
            game that only punishes polypharmacy would teach the wrong lesson.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The design, code and content were developed by Tony in collaboration with Claude, an AI
            assistant made by Anthropic, which wrote the React implementation and the interaction
            engine. Every patient encounter was then checked against current published guidelines
            rather than against the model's own recollection. That verification pass changed five
            cases: buspirone was removed as a valid answer for panic disorder, benzodiazepines were
            removed as the answer for delirium, antidepressants were blocked in acute mania and as
            monotherapy in bipolar depression, trazodone was replaced with low-dose doxepin for
            insomnia in older adults, and the clozapine threshold was corrected from three failed
            trials to two.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The case set was also solved by brute force to confirm that every encounter has a
            guideline-correct winning regimen reachable from the cards a player is guaranteed to own,
            and that every intended trap actually fails.
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Built with</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            React and Tailwind CSS. Card monograph links point to DrugBank Online. Soundtrack is
            SHRIMP1 and SHRIMP2, chosen at random each time a track ends.
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">References</h3>
          {REF_GROUPS.map((g) => (
            <div key={g.group} className="mt-3">
              <div className="text-xs font-semibold text-slate-700">{g.group}</div>
              <ol className="mt-1 space-y-1.5">
                {g.items.map((it) => {
                  n += 1;
                  return (
                    <li key={n} className="flex gap-2 text-xs leading-snug text-slate-600">
                      <span className="shrink-0 font-mono text-slate-400">{n}.</span>
                      <span>
                        {it.t}{" "}
                        {it.u && (
                          <a href={it.u} target="_blank" rel="noreferrer" className="font-medium text-cyan-700 underline">
                            link
                          </a>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900">Important</h3>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            This is a study aid for medical trainees, not a clinical decision support tool. The
            interaction model is deliberately simplified so it can be learned and remembered. It
            omits dose, route, timing, individual pharmacogenomics and much else that matters at the
            bedside. Never use it to make a prescribing decision. Check a real reference and consult
            a pharmacist.
          </p>
        </section>

        <button onClick={onClose} className="mt-5 w-full rounded bg-slate-900 py-2.5 text-sm font-bold text-white">
          Back
        </button>
      </div>
    </div>
  );
}

function PillRain() {
  const pills = React.useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const k = PILL_KINDS[i % PILL_KINDS.length];
        return {
          i,
          left: (i * 37) % 100,
          delay: -((i * 1.7) % 14),
          dur: 11 + ((i * 3) % 9),
          scale: 0.65 + ((i * 13) % 60) / 100,
          spin: (i % 2 ? 1 : -1) * (200 + ((i * 47) % 320)),
          tilt: (i * 29) % 180,
          ...k,
        };
      }),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pills.map((p) => (
        <div
          key={p.i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            animation: `pillFall ${p.dur}s linear ${p.delay}s infinite`,
            opacity: 0.5,
          }}
        >
          <div style={{ animation: `pillSpin ${6 + (p.i % 5)}s linear infinite`, transform: `scale(${p.scale})` }}>
            {p.shape === "capsule" && (
              <svg width="26" height="12" viewBox="0 0 26 12" style={{ transform: `rotate(${p.tilt}deg)` }}>
                <rect x="0" y="0" width="13" height="12" rx="6" fill={p.a} />
                <rect x="13" y="0" width="13" height="12" rx="6" fill={p.b} />
              </svg>
            )}
            {p.shape === "round" && (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="7" fill={p.a} />
                <rect x="6.4" y="1.6" width="1.2" height="10.8" fill="#94a3b8" opacity="0.65" />
              </svg>
            )}
            {p.shape === "oblong" && (
              <svg width="22" height="10" viewBox="0 0 22 10" style={{ transform: `rotate(${p.tilt}deg)` }}>
                <rect x="0" y="0" width="22" height="10" rx="5" fill={p.a} />
              </svg>
            )}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes pillFall {
          0%   { transform: translateY(-12vh); }
          100% { transform: translateY(112vh); }
        }
        @keyframes pillSpin {
          0%   { rotate: 0deg; }
          100% { rotate: 360deg; }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] > div { animation: none !important; }
          [aria-hidden="true"] > div > div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function Heart({ fill }) {
  const path = "M8 14s-5.5-3.6-5.5-7.2A3.3 3.3 0 0 1 8 4.2a3.3 3.3 0 0 1 5.5 2.6C13.5 10.4 8 14 8 14z";
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d={path} className="fill-slate-700 stroke-slate-900" strokeWidth="1" />
      {fill !== "empty" && (
        <>
          <defs>
            <clipPath id={`half-${fill}`}>
              <rect x="0" y="0" width={fill === "half" ? 8 : 16} height="16" />
            </clipPath>
          </defs>
          <path d={path} className="fill-red-500" clipPath={fill === "half" ? `url(#half-${fill})` : undefined} />
        </>
      )}
    </svg>
  );
}

/* ================================================================== UI ==== */
const SEV = {
  fatal: { bar: "bg-red-500", chip: "bg-red-100 text-red-900", label: "Fatal" },
  danger: { bar: "bg-orange-500", chip: "bg-orange-100 text-orange-900", label: "Danger" },
  warn: { bar: "bg-amber-400", chip: "bg-amber-100 text-amber-900", label: "Caution" },
  good: { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900", label: "Protective" },
};

const PD_CHIP = {
  SER: "bg-rose-100 text-rose-800 border-rose-300",
  QT: "bg-red-100 text-red-800 border-red-300",
  ACH: "bg-violet-100 text-violet-800 border-violet-300",
  SED: "bg-blue-100 text-blue-800 border-blue-300",
  DA: "bg-teal-100 text-teal-800 border-teal-300",
  SZ: "bg-amber-100 text-amber-800 border-amber-300",
};

const CLR_CHIP = {
  hep: "bg-amber-100 text-amber-900 border-amber-300",
  ren: "bg-cyan-100 text-cyan-900 border-cyan-300",
  gluc: "bg-lime-100 text-lime-900 border-lime-300",
};

function Card({ d, onClick, selected, compact, disabled, reveal = "full" }) {
  const rar = RARITY[d.rar];
  const showClass = reveal === "full";
  const showSE = reveal === "full" || reveal === "noclass";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left w-full rounded-lg border bg-white ring-2 transition ${rar.ring} ${
        selected ? "border-slate-900 shadow-md" : "border-slate-200"
      } ${disabled ? "opacity-40" : "hover:shadow-md"} ${compact ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500 truncate">
            {showClass ? d.cls : <span className="italic text-slate-400">class hidden</span>}
          </div>
          <div className="font-semibold text-slate-900 leading-tight">{d.name}</div>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${rar.chip}`}>
          TI {d.ti}
        </span>
      </div>

      {!compact && (
        <div className="mt-2 rounded bg-slate-50 p-2 font-mono text-xs leading-snug text-slate-700">
          {d.moa}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`rounded border px-1.5 py-0.5 text-xs ${CLR_CHIP[d.clr]}`}>
          {CLEARANCE[d.clr].short}
        </span>
        {d.role && (
          <span className="rounded border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
            {ROLES[d.role]}
          </span>
        )}
        {d.prodrug && (
          <span className="rounded border border-fuchsia-300 bg-fuchsia-100 px-1.5 py-0.5 text-xs text-fuchsia-800">
            Prodrug
          </span>
        )}
        {d.maoi && (
          <span className="rounded border border-red-400 bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
            MAOI
          </span>
        )}
        {d.pd.map((t) => (
          <span key={t} className={`rounded border px-1.5 py-0.5 text-xs ${PD_CHIP[t]}`}>
            {t}
          </span>
        ))}
      </div>

      {!compact && (
        <>
          <div className="mt-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Uses </span>
            {d.ind.join(", ")}
          </div>
          {showSE && (
            <div className="mt-1 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Watch for </span>
              {d.se.join(", ")}
            </div>
          )}
          {showSE && (
            <div className="mt-2 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-600">
              {d.buzz}
            </div>
          )}
          <a
            href={dbLink(d.name)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-block text-xs font-medium text-cyan-700 underline"
          >
            Full monograph on DrugBank
          </a>
        </>
      )}
    </button>
  );
}

function Meter({ label, value, max, tone }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span>{Math.round(value)} / {max}</span>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-slate-200">
        <div className={`h-2 rounded ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PolypharmGame() {
  const [screen, setScreen] = useState("title");
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [diff, setDiff] = useState("intern");
  const [lives, setLives] = useState(5);
  const [caseMissed, setCaseMissed] = useState(false);
  const [headline, setHeadline] = useState(null);
  const [packAnim, setPackAnim] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [muted, setMuted] = useState(false);
  const music = useMusic(volume, muted);
  const [collection, setCollection] = useState([]);
  const [unlocked, setUnlocked] = useState(1);
  const [packs, setPacks] = useState(0);
  const [missed, setMissed] = useState([]);
  const [cleared, setCleared] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [regimen, setRegimen] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [pulled, setPulled] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [loaded, setLoaded] = useState(false);

  /* load once */
  useEffect(() => {
    (async () => {
      const s = await store.get("polypharm:save");
      if (s) {
        setCollection(s.collection || []);
        setUnlocked(s.unlocked || 1);
        setPacks(s.packs || 0);
        setMissed(s.missed || []);
        setCleared(s.cleared || []);
        if (s.name) { setName(s.name); setNameInput(s.name); }
        if (s.diff) setDiff(s.diff);
        if (typeof s.lives === "number") setLives(s.lives);
        if (typeof s.volume === "number") setVolume(s.volume);
        if (typeof s.muted === "boolean") setMuted(s.muted);
        if (s.name) setScreen("map");
      } else {
        setCollection(WARDS[0].core);
        setPacks(1);
      }
      setLoaded(true);
    })();
  }, []);

  /* save on change */
  useEffect(() => {
    if (!loaded) return;
    store.set("polypharm:save", { collection, unlocked, packs, missed, cleared, name, diff, lives, volume, muted });
  }, [collection, unlocked, packs, missed, cleared, name, diff, lives, volume, muted, loaded]);

  const ward = WARDS[unlocked - 1];

  function startCase(c, w) {
    setActiveCase({ ...c, ward: w.n });
    setRegimen([...(c.onboard || [])]);
    setSubmitted(false);
    setCaseMissed(false);
    setScreen("case");
  }

  const result = useMemo(() => {
    if (!activeCase) return null;
    return evaluate(regimen, {
      need: activeCase.need,
      fields: activeCase.fields || [],
      boss: !!activeCase.boss,
      recent: activeCase.recent,
      onboard: activeCase.onboard || [],
      manic: activeCase.manic,
      bipolarDep: activeCase.bipolarDep,
      delirium: activeCase.delirium,
      secondary: activeCase.secondary,
    });
  }, [regimen, activeCase]);

  function submitCase() {
    setSubmitted(true);
    if (!result) return;
    const maxLives = DIFFICULTIES[diff].lives;

    if (result.status === "won") {
      if (!result.secondaryMet && maxLives !== Infinity) {
        setLives((L) => Math.max(0, Math.round((L - 0.5) * 2) / 2));
      }
      if (!cleared.includes(activeCase.id)) setCleared([...cleared, activeCase.id]);
      const w = WARDS[activeCase.ward - 1];
      let newPacks = packs + 1;
      if (activeCase.boss) {
        newPacks += 2;
        if (!collection.includes(w.drop)) setCollection((c) => [...c, w.drop]);
        if (activeCase.ward === unlocked && unlocked < WARDS.length) {
          const next = WARDS[unlocked];
          setUnlocked(unlocked + 1);
          setCollection((c) => [...new Set([...c, ...next.core])]);
        } else if (activeCase.ward === unlocked && unlocked === WARDS.length) {
          setHeadline({ kind: "win", ...pick(WIN_HEADLINES) });
          setScreen("ending");
        }
      }
      setPacks(newPacks);
      return;
    }

    /* the run went wrong: work out the cost */
    setCaseMissed(true);
    let cost = 0;
    if (result.status === "lost") cost = 1;                  /* patient harmed badly enough to end the case */
    else if (result.status === "incomplete") cost = 0.5;     /* undertreated */
    else cost = 0.5;                                          /* treated, but avoidable harm */

    if (maxLives !== Infinity && cost > 0) {
      const next = Math.max(0, Math.round((lives - cost) * 2) / 2);
      setLives(next);
      if (next < 0.5) {
        setHeadline({ kind: "loss", ...pick(LOSS_HEADLINES) });
        setScreen("ending");
      }
    }

    const culprits = new Set();
    for (const e of result.log) {
      if (e.sev === "fatal" || e.sev === "danger") {
        for (const id of regimen) {
          if (e.title.includes(DRUG_BY_ID[id].name) || e.body?.includes(DRUG_BY_ID[id].name)) culprits.add(id);
        }
      }
    }
    if (culprits.size) setMissed([...new Set([...missed, ...culprits])]);
  }

  function openPack() {
    if (packs < 1) return;
    const pool = WARDS.slice(0, unlocked).flatMap((w) => w.pool);
    const got = [];
    for (let i = 0; i < 5; i++) got.push(weightedPull(pool, missed));
    /* pity: guarantee at least one rare or better every pack after the third */
    if (!got.some((id) => ["rare", "black_box"].includes(DRUG_BY_ID[id].rar))) {
      const rares = pool.filter((id) => ["rare", "black_box"].includes(DRUG_BY_ID[id].rar));
      if (rares.length) got[4] = rares[Math.floor(Math.random() * rares.length)];
    }
    setPulled(got);
    setCollection((c) => [...new Set([...c, ...got])]);
    setPacks(packs - 1);
    setPackAnim(1);
    setRevealed(0);
    setScreen("pack");
    setTimeout(() => setPackAnim(2), 620);
    got.forEach((_, i) => setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 900 + i * 260));
  }

  function beginGame() {
    const clean = nameInput.trim().replace(/^dr\.?\s*/i, "");
    if (!clean) return;
    music.start();
    setName(clean);
    setLives(DIFFICULTIES[diff].lives);
    setCollection(WARDS[0].core);
    setPacks(1);
    setUnlocked(1);
    setCleared([]);
    setMissed([]);
    setScreen("map");
  }

  function restart() {
    setLives(DIFFICULTIES[diff].lives);
    setCollection(WARDS[0].core);
    setPacks(1);
    setUnlocked(1);
    setCleared([]);
    setMissed([]);
    setHeadline(null);
    setScreen("map");
  }

  const reveal = DIFFICULTIES[diff].reveal;
  const showHint =
    DIFFICULTIES[diff].hints === "always" ||
    (DIFFICULTIES[diff].hints === "onmiss" && caseMissed);
  const verboseLog = DIFFICULTIES[diff].hints === "always";

  const owned = collection.map((id) => DRUG_BY_ID[id]).filter(Boolean);
  const hand = owned.filter((d) => !regimen.includes(d.id));

  if (!loaded) {
    return <div className="p-6 font-sans text-slate-500">Loading the formulary...</div>;
  }

  /* ------------------------------------------------------- TITLE SCREEN */
  if (screen === "title") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans text-slate-100">
        <PillRain />
        {showAbout && <AboutPanel onClose={() => setShowAbout(false)} />}
        {showHelp && <HowToPlayPanel onClose={() => setShowHelp(false)} />}
        <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-[0.3em] text-cyan-400">
                A game by Tony and CIMED
              </div>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-white">POLYPHARM</h1>
              <p className="mt-2 text-sm text-slate-400">
                Psychiatric drug interactions, one patient at a time
              </p>
            </div>

            <div className="mt-8">
              <label className="block text-sm font-medium text-slate-300">Your name</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 focus-within:border-cyan-400">
                <span className="shrink-0 text-lg font-bold text-cyan-400">Dr.</span>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && beginGame()}
                  placeholder="Enter your name"
                  maxLength={24}
                  className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-300">Difficulty</label>
              <div className="mt-2 space-y-1.5">
                {DIFF_ORDER.map((k) => {
                  const d = DIFFICULTIES[k];
                  const on = diff === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setDiff(k)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                        on ? "border-cyan-400 bg-slate-700" : "border-slate-700 bg-slate-900 hover:border-slate-500"
                      }`}
                    >
                      <div className="w-32 shrink-0 font-semibold">{d.label}</div>
                      <div className="shrink-0">
                        <Hearts current={d.lives} max={d.lives} />
                      </div>
                      <div className="min-w-0 flex-1 text-xs text-slate-400">{d.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowHelp(true)}
              className="mt-6 w-full rounded-lg border border-slate-600 bg-slate-900 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-400"
            >
              How to play
            </button>

            <button
              onClick={beginGame}
              disabled={!nameInput.trim()}
              className={`mt-2 w-full rounded-lg py-3 text-lg font-bold transition ${
                nameInput.trim()
                  ? "bg-cyan-400 text-slate-900 hover:bg-cyan-300"
                  : "cursor-not-allowed bg-slate-700 text-slate-500"
              }`}
            >
              Start the shift
            </button>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <button onClick={() => setShowAbout(true)} className="font-medium text-cyan-400 underline">
                About this game and its sources
              </button>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">Educational use only</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------ ENDING SCREEN */
  if (screen === "ending" && headline) {
    const loss = headline.kind === "loss";
    return (
      <div className={`min-h-screen font-sans ${loss ? "bg-slate-900" : "bg-cyan-950"}`}>
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
          <div className="rounded-sm border-4 border-double border-slate-900 bg-stone-100 p-8 shadow-2xl">
            <div className="border-b-2 border-slate-900 pb-2 text-center">
              <div className="font-serif text-2xl font-black uppercase tracking-widest text-slate-900">
                {headline.paper}
              </div>
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600">
                <span>Vol. XLII, No. 7</span>
                <span>{loss ? "Malpractice Desk" : "Honors and Awards"}</span>
                <span>Price: one copay</span>
              </div>
            </div>
            <h1 className="mt-5 text-center font-serif text-3xl font-black leading-tight text-slate-900">
              {headline.head.replace(/\{name\}/g, name)}
            </h1>
            <p className="mt-3 border-y border-slate-300 py-3 text-center font-serif text-sm italic text-slate-700">
              {headline.sub.replace(/\{name\}/g, name)}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center font-serif text-xs text-slate-700">
              <div>
                <div className="text-2xl font-black text-slate-900">{cleared.length}</div>
                cases cleared
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{collection.length}</div>
                drugs collected
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{unlocked}</div>
                wards reached
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={restart} className="flex-1 rounded bg-slate-900 py-2.5 font-sans text-sm font-bold text-white">
                {loss ? "Appeal the verdict" : "New shift"}
              </button>
              <button
                onClick={() => { setHeadline(null); setScreen("title"); }}
                className="rounded border border-slate-400 px-4 py-2.5 font-sans text-sm text-slate-700"
              >
                Title screen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <div className="mx-auto max-w-5xl p-4">
        {/* header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-4 text-white">
          <div>
            <h1 className="text-xl font-bold tracking-tight">POLYPHARM</h1>
            <p className="text-xs text-cyan-300">
              Dr. {name} &middot; {DIFFICULTIES[diff].label}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-slate-800 px-2 py-1.5">
              <Hearts current={lives} max={DIFFICULTIES[diff].lives} />
            </span>
            <span className="rounded bg-slate-700 px-2 py-1">Ward {unlocked} of {WARDS.length}</span>
            <span className="rounded bg-slate-700 px-2 py-1">{collection.length} cards</span>
            <button
              onClick={() => { setMuted((m) => !m); if (!music.started) music.start(); }}
              className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              title={muted ? "Unmute music" : "Mute music"}
              aria-label={muted ? "Unmute music" : "Mute music"}
            >
              {muted ? "\u{1F507}" : "\u{1F50A}"}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              title="How to play"
            >
              How to play
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              title="Settings"
            >
              Settings
            </button>
            <button
              onClick={openPack}
              disabled={packs < 1}
              className={`rounded px-3 py-1 font-medium ${
                packs > 0 ? "bg-amber-400 text-slate-900" : "bg-slate-700 text-slate-400"
              }`}
            >
              Open pack ({packs})
            </button>
          </div>
        </header>

        {/* nav */}
        <nav className="mb-4 flex gap-2">
          {[["map", "Wards"], ["collection", "Binder"], ["chart", "Type chart"]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setScreen(k)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                screen === k ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ---------------------------------------------------------- MAP */}
        {screen === "map" && (
          <div className="space-y-3">
            {WARDS.map((w) => {
              const locked = w.n > unlocked;
              return (
                <div key={w.n} className={`rounded-lg border bg-white p-4 ${locked ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold">
                      Ward {w.n}. {w.name}
                    </h2>
                    {locked && <span className="text-xs text-slate-500">Clear the previous boss to unlock</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{w.teaches}</p>
                  {!locked && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {w.cases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => startCase(c, w)}
                          className={`rounded border p-3 text-left hover:shadow ${
                            cleared.includes(c.id)
                              ? "border-emerald-400 bg-emerald-50"
                              : c.boss
                              ? "border-red-300 bg-red-50"
                              : "border-slate-300 bg-slate-50"
                          }`}
                        >
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {c.boss ? "Boss" : "Case"}
                            {cleared.includes(c.id) ? " · cleared" : ""}
                          </div>
                          <div className="font-medium">{c.title}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* --------------------------------------------------------- CASE */}
        {screen === "case" && activeCase && result && (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* patient */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Ward {activeCase.ward} · {activeCase.boss ? "Boss case" : "Case"}
                </div>
                <h2 className="mt-1 font-semibold">{activeCase.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{activeCase.vignette}</p>

                {activeCase.fields?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {activeCase.fields.map((f) => (
                      <span key={f} className="rounded border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900">
                        {FIELD_LABEL[f]} field
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {verboseLog || submitted ? (
                    <Meter
                      label="Patient safety"
                      value={result.safety}
                      max={100}
                      tone={result.safety > 60 ? "bg-emerald-500" : result.safety > 30 ? "bg-amber-400" : "bg-red-500"}
                    />
                  ) : (
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-600">
                        <span>Patient safety</span>
                        <span>unknown</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded bg-slate-200">
                        <div className="h-2 w-full rounded bg-[repeating-linear-gradient(45deg,#cbd5e1_0_6px,#e2e8f0_6px_12px)]" />
                      </div>
                    </div>
                  )}
                  {Object.entries(activeCase.need).map(([k, v]) => (
                    <Meter
                      key={k}
                      label={`Treating ${k.replace(/_/g, " ")}`}
                      value={Math.min(v, result.effTotals[k] || 0)}
                      max={v}
                      tone="bg-cyan-600"
                    />
                  ))}
                  {activeCase.secondary &&
                    Object.entries(activeCase.secondary.need).map(([k, v]) => (
                      <Meter
                        key={`sec-${k}`}
                        label={`${activeCase.secondary.label} (care quality)`}
                        value={Math.min(v, result.effTotals[k] || 0)}
                        max={v}
                        tone="bg-violet-500"
                      />
                    ))}
                </div>

                {showHint ? (
                  <p className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-600">
                    Hint. {activeCase.hint}
                  </p>
                ) : DIFFICULTIES[diff].hints === "never" ? (
                  <p className="mt-3 rounded bg-slate-900 p-2 text-xs text-slate-400">
                    Attendings do not get hints.
                  </p>
                ) : (
                  <p className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-500">
                    A hint will appear if this regimen goes wrong.
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={submitCase}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Sign the orders
                  </button>
                  <button
                    onClick={() => { setRegimen([...(activeCase.onboard || [])]); setSubmitted(false); }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setScreen("map")}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Leave
                  </button>
                </div>

                {submitted && result.status !== "won" && (
                  <div className="mt-3 rounded border border-cyan-200 bg-cyan-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-900">
                      Read up on what went wrong
                    </div>
                    <p className="mt-1 text-xs text-cyan-900">
                      Full monographs with mechanism, interactions, indications and adverse effects:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...new Set(regimen)].map((id) => (
                        <a
                          key={id}
                          href={dbLink(DRUG_BY_ID[id].name)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-cyan-300 bg-white px-2 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100"
                        >
                          {DRUG_BY_ID[id].name} &#8599;
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {submitted && (
                  <div
                    className={`mt-3 rounded p-3 text-sm font-medium ${
                      result.status === "won"
                        ? "bg-emerald-100 text-emerald-900"
                        : result.status === "lost"
                        ? "bg-red-100 text-red-900"
                        : result.status === "harmed"
                        ? "bg-orange-100 text-orange-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {result.status === "won" && !result.secondaryMet &&
                      `Case cleared, but half a life lost. ${result.secondary.failTitle}.`}
                    {result.status === "won" && result.secondaryMet &&
                      `Case cleared. ${result.grade}. Patient safety finished at ${result.safety}.`}
                    {result.status === "lost" && "Case lost. Read the interaction log, then reset and try a different regimen."}
                    {result.status === "harmed" && `You hit the treatment target, but safety finished at ${result.safety} and a boss case needs at least ${result.bar}. There is a cleaner regimen here.`}
                    {result.status === "incomplete" && "The patient is safe but undertreated. You have not met the target yet."}
                  </div>
                )}
              </div>

              {/* current regimen */}
              <div className="rounded-lg border bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold">Current regimen</h3>
                {regimen.length === 0 && <p className="text-sm text-slate-500">Nothing ordered yet.</p>}
                <div className="space-y-2">
                  {regimen.map((id) => {
                    const d = DRUG_BY_ID[id];
                    const preexisting = (activeCase.onboard || []).includes(id);
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Card d={d} compact reveal={reveal} onClick={() => setInspect(d)} />
                        </div>
                        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
                          {preexisting && (
                            <span className="text-xs font-medium text-slate-500">Home med</span>
                          )}
                          {(activeCase.locked || []).includes(id) ? (
                            <span className="w-full rounded border border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] text-slate-400">
                              Required
                            </span>
                          ) : (
                            <button
                              onClick={() => setRegimen(regimen.filter((x) => x !== id))}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {preexisting ? "Deprescribe" : "Stop"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* log + hand */}
            <div className="lg:col-span-3 space-y-3">
              <div className="rounded-lg border bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold">
                  Interaction log
                  {!verboseLog && !submitted && (
                    <span className="ml-2 font-normal text-xs text-slate-500">
                      hidden until you sign the orders
                    </span>
                  )}
                </h3>
                {!verboseLog && !submitted ? (
                  <p className="text-sm text-slate-500">
                    {regimen.length === 0
                      ? "Order something and sign to see what happens."
                      : `${regimen.length} medication${regimen.length === 1 ? "" : "s"} on board. Sign the orders to find out whether this regimen holds up.`}
                  </p>
                ) : (
                <>
                {result.log.length === 0 && (
                  <p className="text-sm text-slate-500">No interactions detected in this regimen.</p>
                )}
                <div className="space-y-2">
                  {result.log.map((e, i) => (
                    <div key={i} className={`rounded border-l-4 bg-slate-50 p-2 ${SEV[e.sev].bar.replace("bg-", "border-")}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEV[e.sev].chip}`}>
                          {SEV[e.sev].label}
                        </span>
                        <span className="text-xs text-slate-500">{e.axis} axis</span>
                        <span className="text-sm font-medium">{e.title}</span>
                      </div>
                      {e.body && <p className="mt-1 text-sm leading-snug text-slate-700">{e.body}</p>}
                    </div>
                  ))}
                </div>
                </>
                )}
              </div>

              <div className="rounded-lg border bg-white p-4">
                <h3 className="mb-2 text-sm font-semibold">Your formulary</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hand.map((d) => (
                    <Card key={d.id} d={d} compact reveal={reveal} onClick={() => setRegimen([...regimen, d.id])} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- COLLECTION */}
        {screen === "collection" && (
          <div>
            <p className="mb-3 text-sm text-slate-600">
              {collection.length} of {DRUGS.length} cards collected. Tap any card to read the full monograph.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DRUGS.map((d) =>
                collection.includes(d.id) ? (
                  <Card key={d.id} d={d} reveal={reveal} onClick={() => setInspect(d)} />
                ) : (
                  <div key={d.id} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Ward {d.ward}</div>
                    <div className="font-semibold text-slate-400">Not collected</div>
                    <div className="mt-2 text-xs text-slate-400">{RARITY[d.rar].label}</div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- CHART */}
        {screen === "chart" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 font-semibold">Pharmacodynamic type chart</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="w-16" />
                      {Object.keys(PD_TYPES).map((t) => (
                        <th key={t} className="p-1 font-medium text-slate-600">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(PD_TYPES).map((a) => (
                      <tr key={a}>
                        <td className="pr-1 text-right font-medium text-slate-600">{a}</td>
                        {Object.keys(PD_TYPES).map((b) => {
                          const hit = pdLookup(a, b);
                          const tone =
                            hit.kind === "syndrome" ? "bg-red-100 text-red-900"
                            : hit.kind === "protective" ? "bg-emerald-100 text-emerald-900"
                            : hit.kind === "additive" ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-400";
                          return (
                            <td key={b} className={`rounded p-1.5 text-center leading-tight ${tone}`}>
                              {hit.kind === "none" ? "—" : hit.name}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                {Object.entries(PD_TYPES).map(([k, v]) => (
                  <div key={k}>
                    <span className={`mr-1 rounded border px-1 ${PD_CHIP[k]}`}>{k}</span>
                    {v.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 font-semibold">Clearance matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="w-40" />
                      <th className="p-1 font-medium text-slate-600">Liver metabolized</th>
                      <th className="p-1 font-medium text-slate-600">Renally cleared</th>
                      <th className="p-1 font-medium text-slate-600">Glucuronidated only</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Enzyme inhibitor", ["Level up, toxicity", "red"], ["No effect", "slate"], ["Spared", "emerald"]],
                      ["Enzyme inducer", ["Level down, failure", "amber"], ["No effect", "slate"], ["Level down", "amber"]],
                      ["NSAID, thiazide, ACE inhibitor", ["No effect", "slate"], ["Level up, toxicity", "red"], ["No effect", "slate"]],
                      ["Valproate", ["Level up", "red"], ["No effect", "slate"], ["Level up, SJS risk", "red"]],
                      ["Liver failure field", ["Level up, toxicity", "red"], ["No effect", "slate"], ["Spared, use LOT", "emerald"]],
                      ["Renal failure field", ["No effect", "slate"], ["Level up, toxicity", "red"], ["No effect", "slate"]],
                    ].map(([label, ...cells]) => (
                      <tr key={label}>
                        <td className="pr-1 text-right font-medium text-slate-600">{label}</td>
                        {cells.map(([txt, tone], i) => (
                          <td
                            key={i}
                            className={`rounded p-1.5 text-center ${
                              tone === "red" ? "bg-red-100 text-red-900"
                              : tone === "amber" ? "bg-amber-100 text-amber-900"
                              : tone === "emerald" ? "bg-emerald-100 text-emerald-900"
                              : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {txt}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 text-sm">
              <h3 className="mb-2 font-semibold">Mnemonics this game teaches</h3>
              <ul className="space-y-2 text-slate-700">
                <li><span className="font-medium">SICKFACES.COM</span> — enzyme inhibitors: sodium valproate, isoniazid, cimetidine, ketoconazole, fluconazole, acute alcohol, chloramphenicol, erythromycin, sulfonamides, ciprofloxacin, omeprazole, metronidazole.</li>
                <li><span className="font-medium">Chronic alcoholics Steal Phen-Phen and Never Refuse Greasy Carbs</span> — enzyme inducers: chronic alcohol, St. John's wort, phenytoin, phenobarbital, nevirapine, rifampin, griseofulvin, carbamazepine.</li>
                <li><span className="font-medium">Always Think When Outdoors</span> — classic substrates: anti-epileptics, theophylline, warfarin, OCPs.</li>
                <li><span className="font-medium">LOT</span> — lorazepam, oxazepam, temazepam are glucuronidated only, so they are safe in liver failure.</li>
                <li><span className="font-medium">Barbi-DUR-ates increase DURation, fre-BENZO-diazepines increase FREquency</span> — GABA-A chloride channel effects.</li>
              </ul>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------- PACK */}
        {screen === "pack" && pulled && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Pharmacy delivery</h2>
              <button
                onClick={() => setScreen("map")}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Back to wards
              </button>
            </div>

            {packAnim < 2 ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div
                  className="relative h-44 w-32 rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl"
                  style={{ animation: "pkShake 0.6s ease-in-out" }}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-3xl">&#9877;</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">
                      Pharmacy
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 rounded-lg bg-white"
                    style={{ animation: "pkFlash 0.6s ease-in forwards" }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pulled.map((id, i) => (
                  <div
                    key={`${id}-${i}`}
                    style={{
                      opacity: i < revealed ? 1 : 0,
                      transform: i < revealed ? "none" : "translateY(14px) scale(0.94)",
                      transition: "opacity 320ms ease, transform 320ms cubic-bezier(.2,.8,.2,1)",
                    }}
                  >
                    <Card d={DRUG_BY_ID[id]} reveal={reveal} onClick={() => setInspect(DRUG_BY_ID[id])} />
                  </div>
                ))}
              </div>
            )}

            {packAnim === 2 && missed.length > 0 && (
              <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">
                Cards you have previously made errors with are weighted more heavily in every pack. Right now that list has {missed.length} card{missed.length === 1 ? "" : "s"}.
              </p>
            )}

            <style>{`
              @keyframes pkShake {
                0%,100% { transform: rotate(0deg) scale(1); }
                20% { transform: rotate(-7deg) scale(1.05); }
                45% { transform: rotate(6deg) scale(1.07); }
                70% { transform: rotate(-4deg) scale(1.1); }
                90% { transform: rotate(2deg) scale(1.14); }
              }
              @keyframes pkFlash {
                0%,60% { opacity: 0; }
                100% { opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {showAbout && <AboutPanel onClose={() => setShowAbout(false)} />}
        {showHelp && <HowToPlayPanel onClose={() => setShowHelp(false)} />}

        {/* ------------------------------------------------------ SETTINGS */}
        {showSettings && (
          <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900 bg-opacity-70 p-4"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold">Settings</h2>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <div className="mt-1 flex items-center gap-2 rounded border border-slate-300 px-2 py-1.5">
                  <span className="font-bold text-slate-500">Dr.</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={24}
                    className="w-full outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Difficulty</label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Changing this resets your lives to the new maximum.
                </p>
                <div className="mt-2 space-y-1.5">
                  {DIFF_ORDER.map((k) => {
                    const d = DIFFICULTIES[k];
                    return (
                      <button
                        key={k}
                        onClick={() => { setDiff(k); setLives(d.lives); }}
                        className={`flex w-full items-center gap-3 rounded border p-2 text-left text-sm ${
                          diff === k ? "border-slate-900 bg-slate-100" : "border-slate-200"
                        }`}
                      >
                        <span className="w-28 shrink-0 font-medium">{d.label}</span>
                        <span className="shrink-0 rounded bg-slate-800 px-1.5 py-1">
                          <Hearts current={d.lives} max={d.lives} />
                        </span>
                        <span className="min-w-0 flex-1 text-xs text-slate-500">{d.blurb}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t pt-4">
                <label className="block text-sm font-medium text-slate-700">Music</label>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => { setMuted((m) => !m); if (!music.started) music.start(); }}
                    className={`shrink-0 rounded border px-2.5 py-1.5 text-sm font-medium ${
                      muted ? "border-slate-300 bg-slate-100 text-slate-500" : "border-slate-900 bg-slate-900 text-white"
                    }`}
                    aria-label={muted ? "Unmute music" : "Mute music"}
                  >
                    {muted ? "Muted" : "Sound on"}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (muted) setMuted(false);
                      if (!music.started) music.start();
                    }}
                    className="w-full accent-slate-900"
                    aria-label="Music volume"
                  />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {music.failed
                      ? "Audio files not found. Add SHRIMP1.opus and SHRIMP2.opus to the public folder."
                      : music.blocked
                      ? "Click anywhere to start the music."
                      : music.track
                      ? `Now playing ${music.track.replace(".opus", "")}`
                      : "Starts when you begin a shift"}
                  </span>
                  {music.started && !music.failed && (
                    <button onClick={music.skip} className="font-medium text-cyan-700 underline">
                      Shuffle
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => { setShowSettings(false); setShowHelp(true); }}
                  className="block text-sm font-medium text-cyan-700 underline"
                >
                  How to play: navigation, rules and scoring
                </button>
                <button
                  onClick={() => { setShowSettings(false); setShowAbout(true); }}
                  className="mt-2 block text-sm font-medium text-cyan-700 underline"
                >
                  About this game, how it was made, and its sources
                </button>
              </div>

              <div className="mt-5 flex gap-2 border-t pt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 rounded bg-slate-900 py-2 text-sm font-medium text-white"
                >
                  Done
                </button>
                <button
                  onClick={() => { setShowSettings(false); restart(); }}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Restart run
                </button>
                <button
                  onClick={() => { setShowSettings(false); setScreen("title"); }}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Title
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- INSPECT */}
        {inspect && (
          <div
            className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900 bg-opacity-60 p-4"
            onClick={() => setInspect(null)}
          >
            <div className="max-h-full w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <Card d={inspect} reveal={reveal} onClick={() => {}} />
              <button
                onClick={() => setInspect(null)}
                className="mt-2 w-full rounded bg-white py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
