# Références `/dossier-extract` v2.3 — Profils de revenus (A → F)

> Fichier annexe lu par `/dossier-extract` v2.3+ depuis le dossier `references/`. Contient les règles de calcul des revenus retenus par profil d'emprunteur. Le SKILL.md principal pointe vers ce fichier pour la section **"Règles de calcul des revenus — Méthodologie par profil"**.

## Règles de calcul des revenus — Méthodologie par profil

Les banques ne retiennent pas les revenus de la même façon selon le statut professionnel. **Règle générale : toujours se baser sur les montants déclarés aux IRPP**, sauf pour les salariés CDI stables. Les IRPP sont la source la plus fiable et la plus facilement vérifiable par la banque.

### A. Salarié CDI (emploi stable)

- Méthode : moyenne des 3 derniers bulletins de salaire (net imposable)
- Si progression salariale récente : privilégier le dernier bulletin
- Source : bulletins de salaire (P3)

### B. Profession libérale / BNC (médecin, kiné, infirmier, dentiste, avocat, architecte…)

- Méthode : BNC déclarés sur les 2 ou 3 derniers IRPP → moyenne → ÷ 12
- Formule : `(BNC année 1 + BNC année 2 + BNC année 3) ÷ 3 ÷ 12`
- **Attention au régime fiscal** :
  - **Micro-BNC** : le montant sur l'IRPP est le CA brut (recettes). L'abattement de 34% est calculé par l'administration. Pour le calcul bancaire, on prend le montant déclaré tel quel (= recettes brutes), car c'est ce que la banque voit.
  - **BNC réel** : le montant sur l'IRPP est le bénéfice net (après déduction des charges réelles). C'est directement le revenu retenu.
  - Si passage d'un régime à l'autre : le mentionner et expliquer l'impact.
- Source : IRPP (P3), ligne "Revenus des professions non salariées" ou "BNC"

### C. Gérant de société (SELARL, SARL, EURL, SAS, SASU) — Exercice en société

Un emprunteur gérant/dirigeant peut percevoir plusieurs types de revenus de sa structure :
  - BNC professionnels (activité libérale exercée via SELARL)
  - **Rémunération de gérant majoritaire** (article 62 du CGI — statut TNS)
  - Salaires (si le dirigeant est assimilé-salarié : SAS, SASU, gérant minoritaire de SARL)
  - Dividendes distribués

**Méthode de base — moyenne IRPP :**
Additionner TOUTES les lignes de revenus provenant de la structure sur chaque IRPP, puis moyenne sur 2 ou 3 ans ÷ 12. Source : IRPP (P3), lignes BNC + Traitements/salaires + "Revenus des associés et gérants" (art. 62).

#### ⚠ Cas difficile — Rémunération récemment instituée

Quand la rémunération du gérant a été **instituée récemment** (moins de 24 mois), les RFR historiques sont artificiellement bas car antérieurs à la mise en place. La méthode "moyenne 3 RFR" devient inapplicable — un analyste bancaire orthodoxe refusera sinon le dossier.

Dans ce cas, utiliser la **méthodologie des 3 niveaux de preuve + 3 approches convergentes** ci-après.

**HIÉRARCHIE DES 3 NIVEAUX DE PREUVE :**

| Niveau | Source | Crédibilité | Ce que ça apporte |
|--------|--------|-------------|-------------------|
| 1 — Déclaratif | Relevés bancaires (VIR de la société au gérant) | ★★ | Montre la réalité des flux mais pas la pérennité |
| 2 — Expert-comptable | Plaquettes du cabinet (FIDUCIAL, CERFRANCE, etc.) | ★★★ | Tiers mais "amical au client", déjà vu embelli |
| **3 — Tiers officiel** | **Dépôts BODACC au greffe + INSEE état actif** | ★★★★★ | Opposable, preuve légale, impossible à retoucher |
| 4 — État (bonus) | Liasse fiscale 2033 + att. URSSAF + att. DGFiP | ★★★★★ | Ultime — pour dossier passant en commission BNP/CIC/SG |

