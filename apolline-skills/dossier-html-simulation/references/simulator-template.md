# Template du simulateur — Blocs à injecter

Ce fichier contient les 3 blocs exacts à injecter dans un HTML de dossier client existant.

---

## BLOC 1 — CSS (insérer avant `</style>`)

```css
/* ═══ SIMULATEUR ═══ */
.tab-content.wide .content { max-width: 1400px; }
.sim-section-title { font-size:11px;font-weight:700;letter-spacing:3px;color:var(--navy);text-transform:uppercase;margin-top:30px;margin-bottom:6px; }
.sim-section-line { width:100%;height:2px;background:linear-gradient(90deg,var(--gold) 0%,var(--gold) 80px,var(--border) 80px);margin-bottom:20px; }
.sim-form-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:16px; }
.sim-form-group { display:flex;flex-direction:column; }
.sim-form-group label { font-weight:600;margin-bottom:5px;font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px; }
.sim-form-group input,.sim-form-group select { padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-family:inherit;color:var(--text);background:var(--cream);transition:all 0.3s; }
.sim-form-group input:focus,.sim-form-group select:focus { outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(232,160,32,0.15);background:white; }
.sim-cards { display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px; }
.sim-card { background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(27,59,111,0.06);border:1px solid var(--border);transition:transform 0.3s,box-shadow 0.3s;flex:0 1 calc(25% - 12px);min-width:250px;display:flex;flex-direction:column; }
.sim-card:hover { transform:translateY(-3px);box-shadow:0 6px 20px rgba(27,59,111,0.1); }
.sim-card-header { padding:14px 16px;color:white;font-size:13px; }
.sim-card-bank { font-size:14px;font-weight:600;margin-bottom:2px; }
.sim-card-profile { font-size:11px;opacity:0.85;font-weight:400; }
.sim-card-body { padding:18px;flex:1; }
.sim-row { display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px; }
.sim-row:last-child { border-bottom:none; }
.sim-row-label { color:var(--gray); }
.sim-row-value { font-weight:700;color:var(--navy); }
.sim-row-rate { font-size:20px;font-weight:700;color:var(--navy); }
.sim-row-payment { font-size:16px;font-weight:700;color:var(--navy); }
.sim-badge-best { background:var(--gold);color:var(--navy);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap; }
.sim-economy { background:linear-gradient(135deg,#142d54 0%,var(--navy) 100%);border:1px solid var(--navy);color:white; }
.sim-economy .sim-row-label { color:rgba(255,255,255,0.7); }
.sim-economy .sim-row-value { color:white; }
.sim-economy-amount { font-size:22px;font-weight:700;color:var(--gold); }
.sim-bar-wrap { margin-top:14px; }
.sim-bar-row { display:flex;align-items:center;gap:8px;margin-bottom:8px; }
.sim-bar-label { width:80px;font-size:11px;color:rgba(255,255,255,0.6); }
.sim-bar-track { flex:1;height:24px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden; }
.sim-bar-fill { height:100%;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:white; }
.sim-bar-groupe { background:var(--gray); }
.sim-bar-deleg { background:var(--green); }
.sim-placeholder { text-align:center;padding:40px;background:var(--cream);border:1px dashed var(--border);border-radius:10px;color:var(--gray);font-style:italic;margin-top:16px; }
.sim-footer-note { text-align:center;font-size:11px;color:var(--gray);margin-top:30px;font-style:italic; }
@media (max-width:1200px) { .sim-card { flex:0 1 calc(33.333% - 11px); } }
@media (max-width:768px) { .sim-card { flex:0 1 calc(50% - 8px); } .sim-form-grid { grid-template-columns:1fr; } }
@media (max-width:480px) { .sim-card { flex:0 1 100%; } }
```

---

## BLOC 2 — Bouton d'onglet (insérer dans `.tabs` avant Notes internes)

```html
<div class="tab" onclick="switchTab('simulateur')">📊 Étude comparative</div>
```

Ce bouton doit être placé juste AVANT le bouton Notes internes existant :
```html
<div class="tab" onclick="switchTab('pieces')">📋 Pièces à fournir</div>
<div class="tab" onclick="switchTab('simulateur')">📊 Étude comparative</div>  <!-- AJOUTER -->
<div class="tab" onclick="switchTab('notes')">🔒 Notes internes</div>
```

