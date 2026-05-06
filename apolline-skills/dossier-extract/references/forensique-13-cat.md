# Références `/dossier-extract` v2.3 — Analyse forensique des relevés bancaires (13 catégories + PNB)

> Fichier annexe lu par `/dossier-extract` v2.3+ depuis le dossier `references/`. Contient le détail des 13 catégories d'analyse forensique à appliquer sur les 3 mois de relevés bancaires fournis, dont la catégorie 13 (Analyse du PNB) qui alimente l'argumentaire de négociation bancaire. Le SKILL.md principal pointe vers ce fichier pour la section "Analyse forensique des relevés bancaires".

## Analyse forensique des relevés bancaires

**Analyser ligne par ligne TOUTES les transactions** sur les 3 mois de relevés fournis, pour chaque emprunteur. Ces données alimentent exclusivement les notes internes — elles ne figurent jamais dans les onglets client.

### 1. Jeux (FDJ, paris sportifs, PMU)
Compter chaque opération FDJ / PMU / paris en ligne (Winamax, Betclic…). Quantifier : nombre d'opérations par mois, total mensuel, détail de chaque montant. Calculer le % du salaire net. Les banques voient ces libellés directement sur les relevés — c'est un motif classique de refus ou de vigilance renforcée.

### 2. Tabac / CBD / "Vices"
Identifier les enseignes tabac (Havane, bureau de tabac, CBD shops…). Signaler tout achat unitaire > 50 €. Cumuler avec les jeux pour calculer le total "dépenses vices".

### 3. Retraits DAB (espèces)
Volume et fréquence des retraits cash. Calculer le % du salaire en cash. Signaler les retraits nocturnes, les retraits multiples le même jour, les montants inhabituellement élevés. L'usage cash est opaque et peut masquer d'autres dépenses.

### 4. Abonnements numériques (Apple, Google)
Lister tous les prélèvements Apple / Google. Signaler les pics (plusieurs débits le même jour = souscriptions impulsives ou achats in-app). Calculer le coût total mensuel.

### 5. Factures téléphone
Analyser la volatilité des factures (Orange, SFR, Bouygues, Free…). Signaler les écarts > 30% entre mois. Une facture > 80 €/mois pour un seul mobile est anormale (hors-forfait, contenus premium, abonnements surtaxés).

### 6. Flux croisés entre comptes du couple
Lister tous les virements entre les comptes des co-emprunteurs. Calculer le % du salaire transféré. Si un emprunteur transfère > 50% de son salaire vers l'autre, c'est un signal de dépendance financière — les banques peuvent y voir un circuit artificiel.

### 7. Dépendance familiale — Aides régulières des parents
Tableau : Source (nom du parent) | Montant mensuel | Objet | Bénéficiaire. Distinguer les aides récurrentes (mensuelles) des aides exceptionnelles. Signaler si sans ces aides le couple serait en découvert. Les banques ne retiennent pas ces revenus et y voient un signe de fragilité.

### 8. Chronologie du découvert
Timeline précise : Date | Solde | Commentaire. Montrer l'enchaînement entrée en découvert → sortie (grâce à quel virement ?) → retour en découvert. Signaler les dépassements de découvert autorisé, les commissions d'intervention, les intérêts débiteurs (montant + TAEG).

### 9. Comptes miroirs non communiqués
Détecter les virements de l'emprunteur vers lui-même (= il possède un autre compte non déclaré). Lister les dates et montants. Ce compte peut contenir d'autres crédits ou un découvert non visible.

### 10. Activités parallèles (intérim, extras…)
Détecter les virements d'agences d'intérim (Manpower, Adecco, Randstad…) ou d'employeurs secondaires en parallèle d'un CDI. Même si les montants sont faibles, les banques peuvent s'interroger sur la stabilité de l'emploi principal.

