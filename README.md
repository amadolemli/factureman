# 📱 FactureMan - Application de Gestion de Factures

Application web professionnelle pour la gestion de factures, devis et reçus avec synchronisation cloud.

## 🚀 Fonctionnalités

### 📄 Gestion de Documents
- ✅ Création de factures professionnelles
- ✅ Génération de devis
- ✅ Émission de reçus de paiement
- ✅ 3 templates élégants (Classic, Modern, Elegant)
- ✅ QR Code de vérification automatique
- ✅ Export PDF haute qualité

### 👥 Gestion Clients
- ✅ Annuaire de contacts
- ✅ Suivi des dettes et avances
- ✅ Historique des transactions
- ✅ Gestion des rendez-vous (agenda)

### 📦 Gestion de Stock
- ✅ Inventaire produits/services
- ✅ Prix et catégories
- ✅ Suivi des quantités en stock
- ✅ Mise à jour automatique lors des ventes

### ☁️ Cloud Sync (Supabase)
- ✅ Synchronisation automatique toutes les 2 minutes
- ✅ Sauvegarde immédiate lors de la création de documents
- ✅ Données accessibles sur tous les appareils  
- ✅ **Aucune perte de données** même après vidage du cache

### 🎨 Personnalisation
- ✅ Entête personnalisé avec logo
- ✅ Signature digitale
- ✅ Informations entreprise
- ✅ Templates personnalisables

### 🛡️ Administration
- ✅ Panneau d'administration complet
- ✅ Gestion des utilisateurs
- ✅ Système de crédits
- ✅ Audit trail des actions admin
- ✅ Bannissement utilisateurs

### 🤖 Intelligence Artificielle
- ✅ Scan de documents manuscrits (OCR)
- ✅ Extraction automatique des données
- ✅ Support Claude, GPT-4o, Gemini

### 📞 Support Client
- ✅ Contact service facilité dans le profil
- ✅ Bouton WhatsApp direct
- ✅ Bouton appel direct
- ✅ Copie numéro en 1 clic

---

## 🛠️ Technologies

### Frontend
- **React** 18.3 + **TypeScript**
- **Vite** - Build ultra-rapide
- **Tailwind CSS** - Design moderne
- **Lucide Icons** - Icônes élégantes
- **React QR Code** - Génération QR codes
- **React Image Crop** - Crop d'images
- **React Signature Canvas** - Signatures digitales

### Backend & Cloud
- **Supabase** - Backend as a Service
  - Authentication
  - PostgreSQL Database
  - Storage (fichiers)
  - Row Level Security (RLS)
- **Edge Functions** - Fonctions serverless

### IA & OCR
- **Google Gemini AI** - OCR principal
- **Claude 3.5 Sonnet** - Alternative OCR
- **OpenAI GPT-4o** - Alternative OCR

---

## 📋 Prérequis

- **Node.js** 18+ 
- **npm** ou **yarn**
- Compte **Supabase** (gratuit)

---

## ⚡ Installation

### 1. Cloner le repository
```bash
git clone https://github.com/votre-username/factureman.git
cd factureman
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration Supabase

#### 3.1 Créer un projet Supabase
- Aller sur https://supabase.com
- Créer un nouveau projet
- Noter l'URL et la clé API (anon key)

#### 3.2 Configurer les variables d'environnement
Créer un fichier `.env` :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_anon_key
VITE_GEMINI_API_KEY=votre_gemini_key (optionnel)
```

#### 3.3 Exécuter les scripts SQL
Dans le **SQL Editor** de Supabase, exécuter dans l'ordre :

1. **`supabase_schema.sql`** - Créer les tables
2. **`enable_public_verification.sql`** - Vérification QR publique
3. **`fix_qr_verification.sql`** - Fix pour IDs texte
4. **`secure_admin_v2.sql`** - Sécurité admin
5. **`setup_admin_logs.sql`** - Système de logs
6. **`setup_storage_buckets.sql`** - Buckets de stockage (optionnel)

### 4. Lancer en développement
```bash
npm run dev
```

L'app sera accessible sur `http://localhost:5173`

### 5. Build pour production
```bash
npm run build
```

Les fichiers compilés seront dans `/dist`

---

## 📁 Structure du Projet

