# 🚀 GUIDE RAPIDE - 3 ÉTAPES

## ⚠️ IMPORTANT : EXÉCUTEZ D'ABORD LE SCRIPT SQL !

Sans cette étape, le QR Code continuera à dire "Non Authentifié".

---

## ÉTAPE 1️⃣ : Exécuter le Script SQL (OBLIGATOIRE)

### A. Connectez-vous à Supabase
1. Allez sur https://supabase.com
2. Connectez-vous à votre compte
3. Sélectionnez votre projet **FactureMan**

### B. Ouvrez SQL Editor
1. Dans le menu de gauche, cliquez sur **SQL Editor** (icône </> )
2. **OU** allez directement sur : `https://supabase.com/dashboard/project/VOTRE_PROJECT_ID/sql/new`

### C. Exécutez le Script
1. Ouvrez le fichier `fix_qr_verification.sql` dans votre projet
2. **Copiez TOUT le contenu** du fichier
3. **Collez** dans SQL Editor
4. Cliquez sur **RUN** (ou Ctrl+Enter)

### D. Vérification
Vous devriez voir : ✅ `Success. No rows returned`

C'est normal ! La fonction a été créée avec succès.

---

## ÉTAPE 2️⃣ : Tester le QR Code

### A. Créer un Document Test
1. Lancez l'application (`npm run dev`)
2. Créez une facture de test
3. Remplissez tous les champs
4. Cliquez sur **"Créer la Facture"**

### B. Vérifier le QR Code
1. Le QR Code apparaît en bas du document
2. Scannez-le avec votre téléphone
3. Vous devriez voir : **"Document Certifié ✓"**
4. Les informations du document s'affichent

---

## ÉTAPE 3️⃣ : Tester la Synchronisation Cloud

### Test 1 : Vérifier que les Données se Sauvegardent

1. Ouvrez la **Console du Navigateur** (F12)
2. Créez 2-3 documents
3. Dans la console, vous devriez voir :
```
💾 Saving document to cloud immediately...
✅ Document saved to cloud successfully
```

### Test 2 : Vérifier la Restauration

1. Créez quelques documents
2. Attendez 10 secondes (pour être sûr que tout est sauvegardé)
3. **Déconnectez-vous** de l'application
4. Ouvrez les DevTools (F12) > **Application** > **Storage**
5. Cliquez sur **Clear site data** (tout supprimer)
6. **Reconnectez-vous** avec le même compte
7. ✅ Toutes vos données réapparaissent !

---

## 🎯 RÉSULTAT ATTENDU

### Avant les Correctifs ❌
- QR Code : "Non Authentifié"
- Après suppression browser : Données perdues
- Synchronisation : Aléatoire (toutes les 2 min)

### Après les Correctifs ✅
- QR Code : "Document Certifié" avec informations
- Après suppression browser : **Données restaurées depuis le cloud**
- Synchronisation : **Immédiate** + backup automatique

---

## 📱 VÉRIFICATION FINALE

### Dans Supabase Dashboard

1. Allez dans **Table Editor**
2. Ouvrez la table `invoices`
3. Vous devriez voir vos documents avec :
   - Colonne `id` : texte (ex: "abc123xyz")
   - Colonne `content` : JSON complet
   - Colonne `user_id` : votre UUID

### Dans l'Application

1. Console du navigateur propre (pas d'erreurs rouges)
2. Messages de sync visibles
3. QR Code fonctionnel
4. Données toujours présentes après reconnexion

---

## ❓ QUESTIONS FRÉQUENTES

### Q: Le QR Code dit toujours "Non Authentifié"
**R:** Vous n'avez pas exécuté le script SQL. Retournez à l'ÉTAPE 1.

### Q: Combien de temps pour sauvegarder ?
**R:** Instantané (1-2 secondes). Regardez la console pour confirmation.

### Q: Et si je suis hors ligne ?
**R:** 
- Vous pouvez créer 3 documents max
- Ils seront sauvegardés dès la reconnexion
- Le QR Code ne fonctionnera pas avant la sync

### Q: Mes anciennes données ?
**R:** 
- Si déjà dans le cloud : restaurées automatiquement
- Si jamais synchronisées : perdues (créez-les à nouveau)

---

## ✅ CHECKLIST FINALE

- [ ] Script SQL exécuté dans Supabase
- [ ] QR Code fonctionne (testé avec téléphone)
- [ ] Messages de sync dans la console
- [ ] Test de restauration après suppression réussi
- [ ] Documents visibles dans Supabase Table Editor

---

**Si tout est coché ✅, le système fonctionne parfaitement !**
