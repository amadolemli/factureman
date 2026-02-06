# 🔧 FIX URGENT - QR Code + Données Perdues

## 🚨 PROBLÈME 1 : QR CODE "NON AUTHENTIFIÉ"

### ✅ SOLUTION EN 3 CLICS

1. **Ouvrir Supabase**
   - Allez sur : https://supabase.com/dashboard
   - Connectez-vous
   - Sélectionnez votre projet

2. **Ouvrir SQL Editor**
   - Dans le menu à gauche, cliquez sur **SQL Editor**
   - OU : https://supabase.com/dashboard/project/VOTRE_PROJECT_ID/sql

3. **Exécuter le Script**
   - Ouvrez le fichier `fix_qr_verification.sql` sur votre ordinateur
   - **COPIEZ TOUT** le contenu (Ctrl+A puis Ctrl+C)
   - **COLLEZ** dans SQL Editor (Ctrl+V)
   - Cliquez sur **RUN** (bouton en bas à droite)

### Vérification
✅ Vous devriez voir : "Success. No rows returned"

**C'EST TOUT ! Le QR code marchera maintenant.**

---

## 🚨 PROBLÈME 2 : DONNÉES PERDUES APRÈS ACTUALISATION

### Symptômes
- ✅ Les factures/devis/reçus sont sauvegardés
- ❌ Les produits (stock) disparaissent
- ❌ Les informations du profil disparaissent
- ❌ Les clients disparaissent

### Causes Possibles

1. **Les données ne sont PAS dans Supabase**
2. **Erreur de chargement depuis le cloud**
3. **Problem de session/connexion**

---

## 🔍 DIAGNOSTIC RAPIDE

### ÉTAPE 1 : Vérifier dans Supabase

**Dans Supabase Dashboard** :
1. Allez dans **Table Editor**
2. Vérifiez ces 4 tables :

#### Table `products`
- Cliquez sur la table `products`
- **Question** : Voyez-vous vos produits ?
  - ✅ OUI → Les données SONT dans le cloud
  - ❌ NON → Les données ne sont PAS sauvegardées

#### Table `profiles`
- Cliquez sur la table `profiles`
- Cherchez votre ligne (par ID ou téléphone)
- Regardez la colonne `business_info`
- **Question** : Voyez-vous vos infos (nom entreprise, etc.) ?
  - ✅ OUI → Les données SONT dans le cloud
  - ❌ NON → Les données ne sont PAS sauvegardées

#### Table `clients`
- Cliquez sur la table `clients`
- **Question** : Voyez-vous vos clients ?
  - ✅ OUI → Les données SONT dans le cloud
  - ❌ NON → Les données ne sont PAS sauvegardées

---

## 🆘 SI LES DONNÉES NE SONT PAS DANS SUPABASE

### Cela signifie qu'elles n'ont JAMAIS été sauvegardées

**Solutions** :

### Solution 1 : Forcer la Sauvegarde (URGENT)

**⚠️ NE PAS ACTUALISER LA PAGE AVANT DE FAIRE ÇA !**

1. Ouvrez la **Console Développeur** (F12)
2. Allez dans l'onglet **Console**
3. Copiez-collez cette commande :

```javascript
// Force save all data to cloud
(async () => {
  const session = await window.supabase.auth.getSession();
  const userId = session.data.session?.user?.id;
  
  if (!userId) {
    console.error('❌ Not logged in!');
    return;
  }
  
  // Get current data from localStorage
  const products = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
  const credits = JSON.parse(localStorage.getItem(`credits_${userId}`) || '[]');
  const business = JSON.parse(localStorage.getItem(`business_${userId}`) || '{}');
  
  console.log('📤 Saving to cloud:', { products: products.length, credits: credits.length });
  
  // Save to Supabase
  if (products.length > 0) {
    const dbProducts = products.map(p => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      price: p.defaultPrice,
      stock: p.stock,
      category: p.category
    }));
    const { error } = await window.supabase.from('products').upsert(dbProducts);
    if (error) console.error('❌ Products error:', error);
    else console.log('✅ Products saved!');
  }
  
  if (credits.length > 0) {
    const dbClients = credits.map(c => ({
      id: c.id,
      user_id: userId,
      name: c.customerName,
      phone: c.customerPhone,
      total_debt: c.totalDebt,
      remaining_balance: c.remainingBalance,
      history: c.history,
      appointments: c.appointments
    }));
    const { error } = await window.supabase.from('clients').upsert(dbClients);
    if (error) console.error('❌ Clients error:', error);
    else console.log('✅ Clients saved!');
  }
  
  if (business.name) {
    const { error } = await window.supabase.from('profiles').upsert({
      id: userId,
      business_name: business.name,
      business_info: business
    });
    if (error) console.error('❌ Business error:', error);
    else console.log('✅ Business saved!');
  }
  
  console.log('🎉 DONE! You can now refresh the page.');
})();
```

4. Appuyez sur **Entrée**
5. Attendez les messages ✅
6. **MAINTENANT** vous pouvez actualiser

---

## 🔧 FIX PERMANENT (Code)

Le problème vient du chargement des données. Je vais créer un fix.

### Option A : Utiliser le Fix Automatique (RECOMMANDÉ)

Je vais créer un nouveau fichier `fix_cloud_sync.ts` qui force :
1. Sauvegarde automatique toutes les 30 secondes
2. Chargement prioritaire du cloud
3. Vérification de connexion

### Option B : Vérifier Manuellement

**Dans F12 > Console**, tapez :
```javascript
// Vérifier ce qui est chargé
console.log('Products:', window.products);
console.log('Business:', window.businessInfo);
```

---

## 📞 AIDE IMMÉDIATE

### Si rien ne marche :

1. **AVANT de fermer l'app** :
   - F12 > Console
   - Tapez : `localStorage`
   - Faites une capture d'écran
   - Envoyez-moi ça

2. **Dans Supabase** :
   - Vérifiez si les tables existent
   - Vérifiez si vous êtes connecté (bon compte)
   - Vérifiez les RLS policies

---

## ✅ CHECKLIST RAPIDE

- [ ] Script SQL `fix_qr_verification.sql` exécuté dans Supabase
- [ ] QR Code testé → Affiche "Certifié"
- [ ] Table `products` vérifiée dans Supabase
- [ ] Table `profiles` vérifiée dans Supabase
- [ ] Table `clients` vérifiée dans Supabase
- [ ] Si vides : Script JavaScript exécuté pour forcer sauvegarde
- [ ] Page actualisée
- [ ] Données réapparaissent ✅

---

**FAITES ÇA MAINTENANT AVANT DE PERDRE PLUS DE DONNÉES ! 🚨**
