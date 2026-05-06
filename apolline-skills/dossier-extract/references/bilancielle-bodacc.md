# Références `/dossier-extract` v2.3 — Analyse bilancielle et validation tierce BODACC/INSEE

> Fichier annexe lu par `/dossier-extract` v2.3+ depuis le dossier `references/`. Contient les règles d'analyse bilancielle (SIG, ratios banquier) pour les gérants/dirigeants/indépendants au réel, ainsi que la méthodologie de vérification tierce officielle (niveau 3 de preuve — BODACC + INSEE). Le SKILL.md principal pointe vers ce fichier pour la section §3.3.

## Analyse bilancielle — Bilans, liasses fiscales et plaquettes comptables

Quand le dossier contient des bilans comptables (plaquettes, liasses fiscales 2031/2033/2035/2050-2059, rapports d'expert-comptable), ces documents sont une mine d'or pour le banquier. Un IRPP ne montre que le résultat fiscal final ; le bilan montre la mécanique qui produit ce résultat — la structure de l'exploitation, sa capacité de génération de trésorerie, et la soutenabilité de la dette.

L'objectif est d'extraire les données brutes nécessaires pour que `/dossier-html` puisse construire l'analyse bilancielle (SIG + ratios banquier) sans avoir à relire les PDF.

### Déclenchement

Dès qu'au moins un des documents suivants est présent :
- Plaquette comptable (rapport expert-comptable)
- Liasse fiscale (2031 BA, 2035 BNC, 2033 BIC simplifié, 2050-2059 BIC/IS)
- Bilan simplifié ou complet (actif/passif)
- Compte de résultat

Si seuls les IRPP sont disponibles (pas de bilan ni liasse), ne pas générer cette analyse.

### Pages clés dans les plaquettes comptables

Les plaquettes (type cabinet ANDRE, CERFRANCE, etc.) suivent souvent cette structure :
- Pages 4-6 : Bilan actif / passif
- Pages 8-12 : Compte de résultat détaillé
- Pages 16-20 : Soldes Intermédiaires de Gestion (SIG) — **page la plus importante**
- Pages 25-35 : Annexes, détail des emprunts

Utiliser `pdfplumber` pour les tableaux. Si scan non sélectionnable, utiliser `Read` en mode image.

### Données à extraire — SIG

Extraire pour **chaque exercice disponible** (idéalement N-2, N-1, N). Adapter les lignes au type de structure :

**EARL / Exploitation agricole :** CA net, Production de l'exercice, Marge brute, VA, **EBE**, Résultat d'exploitation, RCAI, **Résultat net**, **CAF** (= résultat net + dotations amortissements − reprises).

**BNC réel :** Recettes encaissées, Charges professionnelles, Bénéfice net, Cotisations sociales, Revenu disponible avant IR.

**SAS / SARL / SELARL :** CA net, Marge brute, EBE, Résultat d'exploitation, Résultat net, CAF, Rémunération dirigeant (art. 62 ou salaires), Dividendes distribués.

### Données à extraire — Bilan (Actif / Passif)

Pour N-1 et N : Total bilan, Actif immobilisé net, Stocks, Créances clients, Autres créances, Disponibilités, **Capitaux propres**, CCA (Compte Courant d'Associé), Emprunts et dettes bancaires, Dettes fournisseurs.

### Données à extraire — Emprunts professionnels (détail)

Si les annexes détaillent les emprunts : Référence prêt, Objet, CRD fin exercice, Annuité, Taux, Date de fin.

### Calculs à produire

À partir des données brutes, calculer :

**Ratios obligatoires (toutes structures) :**
- Endettement pro / EBE (annuités ÷ EBE × 100) → < 50 % sain, 50-70 % tendu, > 70 % critique
- Capacité de remboursement (dettes ÷ CAF en années) → < 5 sain, 5-7 acceptable, > 7 tendu
- Marge nette (résultat net ÷ CA × 100) → > 10 % bon, 5-10 % correct, < 5 % fragile
- EBE / CA (× 100) → > 25 % solide, 15-25 % correct, < 15 % fragile
- FR = (Capitaux propres + CCA + Emprunts LT) − Actif immobilisé net
- BFR = Stocks + Créances − Dettes fournisseurs
- Trésorerie nette = FR − BFR

**Ratios spécifiques EARL :**
- Prélèvements privés / EBE = (CCA N-1 − CCA N + Résultat net) ÷ EBE × 100
- Évolution CCA (montant et %)
- Annuités / EBE (× 100)
- Capitaux propres / Total bilan (× 100)

**Ratios spécifiques SAS / SARL :**
- (Rémunération + dividendes) / Résultat net
- Capitaux propres / Total bilan
- Gearing = Dettes financières ÷ Capitaux propres

## Vérification tierce officielle — Niveau 3 de preuve (BODACC + INSEE)

### Déclenchement

**Obligatoire** dès que l'un au moins des emprunteurs est :
- Gérant, président, directeur général, associé majoritaire d'une société
- Exerçant en SARL / EURL / SAS / SASU / SELARL / SCI / SNC / SCP / SCM
- Exploitant individuel avec EIRL ou micro-entreprise déclarée

Cette vérification a deux objectifs :
1. **Crédibiliser** les plaquettes expert-comptable (niveau 2) par une source officielle opposable (niveau 3).
2. **Détecter** d'éventuels signaux d'alerte (procédures collectives, radiation, comptes non déposés, structures cachées) qu'un banquier découvrirait inévitablement en instruction.

### Workflow

**Étape 1 — Obtenir le SIREN**

- Si fourni dans une pièce du dossier (plaquette, statuts, Kbis, avis SIRENE, bulletin de salaire si l'emprunteur a aussi un salaire de sa propre structure) : extraire directement.
- Sinon : requête `https://recherche-entreprises.api.gouv.fr/search?q=<nom_entreprise>&code_postal=<CP>` (ou filtre `departement`).
- Vérifier que le résultat correspond bien à l'emprunteur : croiser nom commercial, siège, dirigeant, date de création.

**Étape 2 — Vérification INSEE / RNE**

Requête : `https://recherche-entreprises.api.gouv.fr/search?q=<SIREN>` (ou nom direct).

Extraire et conserver :
- SIREN, SIRET siège, forme juridique (code INSEE), catégorie (PME/ETI/GE)
- Code NAF + libellé, date création
- **État administratif** (A = actif, F = fermé)
- Siège (adresse, coordonnées GPS)
- Date dernière MAJ INSEE + MAJ RNE (prouve que les données sont à jour)
- **Dirigeants** (nom, prénom, date naissance, qualité, type physique/morale)
- Tranche effectif (attention : pour SARL avec gérant TNS, "NN" est normal — le gérant n'est pas un salarié URSSAF classique)

**Étape 3 — Vérification BODACC**

Requête : `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre+LIKE+%22<SIREN>%22&order_by=dateparution+DESC&limit=50`

Classer les annonces par famille :
- **Dépôts des comptes** (familleavis `dpc`) : lister chaque dépôt avec date parution + date clôture exercice + délai légal (7 mois max). L'option `L.232-25` (confidentialité) est normale pour une PME.
- **Procédures collectives** (familleavis `pcl`) : sauvegarde, redressement, liquidation — drapeau rouge majeur.
- **Actes** (famille `acte`) : cessions parts, augmentation capital, changement gérant, transfert siège — à commenter.
- **Modifications** (famille `mod`) : modifications générales RCS.
- **Radiations** (famille `rad`) : radiation RCS — drapeau rouge.

**Étape 4 — Cross-check croisé**

- **Dates de clôture** sur BODACC vs **dates de clôture** sur les plaquettes comptables : doivent être identiques.
- **Dirigeant** sur RNE vs **nom sur plaquettes / statuts / CNI** : doit matcher.
- **Adresse siège INSEE** vs **adresse plaquettes / IRPP** : doit matcher (ou documenter un transfert).
- **Numéro SIREN** sur INSEE / BODACC / plaquettes : identique.

**Étape 5 — Recherche de structures cachées**

Requête : `https://recherche-entreprises.api.gouv.fr/search?q=<NOM>+<Prénom>&departement=<dépt>` → liste toutes les structures où l'emprunteur apparaît comme dirigeant/associé.

Comparer avec ce que l'emprunteur a déclaré dans sa fiche prospect. Toute structure non déclarée = à questionner (SCI familiale, holding patrimoniale, etc.).

**Étape 6 — Bonus Pappers (si crédits disponibles)**

Utiliser les outils MCP Pappers pour :
- `informations-entreprise` → scoring financier, prochaine date clôture, convention collective, observations RCS
- `comptes-entreprise` → comptes détaillés déposés (si pas sous confidentialité L.232-25)
- `cartographie-entreprise` → liens capitalistiques (filiales, maison mère, entreprises citées)

Si Pappers retourne "pas de crédits", **continuer avec les API publiques** — c'est rarement bloquant.

### Sortie dans le summary extract

Alimenter deux sections :
- **§1.4** (Entités morales signataires) — bloc IDENTIFIANTS OFFICIELS + dépôts BODACC + vérifications négatives + autres structures
- **§3.3.6** (Validation tierce officielle) — conclusion analyste consolidant niveaux 1+2+3
- **§3.3.7** (Pièces niveau 4 à demander) — checklist actionnable

