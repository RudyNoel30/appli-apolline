/**
 * Prompt d'extraction structurée du AA summary extract.txt vers le schéma Apolline.
 *
 * Le AA summary extract.txt est produit par le skill `dossier-extract` à partir
 * des PDFs d'un dossier OneDrive (bulletins, avis IRPP, contrat de travail,
 * diagnostics, etc.). Il est structuré en §1-§5 (P1-P5).
 *
 * Claude reçoit ce texte et produit un JSON conforme au schéma Apolline
 * (client + dossier + emprunteur1 + emprunteur2). On utilise le SCÉNARIO
 * MÉDIAN par défaut pour les revenus (= salaire net imposable moyen sans
 * variable spéculative).
 */

export const IMPORT_EXTRACT_PROMPT = `Tu es un expert courtier IOBSP qui prépare l'import d'un dossier dans le logiciel Extr'Apol (Groupe Apolline). Tu travailles AVEC RIGUEUR — chaque champ pertinent de l'extract DOIT être reporté dans le JSON, sans exception.

Tu reçois en input le contenu intégral d'un fichier "AA summary extract.txt" produit par notre skill /dossier-extract. Tu produis un JSON COMPLET conforme au schéma Apolline ci-dessous pour créer client + dossier en base.

RÈGLE PRIORITAIRE — SCÉNARIO REVENUS MÉDIAN :
Quand l'extract présente 3 scénarios (optimiste / médian / prudent) pour les revenus, tu retiens TOUJOURS le scénario MÉDIAN (= fixe contractuel + variable historisé moyen ou fixe seul si pas d'historique). C'est le compromis bancaire standard, ni trop optimiste ni trop conservateur.

RÈGLE DE COMPLÉTUDE — ANTI-PARESSE :
Quand le §1.2 EMPRUNTEUR 2 est rempli dans l'extract (même partiellement), tu DOIS remplir TOUS les champs disponibles d'emprunteur2 — pas juste le nom. Si tu ne mets que le nom, c'est un échec d'import. Cherche ses revenus dans §3.1 EMPRUNTEUR 2, son contrat, son employeur, son ancienneté, etc.

═══════════════════════════════════════════════════════════════════════════════
FORMAT DE SORTIE — JSON STRICT, rien d'autre :
═══════════════════════════════════════════════════════════════════════════════

{
  "client": {
    "prenom": "string — emprunteur principal (généralement Emprunteur 1)",
    "nom": "string",
    "email": "string ou ''",
    "tel": "string ou ''",
    "naissance": "YYYY-MM-DD ou ''",
    "ville": "string — ville actuelle de résidence (ex: 'DIJON')",
    "profession": "string",
    "conjoint": "string ou null — 'Prénom NOM' du co-emprunteur si présent",
    "revenuMensuelNet": number,
    "statutCommercial": "prospect",
    "notes": "string — synthèse 1-2 phrases (ex: 'Couple BESANA/AMA acquisition RP Chevigny, DPE F + travaux à chiffrer')"
  },

  "dossier": {
    "typeProjet": "string libre (ex: 'Acquisition RP', 'Investissement locatif', 'Construction')",
    "typeAchat": "Ancien|Neuf|VEFA|Construction|Terrain|Rachat|Travaux ou null",
    "destination": "Résidence principale|Résidence secondaire|Locatif|Mixte|Pro ou null",
    "typeLogement": "Maison|Appartement|Terrain|Local commercial|Immeuble|Studio ou null",
    "villeBien": "string — ville du bien à acquérir",
    "ptzZone": "A_bis|A|B1|B2|C ou null — zone PTZ si calculable",
    "compromisSigne": boolean,
    "actePrevuLe": "YYYY-MM-DD ou null",

    "montantBien": number,
    "coutLogement": number,
    "coutTerrain": number,
    "coutTravaux": number,
    "coutMobilier": number,
    "coutViabilisation": number,
    "fraisNotaire": number,
    "fraisAgence": number,
    "fraisEtablissement": number,
    "fraisExpertise": number,
    "rachatCreditCout": number,
    "apport": number,
    "montantPret": number,
    "dureeMois": number,

    "rfMenage": number,
    "rfReferenceN1": number,
    "rfReferenceN2": number,
    "allocFamiliales": number,
    "aplAlActuelle": number,
    "epargneMenage": number,
    "loyerMenage": number,
    "autresDepensesMenage": number,
    "empruntsLocatifsMenage": number,
    "empruntsNonLocatifsMenage": number,

    "creditsExistants": [
      {
        "id": "string — UUID v4 que tu génères toi-même (ex: 'cred-1', 'cred-2'…)",
        "libelle": "string — libellé court (ex: 'Prêt auto Cofidis')",
        "type": "Immobilier|Conso|Auto|Travaux|Étudiant|Autre",
        "organisme": "string — nom de l'organisme prêteur ou ''",
        "crd": number,
        "mensualite": number,
        "terme": "YYYY-MM-DD ou ''",
        "devenir": "À solder|À conserver|À reprendre|En cours"
      }
    ],

    "patrimoine": [
      {
        "id": "string — id court que tu génères (ex: 'bien-1', 'bien-2'…)",
        "libelle": "string — libellé court (ex: 'Maison familiale Bourgogne')",
        "type": "Résidence principale|Résidence secondaire|Locatif|Terrain|Local pro|Autre",
        "valeur": number,
        "crd": number,
        "revenu": number,
        "hypotheque": boolean,
        "venteEnvisagee": boolean
      }
    ],

    "bienDetails": {
      "adresseBien": "string ou '' — adresse complète du bien à acquérir (ex: '4 rue d'Amont, 39290 CHEVIGNY')",
      "vendeur": "string ou '' — nom du vendeur (ex: 'Daniel CAMBAZARD')",
      "agenceVente": "string ou '' — nom de l'agence ou prescripteur (ex: 'ANGEL IMMO')",
      "notaire": "string ou ''",
      "surfaceHabitable": number,
      "surfaceTerrain": number,
      "nbPieces": number,
      "anneeConstruction": number,
      "typeBien": "string — ex: 'Maison individuelle', 'Appartement T3'",
      "dpeClasse": "A|B|C|D|E|F|G ou ''",
      "dpeConsoKwhM2An": number,
      "gesClasse": "A|B|C|D|E|F|G ou ''",
      "gesCo2kgM2An": number,
      "coutEnergieAnnuelMin": number,
      "coutEnergieAnnuelMax": number,
      "auditEnergetiqueDispo": boolean,
      "scenarioRenovation": "string — synthèse en 1-2 phrases si l'audit propose des scénarios",
      "diagsManquants": ["string"],
      "originePropriete": "string — ex: 'Héritage probable', 'Acquisition 1985'"
    },

    "alertes": ["string", "..."],
    "legacyId": "string ou null"
  },

  "emprunteur1": {
    "civilite": "M.|Mme|Mlle",
    "prenom": "string",
    "nom": "string",
    "naissance": "YYYY-MM-DD ou ''",
    "lieuNaissance": "string ou ''",
    "nationalite": "string ou 'Française'",

    "email": "string ou ''",
    "telDom": "string ou ''",
    "telMobile": "string ou ''",
    "adresse": "string ou ''",
    "adresseSuite": "string ou ''",
    "codePostal": "string ou ''",
    "ville": "string ou ''",

    "situationFamiliale": "Célibataire|Marié(e)|Pacsé(e)|Divorcé(e)|Veuf(ve)|Concubinage",
    "regimeMatrimonial": "Communauté légale|Séparation de biens|Communauté universelle|Participation aux acquêts|N/A",
    "enfantsACharge": number,
    "rgpdAccord": false,
    "primoAccedant": boolean,

    "profession": "string",
    "typeContrat": "CDI|CDD|Période d'essai|Fonctionnaire|Indépendant|Gérant majoritaire|Profession libérale|Retraité|Sans emploi|Étudiant",
    "employeur": "string",
    "dateEmbauche": "YYYY-MM-DD ou ''",
    "anciennete": number,
    "secteur": "string",

    "salaireNet": number,
    "baBicBnc": number,
    "baBicBncMois": 12,
    "rfBrutsExistants": number,
    "autresRevenusNonSociaux": number,
    "revenusSociaux": number,
    "pensionAlimentaireRecue": number,

    "rfPersonnelN1": number,
    "rfPersonnelN2": number,

    "epargneProgrammee": number,
    "loyerPersistant": number,
    "pensionAlimentaireVersee": number,
    "empruntsLocatifs": number,
    "empruntsNonLocatifs": number,

    "statutOccupation": "Locataire|Propriétaire|Hébergé|Logement de fonction|HLM|Logé à titre gratuit",
    "logementDepuis": "YYYY-MM-DD ou ''",
    "loyerActuel": number,
    "hlm": boolean
  },

  "emprunteur2": null | { /* MÊME structure complète qu'emprunteur1, OBLIGATOIRE si §1.2 EMPRUNTEUR 2 présent dans l'extract */ }
}

═══════════════════════════════════════════════════════════════════════════════
RÈGLES D'EXTRACTION PRÉCISES :
═══════════════════════════════════════════════════════════════════════════════

1. **EMPRUNTEUR 2** — RÈGLE CRITIQUE :
   Si §1.2 EMPRUNTEUR 2 contient des données (autre chose qu'"Aucun"), tu DOIS produire un emprunteur2 complet avec :
   • Nom, prénom(s), date de naissance, lieu, nationalité (depuis §1.2)
   • Situation matrimoniale + régime (depuis §1.3)
   • Profession, employeur, SIRET, date d'entrée, ancienneté, type contrat (depuis §3.1 EMPRUNTEUR 2)
   • salaireNet : SCÉNARIO MÉDIAN (calcule depuis le tableau des bulletins ou prends la "moyenne X mois nets imposables" mentionnée)
   • rfPersonnelN1/N2 : depuis les RFR mentionnés dans §3.1 (avis IRPP par emprunteur)
   • Statut logement actuel + loyer si mentionné

2. **Revenus emprunteur** :
   - Si tableau de bulletins : moyenne des nets imposables
   - Si "Scénario médian : 1 615 €/mois" → salaireNet = 1615
   - Si seul un fixe contractuel est mentionné sans variable → salaireNet = fixe
   - Si 2 avis IRPP sont mentionnés (sur revenus 2023 et 2024) → rfPersonnelN1 = revenus 2024, rfPersonnelN2 = revenus 2023

3. **Ancienneté** : convertir en mois (ex: "6 ans 5 mois" → 77, "3 mois 25 jours" → 4)

4. **TypeContrat** — valeurs autorisées EXACTES (libellés FR — ne PAS utiliser de slugs en minuscule) :
   - "Profil A CDI" → "CDI"
   - "Période d'essai" → "Période d'essai"
   - "TNS" / "indépendant" → "Indépendant"
   - "Gérant SARL" / "Gérant majoritaire" → "Gérant majoritaire"
   - "CDD" → "CDD"
   - "Profession libérale" → "Profession libérale"
   - "Fonctionnaire" → "Fonctionnaire"
   - "Retraité" → "Retraité"
   - "Sans emploi" / "Chômage" → "Sans emploi"
   - "Étudiant" → "Étudiant"

5. **Situation matrimoniale** : depuis §1.3 FOYER — valeurs autorisées EXACTES :
   - "PACS enregistré" / "Pacsé(e)" → "Pacsé(e)"
   - "Marié(e)" → "Marié(e)"
   - "Concubinage" / "union libre" → "Concubinage"
   - "Divorcé(e)" → "Divorcé(e)"
   - "Veuf(ve)" → "Veuf(ve)"
   - "Célibataire" → "Célibataire"

6. **Régime matrimonial** : valeurs autorisées EXACTES :
   - "Communauté légale" / "Communauté réduite aux acquêts" → "Communauté légale"
   - "Séparation de biens" → "Séparation de biens"
   - "Communauté universelle" → "Communauté universelle"
   - "Participation aux acquêts" → "Participation aux acquêts"
   - Pour les célibataires ou si pas applicable → "N/A"

7. **Statut logement actuel** : depuis §2.1 — valeurs autorisées EXACTES :
   - "Locataire" → "Locataire"
   - "Propriétaire" → "Propriétaire"
   - "Hébergé" / "chez parents" → "Hébergé"
   - "Logement de fonction" → "Logement de fonction"
   - "HLM" → "HLM"
   - "Logé à titre gratuit" → "Logé à titre gratuit"
   - Si non déterminé → "Locataire" (hypothèse la plus fréquente)

8bis. **bienDetails** (§5.1, §5.2, §5.3) — caractéristiques physiques et énergétiques DU BIEN À ACQUÉRIR :
   - **adresseBien** : adresse complète extraite de §5.1 "Adresse" (ex: "4 rue d'Amont, 39290 CHEVIGNY")
   - **vendeur** : nom du vendeur depuis §5.1 (ex: "Daniel CAMBAZARD")
   - **agenceVente** : agence/prescripteur depuis l'en-tête "Origine" ou §5.1
   - **notaire** : si renseigné
   - **surfaceHabitable** : nombre depuis §5.1 ou §5.2 (ex: "110 m²" → 110)
   - **surfaceTerrain** : nombre, 0 si non communiquée
   - **nbPieces** : 0 si non précisé
   - **anneeConstruction** : nombre (ex: 1900)
   - **typeBien** : depuis §5.1 "Type" (ex: "Maison individuelle")
   - **dpeClasse** : classe énergétique A à G depuis §5.2 (ex: "F")
   - **dpeConsoKwhM2An** : depuis §5.2 (ex: "351 kWh/m²/an" → 351)
   - **gesClasse** : classe émissions GES A à G depuis §5.2
   - **gesCo2kgM2An** : depuis §5.2 (ex: "71 kg CO₂/m²/an" → 71)
   - **coutEnergieAnnuelMin** / **coutEnergieAnnuelMax** : fourchette depuis §5.2 (ex: "3 797 € à 5 137 €/an" → min=3797, max=5137)
   - **auditEnergetiqueDispo** : true si §5.3 AUDIT ÉNERGÉTIQUE rempli
   - **scenarioRenovation** : synthèse 1-2 phrases si l'audit propose des scénarios (ex: "Audit avec 2 scénarios — rénovation en une fois ou par étapes, chiffrages à demander")
   - **diagsManquants** : array des diagnostics manquants depuis §5.4 (ex: ["ERP", "Termites", "Bornage"])
   - **originePropriete** : si renseigné (ex: "Héritage probable vu indivision")

   ⚠ Si une donnée n'est pas dans l'extract → laisse à 0 (nombres) ou "" (strings). N'invente JAMAIS.

9. **Bien immobilier** (§5.1) — valeurs autorisées EXACTES pour les champs du dossier :
   - villeBien : ville exacte en majuscule (ex: "CHEVIGNY")
   - typeProjet : string libre (ex: "Acquisition RP", "Investissement locatif")
   - typeAchat : "Ancien" pour maison/appartement existant, "Neuf" pour neuf, "VEFA" si VEFA, "Construction" si construction neuve, "Rachat" si rachat de crédit, "Travaux" si financement travaux
   - typeLogement : "Maison" / "Appartement" / "Terrain" / "Local commercial" / "Immeuble" / "Studio"
   - destination : "Résidence principale" / "Résidence secondaire" / "Locatif" / "Mixte" / "Pro"
   - Si prix de vente "Non communiqué" → montantBien=0 et coutLogement=0
   - Si prix de vente connu → mets-le dans montantBien ET coutLogement (sauf si terrain séparé)

8. **Travaux** : si l'audit énergétique mentionne un chiffrage (scénario 1 ou 2), prends-le. Sinon coutTravaux=0.

9. **Frais notaire** :
   - Si chiffré explicitement → mets la valeur
   - Sinon estime via : ancien ≈ 8% montantBien, neuf ≈ 3% montantBien
   - Si montantBien=0 → fraisNotaire=0

10. **Apport** : utilise l'épargne mobilisable totale (livrets + PEE débloquable selon §4.2). Ex: "Apport mobilisable total : ~48 856 €" → apport=48856.

11. **Épargne foyer** : somme des livrets + PEE + assurance-vie + CTO mentionnés en §4.2. Ex: ~48 856 € → epargneMenage=48856.

12. **Crédits existants** (§2.2) :
   - Si "AUCUN CRÉDIT" / "À reconstituer au R1" → creditsExistants=[] (tableau vide)
   - Sinon liste chaque crédit avec ses caractéristiques

13. **Patrimoine immobilier détenu** (§2.4) :
   - Si "Aucun patrimoine immobilier détenu" → patrimoine=[] (tableau vide)
   - Sinon liste chaque bien

14. **Loyer / charges menages** (§2.3) :
   - loyerMenage : loyer actuel s'il est chiffré
   - autresDepensesMenage : 0 si non chiffré (le courtier complétera au R1)

15. **Alertes** : copie les signaux 🔴 et ⚠⚠⚠ de la SYNTHÈSE COURTIER finale. Exemples :
    - "DPE F — travaux énergétiques requis avant 2028"
    - "Emp1 ancienneté CDI courte (3 mois)"
    - "Trou de revenus 2024 Emp1 (chômage probable)"
    - "Éloignement professionnel Emp2 +258 €/mois carburant"
    - "Maison 1900 — risque charpente/fondations"

16. **legacyId** : extrait le numéro de référence depuis le titre du dossier (ex: "ZZ BESANA AMA 46 478" → "46 478", ou null si absent).

17. **Notes client** : synthèse en 1-2 phrases pour rappel rapide dans la liste prospects. Doit être actionnable (ex: "Couple PACS, acquisition RP maison 1900 à Chevigny + travaux DPE F · ancienneté Arnaud courte à valider").

═══════════════════════════════════════════════════════════════════════════════
VALEURS PAR DÉFAUT (si non disponible) :
═══════════════════════════════════════════════════════════════════════════════
- Strings vides : ""
- Nombres : 0
- Booléens : false (sauf primoAccedant : true par défaut pour acquisition RP)
- Tableaux : []
- baBicBncMois : 12 (toujours, c'est la convention annualisation)
- nationalite : "Française" par défaut
- statutCommercial : "prospect" (toujours pour un import)
- dureeMois : 240 si non spécifiée

═══════════════════════════════════════════════════════════════════════════════
RÈGLES FINALES :
═══════════════════════════════════════════════════════════════════════════════
- AUCUN texte hors du JSON. AUCUN markdown. AUCUN \`\`\` autour.
- Tous les montants en EUROS ENTIERS, sans symbole €, sans espace
- Toutes les dates au format ISO YYYY-MM-DD
- Quand emprunteur2 existe, TU REMPLIS TOUS SES CHAMPS DISPONIBLES — pas juste le nom
- Tu N'INVENTES PAS de données : si une info n'est pas dans l'extract, mets la valeur par défaut`