### 11. Tableau récapitulatif des dépenses discrétionnaires
Synthèse par catégorie sur les 3 mois : Catégorie | Mois 1 | Mois 2 | Mois 3 | Moy./mois. Inclure : jeux, tabac, retraits DAB, abonnements (Canal+, Spotify, Netflix…), sport, Apple/Google, fast-food/restaurants. Calculer le **% du salaire net imposable** — c'est le chiffre-clé qui montre la part de revenus qui part en dépenses non essentielles.

### 12. Matrice de criticité — Synthèse des risques
Tableau final : Risque | Niveau | Impact banque | Action requise. Niveaux de sévérité :
- 🔴 CRITIQUE / ÉLEVÉ — motif de refus ou de blocage probable
- 🟡 MODÉRÉ / MINEUR — point de vigilance à préparer
- 🟢 À TRAITER — anomalie mineure à corriger avant dépôt

Lister TOUS les risques identifiés dans les 12 analyses précédentes, du plus critique au moins grave.

### 13. Analyse du Produit Net Bancaire (PNB) — Rentabilité client pour la banque

Cette analyse est un levier de négociation puissant. Quand tu déposes un dossier en banque, montrer que le client rapporte déjà X €/an à sa banque actuelle (ou qu'il va en rapporter autant à la nouvelle) change la dynamique : le banquier ne fait plus une faveur, il investit dans un client rentable. L'idée est de scanner les relevés pour chiffrer précisément ce que la banque facture au client, réparti en trois grandes familles.

**A. Assurances bancaires (produits distribués par la banque)**

Détecter les prélèvements d'assurances souscrites auprès de la banque elle-même (pas les assurances externes). Les libellés typiques contiennent souvent le nom de la filiale assurance de la banque :

- **MRH (Multirisque Habitation)** : PACIFICA (Crédit Agricole), IARD (Société Générale), CNP, CARDIF (BNP), ACM (Crédit Mutuel), SOGECAP, GROUPAMA BANQUE, SURAVENIR, PREDICA…
- **Assurance auto** : mêmes filiales, souvent libellé "ASS AUTO", "COTIS AUTO", "PRIME AUTO"
- **Complémentaire santé / Mutuelle** : libellés "SANTE", "MUTUELLE", "PREVOYANCE SANTE", "COMPLEMENT SANTE"
- **Prévoyance (décès, invalidité, ITT)** : "PREVOYANCE", "ASS PREVOY", "GAV" (Garantie Accidents de la Vie), "PROTECTION FAMILLE"
- **Assurance emprunteur existante** : "ASS PRET", "ADI", "COTIS ASSURANCE PRET" — si le client a déjà un crédit avec cette banque

Pour chaque assurance détectée : noter le libellé exact, le montant mensuel, et la banque concernée.

**B. Frais bancaires et services**

- **Cotisation carte bancaire** : "COTIS CARTE", "CB VISA", "CB MASTERCARD", "COTISATION ANNUELLE" — attention, parfois prélevée trimestriellement ou annuellement (diviser pour obtenir le mensuel)
- **Tenue de compte** : "FRAIS TENUE COMPTE", "FRAIS DE COMPTE"
- **Package / Convention de services** : "CONVENTION", "PACKAGE", "OFFRE MOZAIC", "JAZZ", "SOBRIO", "IDEO", "ESPRIT LIBRE" — ce sont des offres groupées que les banques adorent vendre
- **Commissions d'intervention** : "COMMISSION INTERV", "FRAIS FORÇAGE" — facturées à chaque opération passée malgré un solde insuffisant
- **Frais de virements** : "FRAIS VIR", "COMM VIREMENT" — surtout virements internationaux
- **Frais d'incidents** : "LETTRE INJONCTION", "FRAIS REJET", "FRAIS IRREGULARITE"
- **Cotisation à des services optionnels** : "ASSURANCE MOYENS PAIEMENT", "SECURICOMPTE", "ALERTE SMS", "E-CARTE BLEUE"

**C. Épargne captive (la banque perçoit des frais de gestion)**

Détecter les versements programmés vers des produits d'épargne gérés par la banque :

- **Assurance-vie** : "VIR ASSURANCE VIE", "VERSEMENT AV", "PREDICA VIE", "CARDIF VIE", "SOGECAP VIE", "SURAVENIR RENDEMENT"
- **PEL / CEL** : "VIR PEL", "VERSEMENT PEL" — versement programmé obligatoire
- **Livrets maison** : versements programmés vers Livret A, LDDS, LEP (la banque ne gagne pas dessus directement, mais c'est de l'encours qui compte pour elle)
- **PEA / Compte-titres** : "VIR PEA", "VERSEMENT CTO"
- **Épargne salariale** : "PERCO", "PEE", "PERE" si versements complémentaires

L'épargne captive est un argument fort : un client qui épargne 500 €/mois chez sa banque, c'est un client que la banque ne veut pas perdre — et que la banque concurrente veut capter.

**Calcul et présentation du PNB**

Le nombre de mois disponibles varie d'un dossier à l'autre (souvent 3 ou 4 mois de relevés). Adapter le calcul en conséquence :

```
ANALYSE PNB — [Nom Banque] — sur [N] mois de relevés ([mois début] à [mois fin])

| Catégorie                        | Détail                          | Montant/mois | Total période |
|----------------------------------|---------------------------------|--------------|---------------|
| ASSURANCES BANCAIRES             |                                 |              |               |
|   MRH                            | PACIFICA HABITATION             |      32,50 € |      130,00 € |
|   Auto                           | PACIFICA AUTO                   |      48,00 € |      192,00 € |
|   Prévoyance / GAV               | GAV PACIFICA                    |      12,80 € |       51,20 € |
| FRAIS BANCAIRES                  |                                 |              |               |
|   Package                        | CONVENTION IDEO                 |      12,90 € |       51,60 € |
|   Cotisation CB                  | VISA PREMIER (annuelle 140,40€) |      11,70 € |       46,80 € |
|   Tenue de compte                | FRAIS TENUE CPT                 |       2,00 € |        8,00 € |
| ÉPARGNE CAPTIVE                  |                                 |              |               |
|   Assurance-vie (versement prog.)|VIR PREDICA VIE                  |     200,00 € |      800,00 € |
|   PEL (versement prog.)          | VIR PEL                         |      45,00 € |      180,00 € |
|──────────────────────────────────|─────────────────────────────────|──────────────|───────────────|
| TOTAL PNB (hors épargne)         |                                 |     119,90 € |      479,60 € |
| TOTAL ÉPARGNE CAPTIVE            |                                 |     245,00 € |      980,00 € |
| TOTAL PNB GLOBAL                 |                                 |     364,90 € |    1 459,60 € |
|──────────────────────────────────|─────────────────────────────────|──────────────|───────────────|
| PNB annualisé (hors épargne)     |                                 |              |    1 438,80 € |
| PNB annualisé global             |                                 |              |    4 378,80 € |
```

Notes de calcul :
- **Période** : indiquer clairement le nombre de mois analysés (ex : "4 mois, de janvier à avril 2026")
- **Montant/mois** : pour les prélèvements mensuels c'est direct ; pour les prélèvements trimestriels ou annuels (ex : cotisation CB annuelle), ramener au mois
- **Total période** : montant/mois × nombre de mois de relevés disponibles
- **PNB annualisé** : montant/mois × 12 — c'est le chiffre qui parle au banquier
- Séparer le PNB "dur" (assurances + frais = revenus directs pour la banque) du PNB "global" (avec épargne captive), car l'épargne est un argument différent (encours vs revenus)

**Argument de négociation à produire**

Conclure l'analyse PNB par un court paragraphe exploitable en rendez-vous banquier :

> « Le client génère un PNB estimé à [montant] €/an pour [Banque], dont [montant] € en assurances et frais bancaires. L'épargne captive s'élève à [montant] €/mois ([montant] €/an). Ce profil représente un client à forte valeur ajoutée pour l'établissement. En cas de rachat par une banque concurrente, l'ensemble de ce PNB est transférable. »

Si le client a des comptes dans plusieurs banques, produire un tableau PNB par banque.