La **section dédiée « Vérification tierce officielle »** (plus bas) explique comment produire systématiquement les éléments de niveau 3.

**LES 3 APPROCHES CONVERGENTES :**

Pour chaque emprunteur gérant avec rémunération récente, calculer **les 3 approches suivantes**, puis retenir le médian pondéré :

**Approche A — Rémunération constatée réelle (niveau 1 + 2)**
- Montant mensuel régulier constaté sur les relevés + charges de personnel des plaquettes / 12
- Formule : `rémunération mensuelle × 12`
- Usage : upper case défendable

**Approche B — Soutenabilité par la CAF (niveau 2 + 3)**
- Logique : la société doit pouvoir soutenir la rémunération sur sa CAF
- Règle prudence bancaire : **70 % de la CAF moyenne 3 ans**
- Formule : `0,70 × (CAF N-2 homogénéisée + CAF N-1 + CAF N) ÷ 3`
- Homogénéisation : si un exercice fait 13 mois (création SARL), × 12/13

**Approche C — Soutenabilité par le Résultat Net (niveau 2 + 3)**
- Logique ultra-conservatrice : la rémunération ne doit pas dépasser un multiple raisonnable du RN
- Règle prudence bancaire : **60 % du RN moyen 3 ans**
- Formule : `0,60 × (RN N-2 homogénéisé + RN N-1 + RN N) ÷ 3`
- Usage : worst case à présenter

**SYNTHÈSE MÉTHODOLOGIQUE — 4 SCÉNARIOS :**

| Scénario | Calcul | Usage comité |
|---|---|---|
| MIN prudent | Approche C seule | Worst case — si comité très rigide |
| **MÉDIAN pondéré** | **0,5 × A + 0,3 × B + 0,2 × C** | **Retenu recommandé** |
| Upper case | Approche A seule | Si pièces niveau 4 obtenues |
| Moyenne simple | (A + B + C) ÷ 3 | Vérification croisée |

⭐ **REVENU RETENU recommandé** : le **médian pondéré** (50 % réel + 30 % CAF + 20 % RN), à présenter en première intention. L'argumentaire doit citer :
1. Continuité documentée de la rémunération (nb mois observés + charges personnel plaquettes)
2. Soutenabilité prouvée (ratio CAF / rémunération + cotisations)
3. Croissance CA et VA sur 3 ans
4. Trésorerie en hausse
5. CCA en repli (le gérant rembourse son compte courant)
6. Aucun emprunt professionnel bancaire
7. **Validation tierce officielle** (BODACC à jour, INSEE actif, pas de procédure) — cf. section dédiée
8. Contexte TNS / gérant : rémunération définie par PV d'AG, pas rigide

**PIÈCES NIVEAU 4 À DEMANDER** (pour dossier à fort enjeu passant en commission BNP / CIC / SG) :
- Liasse fiscale 2033 exercice N complète (2033-A bilan, 2033-B résultat, 2033-C immob., 2033-D provisions, 2033-E VA)
- Attestation de régularité fiscale DGFiP (gratuite, 48 h sur impots.gouv.fr)
- Attestation de régularité sociale URSSAF TNS (gratuite, 48 h sur urssaf.fr)
- Attestation écrite du cabinet comptable sur la régularité de la rémunération gérant (1 page)
- Kbis extrait numérique à jour (gratuit sur monidenum.fr)
- Statuts à jour + PV d'AG de nomination / institution de la rémunération
- Relevés bancaires compte pro de la société (3 mois minimum)

Source (pour toutes les méthodes) : IRPP (P3), plaquettes comptables (P3), relevés bancaires (P4), INSEE/BODACC (externe).

### D. Auto-entrepreneur (micro-BIC / micro-BNC)