---

## BLOC 3A — Contenu HTML du simulateur (insérer avant `<div id="notes">`)

Remplacer les `{{placeholders}}` par les données réelles du dossier.

**Placeholders emprunteurs** :
- `{{PRENOM1}} {{NOM1}}` / `{{AGE1}}` → emprunteur 1
- `{{PRENOM2}} {{NOM2}}` / `{{AGE2}}` → emprunteur 2 (vide si seul)

**Placeholders financement** (extraits de l'onglet Financement) :
- `{{MONTANT}}` → montant total emprunté (somme des prêts amortissables)
- `{{DUREE}}` → durée en années (ajouter `selected` sur l'option correspondante)

```html
<!-- ============================================================ -->
<!-- ONGLET — ÉTUDE COMPARATIVE (SIMULATEUR) -->
<!-- ============================================================ -->
<div id="simulateur" class="tab-content wide">
<div class="content">
    <div class="date-badge" id="sim-date-badge"></div>

    <!-- Paramètres -->
    <div class="card">
        <h2>Paramètres de simulation</h2>
        <div class="sim-form-grid">
            <div class="sim-form-group">
                <label>Emprunteur 1</label>
                <input type="text" id="sim-emp1" value="{{PRENOM1}} {{NOM1}}" readonly style="background:#eee;">
            </div>
            <div class="sim-form-group">
                <label>Âge</label>
                <input type="number" id="sim-age1" value="{{AGE1}}" min="18" max="120">
            </div>
            <div class="sim-form-group">
                <label>Emprunteur 2</label>
                <input type="text" id="sim-emp2" value="{{PRENOM2}} {{NOM2}}" readonly style="background:#eee;">
            </div>
            <div class="sim-form-group">
                <label>Âge</label>
                <input type="number" id="sim-age2" value="{{AGE2}}" min="18" max="120">
            </div>
        </div>
        <div class="sim-form-grid">
            <div class="sim-form-group">
                <label>Montant emprunté (€)</label>
                <input type="number" id="sim-montant" value="{{MONTANT}}" step="1000">
            </div>
            <div class="sim-form-group">
                <label>Durée</label>
                <select id="sim-duree">
                    <option value="">Sélectionner...</option>
                    <option value="7">7 ans</option>
                    <option value="10">10 ans</option>
                    <option value="12">12 ans</option>
                    <option value="15">15 ans</option>
                    <option value="18">18 ans</option>
                    <option value="20">20 ans</option>
                    <option value="22">22 ans</option>
                    <option value="25">25 ans</option>
                </select>
            </div>
        </div>
        <div id="sim-placeholder" class="sim-placeholder">
            Saisissez le montant et la durée pour lancer la simulation
        </div>
    </div>

    <!-- Résultats prêt -->
    <div id="sim-loans-section" style="display:none;">
        <div class="sim-section-title">Comparatif taux prêt immobilier</div>
        <div class="sim-section-line"></div>
        <div id="sim-loans" class="sim-cards"></div>
    </div>

    <!-- Résultats assurance -->
    <div id="sim-insurance-section" style="display:none;">
        <div class="sim-section-title">Assurance emprunteur — Quotité 100 % / 100 %</div>
        <div class="sim-section-line"></div>
        <div id="sim-insurance" class="sim-cards"></div>
    </div>

    <div class="sim-footer-note">Simulations indicatives réalisées sur la base des barèmes courtiers en vigueur — ne constituent pas une offre de prêt.</div>
</div>
</div>
```

**IMPORTANT — Durée pré-sélectionnée** : Ajouter l'attribut `selected` sur l'`<option>` correspondant à `{{DUREE}}`. Exemple pour 25 ans :
```html
<option value="25" selected>25 ans</option>
```

---

## BLOC 3B — JavaScript complet (REMPLACE le `<script>` existant)

Ce bloc remplace intégralement le `<script>` existant du dossier HTML. Il contient à la fois le `switchTab()` d'origine et tout le code du simulateur.

**IMPORTANT** : Le script se termine par `updateSim();` pour déclencher automatiquement le calcul avec les données pré-remplies. Le courtier peut ensuite modifier librement le montant et la durée — le comparatif se recalcule en temps réel.

```html
<script>
// ═══ TAB SWITCHING ═══
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick') === "switchTab('" + tabId + "')") t.classList.add('active');
    });
}

// ═══ DATE BADGE ═══
const today = new Date();
document.getElementById('sim-date-badge').textContent = 'Barèmes courtiers au ' + today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ═══ BANK DATA ═══
const bankFullNames = {
    "CEBFC": "Caisse d'Épargne BFC",
    "LBP": "La Banque Postale",
    "CACE": "Crédit Agricole Centre Est",
    "BPBFC": "Banque Populaire BFC",
    "SG": "Société Générale"
};
const banksData = [
    {"banque":"CEBFC","profil":"Revenus < 2 500 €/pers ou < 5 000 €/couple","taux":{"7":0.031,"10":0.032,"12":0.034,"15":0.035,"20":0.0355,"25":0.0364},"color":"#e3001b"},
    {"banque":"CEBFC","profil":"Revenus ≥ 2 500 €/pers ou ≥ 5 000 €/couple","taux":{"7":0.029,"10":0.0295,"12":0.0305,"15":0.0322,"20":0.0335,"25":0.0342},"color":"#e3001b"},
    {"banque":"LBP","profil":"Clients — Taux min","taux":{"5":0.027,"10":0.0296,"12":0.0304,"15":0.031,"18":0.0314,"20":0.0315,"22":0.0315,"25":0.0315},"color":"#003d82"},
    {"banque":"LBP","profil":"Clients — Taux moyen","taux":{"5":0.0282,"10":0.0302,"12":0.0307,"15":0.0317,"18":0.0322,"20":0.0323,"22":0.0323,"25":0.0326},"color":"#003d82"},
    {"banque":"LBP","profil":"Prospects — Taux min","taux":{"5":0.0275,"10":0.0301,"12":0.0309,"15":0.0315,"18":0.0319,"20":0.032,"22":0.032,"25":0.032},"color":"#003d82"},
    {"banque":"LBP","profil":"Prospects — Taux moyen","taux":{"5":0.0287,"10":0.0312,"12":0.0317,"15":0.0327,"18":0.0332,"20":0.0333,"22":0.0342,"25":0.0347},"color":"#003d82"},
    {"banque":"CACE","profil":"Standard (tous projets)","taux":{"7":0.0338,"10":0.0348,"12":0.0351,"15":0.0354,"18":0.036,"20":0.0364,"22":0.0369,"25":0.0376},"color":"#006633"},
    {"banque":"CACE","profil":"Privilège (rev > 30K€)","taux":{"7":0.0323,"10":0.0333,"12":0.0336,"15":0.0339,"18":0.0345,"20":0.0349,"22":0.0354,"25":0.0361},"color":"#006633"},
    {"banque":"CACE","profil":"Premium (rev > 40K€)","taux":{"7":0.0308,"10":0.0318,"12":0.0321,"15":0.0324,"18":0.033,"20":0.0334,"22":0.0339,"25":0.0346},"color":"#006633"},
    {"banque":"BPBFC","profil":"Standard (< 60K€/couple)","taux":{"7":0.0336,"10":0.0346,"12":0.0356,"15":0.0366,"20":0.0376,"25":0.0386},"color":"#0054a6"},
    {"banque":"BPBFC","profil":"Premium (≥ 60K€/couple)","taux":{"7":0.0326,"10":0.0336,"12":0.0346,"15":0.0356,"20":0.0366,"25":0.0376},"color":"#0054a6"},
    {"banque":"BPBFC","profil":"Excellium (≥ 80K€/couple)","taux":{"7":0.0306,"10":0.0316,"12":0.0326,"15":0.0326,"20":0.0336,"25":0.0346},"color":"#0054a6"},
    {"banque":"SG","profil":"Revenus < 32K€/pers ou < 42K€/couple","taux":{"7":0.035,"10":0.036,"12":0.0375,"15":0.0395,"18":0.0395,"20":0.04,"25":0.0405},"color":"#6b1d2a"},
    {"banque":"SG","profil":"Revenus ≥ 32K€/pers ou ≥ 42K€/couple","taux":{"7":0.0325,"10":0.0335,"12":0.035,"15":0.037,"18":0.037,"20":0.0375,"25":0.038},"color":"#6b1d2a"},
    {"banque":"SG","profil":"Revenus > 60K€/pers ou > 80K€/couple","taux":{"7":0.031,"10":0.032,"12":0.0335,"15":0.0355,"18":0.0355,"20":0.036,"25":0.0365},"color":"#6b1d2a"}
];

// ═══ ASSURANCE CNP — Interpolation linéaire ═══
const cnpData = [{"age":30,"taux_ci":0.00367},{"age":42,"taux_ci":0.0076},{"age":52,"taux_ci":0.01061}];

// ═══ FORMATTERS ═══
function fmtCur(n) { return n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
function fmtPct(n) { return (n*100).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %'; }

// ═══ CALCULATIONS ═══
function interpCNP(age) {
    if(age<=cnpData[0].age) return cnpData[0].taux_ci;
    if(age>=cnpData[cnpData.length-1].age) return cnpData[cnpData.length-1].taux_ci;
    for(let i=0;i<cnpData.length-1;i++){
        const p1=cnpData[i],p2=cnpData[i+1];
        if(age>=p1.age&&age<=p2.age){return p1.taux_ci+(age-p1.age)/(p2.age-p1.age)*(p2.taux_ci-p1.taux_ci);}
    }
    return cnpData[cnpData.length-1].taux_ci;
}

function calcMens(C,t,d){const r=t/12,n=d*12;return C*r/(1-Math.pow(1+r,-n));}
function calcInt(C,m,d){return m*d*12-C;}

function calcInsurance(C,t,d,a1,a2){
    const r=t/12,n=d*12,mens=calcMens(C,t,d);
    let solde=C;const amort=[];
    for(let i=0;i<n;i++){const int=solde*r;solde-=(mens-int);amort.push(Math.max(0,solde));}
    // Quotité 100%/100% : on SOMME les taux (pas de moyenne)
    let cnpRT=interpCNP(a1);if(a2)cnpRT+=interpCNP(a2);
    const cnpM=C*cnpRT/12,cnpT=cnpM*n;
    let dRT=0.75*a1/10000;if(a2)dRT+=0.75*a2/10000;
    let dT=0,dF=0;
    for(let i=0;i<n;i++){const m=amort[i]*dRT/12;dT+=m;if(i===0)dF=m;}
    return{cnpM,cnpT,dF,dA:dT/n,dT};
}

// ═══ DOM REFERENCES ═══
const sM=document.getElementById('sim-montant'),sD=document.getElementById('sim-duree');
const sA1=document.getElementById('sim-age1'),sA2=document.getElementById('sim-age2');

// ═══ UPDATE FUNCTION ═══
function updateSim(){
    const montant=parseFloat(sM.value),duree=parseFloat(sD.value);
    if(!montant||!duree){
        document.getElementById('sim-placeholder').style.display='block';
        document.getElementById('sim-loans-section').style.display='none';
        document.getElementById('sim-insurance-section').style.display='none';
        return;
    }
    document.getElementById('sim-placeholder').style.display='none';
    document.getElementById('sim-loans-section').style.display='block';

    const loans=banksData.filter(b=>b.taux[duree]).map(b=>({
        ...b,tv:b.taux[duree],
        mens:calcMens(montant,b.taux[duree],duree),
        ti:calcInt(montant,calcMens(montant,b.taux[duree],duree),duree)
    })).sort((a,b)=>a.tv-b.tv);

    const minR=loans[0].tv;
    document.getElementById('sim-loans').innerHTML=loans.map(l=>`
        <div class="sim-card">
            <div class="sim-card-header" style="background:${l.color};">
                <div class="sim-card-bank">${bankFullNames[l.banque]||l.banque}</div>
                <div class="sim-card-profile">${l.profil}</div>
            </div>
            <div class="sim-card-body">
                <div class="sim-row" style="justify-content:space-between;">
                    <span class="sim-row-label">Taux nominal</span>
                    <span style="display:flex;align-items:center;gap:8px;">
                        <span class="sim-row-rate">${fmtPct(l.tv)}</span>
                        ${l.tv===minR?'<span class="sim-badge-best">Meilleur</span>':''}
                    </span>
                </div>
                <div class="sim-row">
                    <span class="sim-row-label">Mensualité <span style="font-size:11px;color:var(--gray);">hors assurance</span></span>
                    <span class="sim-row-payment">${fmtCur(l.mens)}</span>
                </div>
                <div class="sim-row">
                    <span class="sim-row-label">Total intérêts</span>
                    <span class="sim-row-value">${fmtCur(l.ti)}</span>
                </div>
            </div>
        </div>
    `).join('');

    // ═══ INSURANCE ═══
    const a1=parseFloat(sA1.value),a2=sA2.value?parseFloat(sA2.value):null;
    if(a1){
        document.getElementById('sim-insurance-section').style.display='block';
        const ins=calcInsurance(montant,loans[0].tv,duree,a1,a2);
        const eco=ins.cnpT-ins.dT;
        const e1=document.getElementById('sim-emp1').value||'Emprunteur 1';
        const e2=document.getElementById('sim-emp2').value||'Emprunteur 2';
        document.getElementById('sim-insurance').innerHTML=`
            <div class="sim-card">
                <div class="sim-card-header" style="background:var(--gray);">
                    <div class="sim-card-bank">Assurance Groupe CNP</div>
                    <div class="sim-card-profile">Capital initial constant</div>
                </div>
                <div class="sim-card-body">
                    <div class="sim-row"><span class="sim-row-label">Mensualité constante</span><span class="sim-row-value">${fmtCur(ins.cnpM)}</span></div>
                    <div class="sim-row"><span class="sim-row-label">${e1} + ${e2}</span><span class="sim-row-value" style="color:var(--gray);font-size:12px;">100 % + 100 %</span></div>
                    <div class="sim-row" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
                        <span class="sim-row-label" style="font-weight:600;">Coût total</span><span class="sim-row-value" style="font-size:16px;">${fmtCur(ins.cnpT)}</span>
                    </div>
                </div>
            </div>
            <div class="sim-card">
                <div class="sim-card-header" style="background:var(--green);">
                    <div class="sim-card-bank">Assurance Délégataire</div>
                    <div class="sim-card-profile">Tarif individuel dégressif sur CRD</div>
                </div>
                <div class="sim-card-body">
                    <div class="sim-row"><span class="sim-row-label">1ère mensualité</span><span class="sim-row-value">${fmtCur(ins.dF)}</span></div>
                    <div class="sim-row"><span class="sim-row-label">Mensualité moyenne</span><span class="sim-row-value">${fmtCur(ins.dA)}</span></div>
                    <div class="sim-row" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
                        <span class="sim-row-label" style="font-weight:600;">Coût total</span><span class="sim-row-value" style="font-size:16px;">${fmtCur(ins.dT)}</span>
                    </div>
                </div>
            </div>
            <div class="sim-card sim-economy">
                <div class="sim-card-header" style="background:linear-gradient(135deg,#142d54,var(--navy));border-bottom:2px solid var(--gold);">
                    <div class="sim-card-bank" style="color:var(--gold);">Économie réalisable</div>
                    <div class="sim-card-profile">Délégation vs Groupe</div>
                </div>
                <div class="sim-card-body">
                    <div class="sim-row"><span class="sim-row-label">Économie totale</span><span class="sim-economy-amount">${fmtCur(eco)}</span></div>
                    <div class="sim-bar-wrap">
                        <div class="sim-bar-row"><span class="sim-bar-label">Groupe</span><div class="sim-bar-track"><div class="sim-bar-fill sim-bar-groupe" style="width:100%">${fmtCur(ins.cnpT)}</div></div></div>
                        <div class="sim-bar-row"><span class="sim-bar-label">Délégataire</span><div class="sim-bar-track"><div class="sim-bar-fill sim-bar-deleg" style="width:${(ins.dT/ins.cnpT)*100}%">${fmtCur(ins.dT)}</div></div></div>
                    </div>
                </div>
            </div>
        `;
    } else {
        document.getElementById('sim-insurance-section').style.display='none';
    }
}

// ═══ EVENT LISTENERS ═══
sM.addEventListener('input',updateSim);
sD.addEventListener('change',updateSim);
sA1.addEventListener('input',updateSim);
sA2.addEventListener('input',updateSim);

// ═══ INIT — Lancement automatique avec données pré-remplies ═══
updateSim();
</script>
```
