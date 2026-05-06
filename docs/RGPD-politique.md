# Politique RGPD — Groupe Apolline

> Document de référence pour la conformité RGPD du logiciel Extr'Apol.
> Version `2026-04-30` — à mettre à jour à chaque changement majeur.

## 1. Responsable du traitement

- **Raison sociale** : Groupe Apolline
- **SIREN** : (à compléter via `APOLLINE_SIREN` env)
- **Activité** : Courtage en opérations bancaires et services de paiement (IOBSP)
- **DPO / Contact RGPD** : rudy@groupe-apolline.com

## 2. Données traitées

| Catégorie | Exemples | Source |
|---|---|---|
| Identité | Nom, prénom, naissance, adresse | Fournie par l'emprunteur |
| Contact | Email, téléphone | Fournie par l'emprunteur |
| Profession & revenus | Bulletins de salaire, AVI, contrat de travail | Pièces P2 |
| Patrimoine | Relevés bancaires, épargne, biens détenus | Pièces P3 |
| Charges | Loyer, taxes, crédits en cours | Pièces P4 |
| Projet | Compromis, prix, ville, type de bien | Pièces P5 |
| Co-emprunteur | Mêmes catégories que ci-dessus | Si co-emprunt |
| Sécurité | IP, user-agent, actions effectuées | Auto-collecté (audit) |

## 3. Bases légales (article 6 RGPD)

| Traitement | Base légale |
|---|---|
| Suivi de dossier de prêt | **6.1.b** — exécution du mandat IOBSP signé par l'emprunteur |
| Communication avec banques partenaires | **6.1.b** — exécution du mandat |
| Apporteurs d'affaires (rétro-commissions) | **6.1.b** — contrat d'apport |
| Audit log (sécurité) | **6.1.f** — intérêt légitime (sécurité du SI) |
| Auto-purge à 5 ans | **6.1.c** — obligation légale (L223-1 Code conso) |

## 4. Durée de conservation

| Donnée | Durée | Justification |
|---|---|---|
| Dossier de prêt actif | Jusqu'à signature ou abandon | — |
| Dossier signé/encaissé | **5 ans après dernière activité** | Article L223-1 Code de la consommation |
| Apporteurs (commissions) | **10 ans** | Obligation comptable (article L123-22 Code de commerce) |
| Audit log | **5 ans** | Traçabilité IOBSP |
| Effacement RGPD | Immédiat (sauf audit log conservé pour preuve) | Article 17 |

L'auto-purge tourne **toutes les 24h** côté backend (cron `dailyTick` dans `realtime/cron.ts`).

## 5. Destinataires

- **Équipe Apolline** : tous les collaborateurs avec un compte (filtré par permissions par rôle)
- **Banques partenaires** : sur mandat de l'emprunteur uniquement, dossier complet transmis
- **Notaire** : à la signature, dossier financement transmis
- **Hébergeur** : Hostinger (VPS Postgres en France) — sous-traitant article 28
- **Microsoft 365** : Outlook + OneDrive (sur compte O365 du collaborateur — chaque collab utilise son propre compte)

## 6. Sous-traitants

| Sous-traitant | Finalité | Région | Engagement |
|---|---|---|---|
| Hostinger | Hébergement VPS BDD | France 🇫🇷 | DPA signé, ISO 27001 |
| Microsoft (O365) | Outlook, OneDrive, contacts | UE 🇪🇺 | DPA signé, conforme RGPD |
| Etalab / DGFiP | Données DVF publiques | France 🇫🇷 | Aucune donnée client envoyée |
| BAN (data.gouv.fr) | Géocodage adresses | France 🇫🇷 | Adresse seule envoyée (pas de PII liée client) |

## 7. Droits des personnes

| Droit | Comment l'exercer | Délai de réponse |
|---|---|---|
| **Article 15** Accès | Demande au DPO → Paramètres > RGPD > Exporter | < 1 mois |
| **Article 16** Rectification | Demande au DPO → édition fiche client | < 1 mois |
| **Article 17** Effacement | Demande au DPO → Paramètres > RGPD > Effacer (admin) | < 1 mois |
| **Article 20** Portabilité | Export JSON via Article 15 | < 1 mois |
| **Article 21** Opposition | Demande au DPO | < 1 mois |

Toute action exercée est **tracée dans l'audit_log** (preuve de traitement, conservée 5 ans).

## 8. Mesures de sécurité

- **Authentification** : login + mot de passe haché (bcrypt) + JWT HS256 + (à venir) 2FA TOTP
- **Chiffrement** : HTTPS uniquement (TLS 1.3 via nginx Let's Encrypt)
- **Données au repos** : Postgres sur VPS chiffré, backups quotidiens chiffrés
- **MSAL/O365** : tokens stockés dans Stronghold vault (argon2) par utilisateur
- **Rate limiting** : 200 req/min global, 10/min sur login (anti brute-force)
- **Audit log** : toute action sensible (delete, login, export, erase RGPD) est tracée
- **Permissions par rôle** : 4 rôles (admin, courtier, gestionnaire, assistante) avec matrice 24 perms
- **Verrouillage auto** : session verrouillée après 15 min d'inactivité (configurable par user)

## 9. Failles & incidents

En cas de violation de données personnelles :
1. **Notification CNIL sous 72h** (article 33)
2. **Notification aux personnes concernées** si risque élevé (article 34)
3. **Inscription au registre des violations** (à créer si incident)

Contact CNIL : [www.cnil.fr](https://www.cnil.fr) — n° dossier à demander en ligne.

## 10. Mise à jour de cette politique

Cette politique est versionnée. Lors d'une mise à jour majeure :
1. Modifier `POLICY_VERSION` dans `src/components/RgpdConsent.tsx`
2. Tous les collaborateurs reverront le bandeau au prochain login
3. Documenter le changelog ci-dessous

### Changelog

- **2026-04-30** v1 : politique initiale créée avec implémentation RGPD complète (export, effacement, registre, auto-purge 5 ans, audit log)

## 11. Annexes

- Bandeau de consentement collaborateurs : `src/components/RgpdConsent.tsx`
- Endpoints : `apolline-backend/src/routes/rgpd.ts`
- Cron auto-purge : `apolline-backend/src/realtime/cron.ts → purgeRgpd()`
- UI admin : `src/components/RgpdPane.tsx` (Paramètres → RGPD)
- Registre des traitements : exposé dynamiquement via `GET /api/rgpd/registry`