- Méthode : CA déclarés sur les 2 ou 3 derniers IRPP → appliquer l'abattement forfaitaire → moyenne → ÷ 12
- Abattements : 34% micro-BNC | 50% micro-BIC prestations | 71% micro-BIC vente
- Formule : `((CA1 + CA2 + CA3) ÷ 3 × (1 - taux_abattement)) ÷ 12`
- Alternative : certaines banques prennent le CA brut et appliquent elles-mêmes l'abattement. Indiquer les deux calculs si pertinent.
- Source : IRPP (P3) + déclarations URSSAF (P3) pour vérification croisée

### E. Intérimaire — Norme bancaire stricte

La règle bancaire pour les intérimaires est **binaire** et repose sur l'ancienneté continue en intérim :

**Cas 1 — Intérim ≥ 2 ans d'ancienneté continue :**
- Les revenus SONT retenus par les banques.
- Méthode : total des revenus sur la période d'intérim **÷ 36 mois** (lissage conservateur imposé par les banques, et non ÷ par le nombre de mois réels).
- Formule : `Total revenus intérim sur la période ÷ 36`
- Source : bulletins de salaire intérim (P3) + IRPP (P3) pour validation croisée

**Cas 2 — Intérim < 2 ans d'ancienneté continue :**
- **Revenus = 0 € retenu** (revenus considérés comme aléatoires)
- C'est un blocage absolu : aucune exception, aucun calcul de moyenne
- Même si l'emprunteur a un historique CDI récent dans le même secteur, ses revenus intérim actuels ne sont pas retenus. Mentionner l'historique CDI comme argument qualitatif uniquement.
- **Action recommandée** : demander si un CDI est en perspective (promesse d'embauche, fin de période d'essai), noter la date prévisionnelle

> **GARDE-FOU EXTRACTION — Intérim < 2 ans** : quand l'emprunteur est identifié intérimaire avec ancienneté < 2 ans, appliquer IMPÉRATIVEMENT dans l'summary extract :
> 1. `⭐ REVENU RETENU RECOMMANDÉ : 0 €/mois (intérim < 2 ans — norme bancaire stricte)` — JAMAIS un montant positif en recommandation principale.
> 2. Le calcul IRPP peut figurer en complément UNIQUEMENT sous l'intitulé `Alternative optimiste (argumentation banque) : X €/mois` — clairement séparé et subordonné.
> 3. Dans la synthèse foyer, utiliser 0 € pour cet emprunteur dans le TOTAL principal. Ajouter une ligne `Variante optimiste (si banque accepte intérim) : Y €/mois`.
> 4. Ce garde-fou est NON NÉGOCIABLE : ne pas se laisser influencer par le fait que les revenus IRPP existent ou que les bulletins montrent des salaires. La règle des 2 ans prime sur les données brutes.

**Ancienneté intérim** : compter depuis la date de début de la première mission intérim CONTINUE (sans interruption significative > 1 mois). Un passage intérim → CDI → retour intérim remet le compteur à zéro.

### E bis. CDD / Contrat temporaire avec diplôme élevé

- **Exception diplôme élevé** : si l'emprunteur possède un diplôme élevé garantissant une forte employabilité (Docteur en médecine, Docteur en pharmacie, ingénieur, profession réglementée…), on peut retenir ses revenus même en CDD.
- Méthode : salaires déclarés sur les 2 ou 3 derniers IRPP → moyenne → ÷ 12
- Formule : `(Salaires déclarés année 1 + année 2 + année 3) ÷ 3 ÷ 12`
- **Justification obligatoire** : noter que le niveau d'études légitime la prise en compte des revenus malgré le statut précaire.
- Cette exception NE s'applique PAS aux intérimaires — pour l'intérim, c'est la règle des 2 ans ci-dessus qui prime.
- Source : IRPP (P3), ligne "Traitements et salaires"

### F. Revenus fonciers / LMNP

- Vérifier systématiquement sur les IRPP si des revenus fonciers ou LMNP sont déclarés.
- Si oui : mentionner séparément avec le régime (micro-foncier, réel) et le montant net retenu.
- Les banques retiennent généralement **70% des revenus fonciers bruts**.

