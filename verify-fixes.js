#!/usr/bin/env node

/**
 * SCRIPT DE VÉRIFICATION - Synchronisation Cloud
 * 
 * Ce script vérifie que les modifications sont correctement appliquées
 */

console.log('\n🔍 VÉRIFICATION DES CORRECTIFS\n');
console.log('================================\n');

const fs = require('fs');
const path = require('path');

let errors = 0;
let warnings = 0;

// Vérification 1: Fichier SQL créé
console.log('1️⃣  Vérification du fichier SQL...');
const sqlPath = path.join(__dirname, 'fix_qr_verification.sql');
if (fs.existsSync(sqlPath)) {
    const content = fs.readFileSync(sqlPath, 'utf8');
    if (content.includes('target_invoice_id text')) {
        console.log('   ✅ Fichier SQL correct (accepte les IDs texte)\n');
    } else {
        console.log('   ❌ Fichier SQL incorrect (devrait accepter TEXT, pas UUID)\n');
        errors++;
    }
} else {
    console.log('   ❌ Fichier fix_qr_verification.sql introuvable\n');
    errors++;
}

// Vérification 2: App.tsx modifié
console.log('2️⃣  Vérification de App.tsx...');
const appPath = path.join(__dirname, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
    const content = fs.readFileSync(appPath, 'utf8');

    const checks = [
        {
            test: content.includes('PRIORITIZE CLOUD DATA'),
            name: 'Priorité cloud activée'
        },
        {
            test: content.includes('Saving document to cloud immediately'),
            name: 'Sauvegarde immédiate activée'
        },
        {
            test: content.includes('dataSyncService.saveInvoices'),
            name: 'Service de sync utilisé'
        }
    ];

    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✅ ${check.name}`);
        } else {
            console.log(`   ❌ ${check.name} - MANQUANT`);
            errors++;
        }
    });
    console.log();
} else {
    console.log('   ❌ Fichier App.tsx introuvable\n');
    errors++;
}

// Vérification 3: Build réussi
console.log('3️⃣  Vérification du build...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    console.log('   ✅ Dossier dist/ existe (build OK)\n');
} else {
    console.log('   ⚠️  Dossier dist/ absent (lancez: npm run build)\n');
    warnings++;
}

// Vérification 4: Guides créés
console.log('4️⃣  Vérification des guides...');
const guides = [
    'GUIDE_RAPIDE.md',
    'CORRECTIFS_CLOUD_QR.md'
];

guides.forEach(guide => {
    if (fs.existsSync(path.join(__dirname, guide))) {
        console.log(`   ✅ ${guide} créé`);
    } else {
        console.log(`   ⚠️  ${guide} manquant`);
        warnings++;
    }
});

// Résumé
console.log('\n================================');
console.log('📊 RÉSUMÉ\n');

if (errors === 0 && warnings === 0) {
    console.log('✅ TOUT EST PARFAIT !');
    console.log('\n📋 PROCHAINES ÉTAPES:');
    console.log('   1. Exécutez le script SQL dans Supabase');
    console.log('   2. Testez le QR Code');
    console.log('   3. Testez la synchronisation');
    console.log('\n📖 Consultez GUIDE_RAPIDE.md pour les instructions\n');
    process.exit(0);
} else if (errors === 0) {
    console.log(`⚠️  ${warnings} avertissement(s) - Pas critique`);
    console.log('\n📋 PROCHAINES ÉTAPES:');
    console.log('   1. Lancez: npm run build (si pas encore fait)');
    console.log('   2. Exécutez le script SQL dans Supabase');
    console.log('   3. Testez le QR Code\n');
    process.exit(0);
} else {
    console.log(`❌ ${errors} erreur(s) trouvée(s)`);
    console.log('\n⚠️  Les correctifs ne sont pas complets.');
    console.log('   Veuillez vérifier les fichiers mentionnés ci-dessus.\n');
    process.exit(1);
}