```
facture-app/
├── src/
│   ├── components/          # Composants React
│   │   ├── InvoiceForm.tsx  # Formulaire facture
│   │   ├── InvoicePreview.tsx # Aperçu document
│   │   ├── ProductManager.tsx # Gestion stock
│   │   ├── CreditManager.tsx # Gestion clients
│   │   ├── AdminPanel.tsx   # Panneau admin
│   │   └── ProfileSettings.tsx # Paramètres profil
│   ├── services/            # Services backend
│   │   ├── supabaseClient.ts # Client Supabase
│   │   ├── dataSyncService.ts # Sync cloud
│   │   ├── storageService_v2.ts # Gestion fichiers
│   │   └── aiService.ts     # IA & OCR
│   ├── types.ts             # Types TypeScript
│   ├── App.tsx              # Composant principal
│   └── main.tsx             # Point d'entrée
├── public/                  # Fichiers statiques
├── dist/                    # Build de production
├── *.sql                    # Scripts SQL Supabase
└── *.md                     # Documentation

```

---

## 🗃️ Base de Données

### Tables Principales

#### `profiles`
- Profil utilisateur (nom, infos entreprise, crédits)

#### `products`
- Inventaire produits/services

#### `invoices`
- Historique factures/devis/reçus

#### `clients`
- Annuaire clients (dettes, rendez-vous)

#### `admin_logs`
- Audit trail des actions admin

### Storage Buckets

#### `user-assets`
- Images entête personnalisées
- Signatures digitales
- Photos produits

#### `invoices`
- PDFs des factures/devis/reçus

---

## 🔐 Sécurité

- ✅ **Row Level Security (RLS)** activé sur toutes les tables
- ✅ **Authentication Supabase** (email/phone)
- ✅ **Politiques strictes** : Chaque utilisateur ne voit que ses données
- ✅ **Fonctions sécurisées** (SECURITY DEFINER) pour les actions admin
- ✅ **Audit trail** de toutes les actions sensibles
- ✅ **Protection Super Admin** (ne peut pas être banni/supprimé)

---

## 📊 Système de Crédits

- Chaque utilisateur démarre avec **500 crédits gratuits**
- Scan IA : **10 crédits** par scan
- Les admins peuvent créditer les utilisateurs
- Système de "wallet" local pour usage hors-ligne
- Auto-refill depuis le serveur quand connecté

---

## 👨‍💼 Guide Admin

### Devenir Super Admin

```sql
-- Dans Supabase SQL Editor
UPDATE profiles 
SET is_super_admin = true 
WHERE id = 'votre_user_id';
```

### Promouvoir un Admin

```sql
UPDATE profiles 
SET is_admin = true 
WHERE id = 'target_user_id';
```

### Fonctionnalités Admin
- Voir tous les utilisateurs
- Accorder des crédits
- Bannir/débannir des utilisateurs
- Voir les logs d'actions
- Promouvoir d'autres admins (Super Admin seulement)
- Supprimer des comptes (Super Admin seulement)

---

## 📱 Déploiement

### Vercel (Recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Production
vercel --prod
```

### Netlify

```bash
# Build
npm run build

# Déployer le dossier /dist
```

### Variables d'environnement

N'oubliez pas de configurer les variables d'environnement sur votre plateforme de déploiement !

---

## 📖 Documentation

- **`CHANGELOG.md`** - Historique des changements
- **`GUIDE_RAPIDE.md`** - Guide utilisateur en 3 étapes
- **`GUIDE_STOCKAGE_CLOUD.md`** - Migration vers Storage
- **`AUDIT_STOCKAGE.md`** - Analyse technique stockage
- **`FIX_ADMIN_LOGS.md`** - Configuration des logs
- **`CONTACT_SERVICE_CLIENT.md`** - Fonctionnalité contact

---

## 🐛 Bugs Connus & Solutions

### QR Code retourne "Non Authentifié"
**Solution** : Exécuter `fix_qr_verification.sql` dans Supabase

### Données perdues après vidage cache
**Solution** : Le problème est corrigé ! Le cloud est maintenant la source de vérité

### Admin Logs vides
**Solution** : Exécuter `setup_admin_logs.sql` dans Supabase

---

## 🤝 Contribution

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 📞 Support

**Service Client FactureMan**
- 📱 Téléphone : +223 78 80 08 49
- 💬 WhatsApp : [Cliquer ici](https://wa.me/22378800849)

---

## 🙏 Remerciements

- **Supabase** - Backend incroyable
- **Vite** - Build ultra-rapide
- **React Team** - Framework puissant
- **Lucide** - Icônes magnifiques

---

**Fait avec ❤️ pour les entrepreneurs et PME**

---

## 🚀 Roadmap

### v2.2 (Prochain)
- [ ] Migration complète vers Storage
- [ ] Compression automatique images
- [ ] Export Excel des rapports
- [ ] Mode sombre

### v2.3
- [ ] Application mobile (React Native)
- [ ] Notifications push
- [ ] Multi-devises

### v3.0
- [ ] Analytics avancés
- [ ] API publique
- [ ] Intégrations tierces (Stripe, PayPal)
- [ ] Multi-langues

---

**Version actuelle : 2.1.0** ✅
