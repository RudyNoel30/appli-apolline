# Apolline Backend

Backend HTTP + temps réel pour Apolline. Stack : **Hono** (Node) + **Drizzle ORM** + **PostgreSQL**.

- API REST sur toutes les entités (clients, dossiers, rdvs, notes, apporteurs, banques, commissions, simulations, templates, notifications, pieces, collaborateurs)
- Realtime via **PG `LISTEN/NOTIFY` → SSE** : chaque mutation propage un event à tous les clients connectés
- Auth **JWT HS256** (token de 12 h)
- CORS strict + nginx reverse proxy + Let's Encrypt

## Mise en service sur ton VPS Hostinger

### 1. Cloner le code sur le VPS

```bash
sudo mkdir -p /opt/apolline-backend
sudo chown apolline:apolline /opt/apolline-backend
cd /opt/apolline-backend
git clone <ton-repo-git> .
# Ou : rsync depuis ta machine de dev
```

### 2. Préparer Postgres

```bash
sudo -u postgres psql
CREATE USER apolline WITH PASSWORD 'CHOIS_UN_BON_MOT_DE_PASSE';
CREATE DATABASE apolline OWNER apolline;
GRANT ALL PRIVILEGES ON DATABASE apolline TO apolline;
\q
```

### 3. Configurer le backend

```bash
cp .env.example .env
nano .env
# DATABASE_URL=postgresql://apolline:CHOIS_UN_BON_MOT_DE_PASSE@127.0.0.1:5432/apolline
# JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
# ALLOWED_ORIGINS=tauri://localhost,https://tauri.localhost,http://localhost:5173

npm install
npm run db:push     # Crée toutes les tables depuis le schéma Drizzle
npm run seed        # Importe les 4 collaborateurs + 5 banques par défaut
npm run build       # Compile TypeScript → dist/
```

> Mot de passe initial des 4 collaborateurs : `apolline2026`. **À changer immédiatement** après le premier login.

### 4. Service systemd

```bash
sudo cp deploy/apolline-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now apolline-api
sudo systemctl status apolline-api  # vérifier OK
sudo journalctl -u apolline-api -f  # voir les logs en live
```

### 5. nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/apolline-api
sudo ln -s /etc/nginx/sites-available/apolline-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.apolline.groupe-apolline.com
```

> Pré-requis : un enregistrement DNS `A` pour `api.apolline.groupe-apolline.com` pointant sur l'IP du VPS.

### 6. Backups quotidiens

```bash
sudo cp deploy/backup.sh /opt/apolline-backend/deploy/backup.sh
sudo chmod +x /opt/apolline-backend/deploy/backup.sh
sudo crontab -e
# Ajouter :
# 0 2 * * * /opt/apolline-backend/deploy/backup.sh >> /var/log/apolline-backup.log 2>&1
```

Pour la copie hors-site sur OneDrive :

```bash
sudo apt install rclone
rclone config  # configurer le remote "onedrive-apolline"
```

### 7. Côté Apolline (client React/Tauri)

Ajouter dans le `.env.local` à la racine du projet front (à côté de `package.json`) :

```env
VITE_API_BASE=https://api.apolline.groupe-apolline.com
```

Puis relancer `npm run dev` ou rebuilder l'installeur Tauri (`npm run tauri:build`).

## API surface

### Auth
- `POST   /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET    /api/auth/me` — profil connecté
- `PATCH  /api/auth/me` — modifier son propre profil (signature, bio, télephone…)

### CRUD générique (pour chaque entité ci-dessous)
- `GET    /api/<entity>` — liste tout
- `GET    /api/<entity>/:id` — un item
- `POST   /api/<entity>` — créer
- `PATCH  /api/<entity>/:id` — modifier (partiel)
- `DELETE /api/<entity>/:id` — supprimer

Entités : `clients`, `dossiers`, `rdvs`, `notes`, `apporteurs`, `banques`, `commissions`, `simulations`, `templates`, `notifications`, `pieces`, `collaborateurs`.

### Realtime
- `GET /api/events` (SSE, JWT requis) — stream d'events `{ table, action, id }` à chaque mutation.

### Healthcheck
- `GET /healthz` — `{ ok: true, ts }` (sans auth)

## Workflow de mise à jour

```bash
# Sur ta machine de dev
git push origin main

# Sur le VPS
cd /opt/apolline-backend
git pull
npm install
npm run db:generate   # nouvelles migrations si schéma changé
npm run db:migrate    # applique les migrations
npm run build
sudo systemctl restart apolline-api
```

Pour les **mises à jour de l'app desktop** (Tauri), voir le repo principal Apolline (mécanisme `tauri-plugin-updater` sur GitHub Releases).

## Sécurité — checklist déploiement

- [x] `JWT_SECRET` aléatoire long (≥ 48 octets)
- [x] Postgres écoute uniquement sur `127.0.0.1` (pas exposé à Internet)
- [x] HTTPS via Let's Encrypt avec auto-renew
- [x] systemd hardening : `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`
- [x] CORS allowlist explicite (pas de wildcard)
- [x] Headers sécurité nginx : HSTS, X-Frame-Options, X-Content-Type-Options
- [x] Backups chiffrés hors-site (OneDrive)
- [ ] **À faire** : `fail2ban` pour bannir les bruteforce login
- [ ] **À faire** : changer le mot de passe seed `apolline2026` après premier login
- [ ] **À faire** : remplacer le hash SHA-256 stretching par `bcrypt`/`argon2` quand besoin de robustesse RGPD plus forte
