export const notificationService = {
    // Demander la permission d'afficher des notifications
    requestPermission: async () => {
        if (!("Notification" in window)) {
            console.log("Ce navigateur ne supporte pas les notifications de bureau");
            return false;
        }

        if (Notification.permission === "granted") {
            return true;
        }

        const permission = await Notification.requestPermission();
        return permission === "granted";
    },

    // Planifier une notification
    scheduleNotification: async (id: string, title: string, body: string, appointmentDate: string, delayMinutes: number = 60) => {
        if (!("Notification" in window)) return;

        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return;
        }

        // Calculer le délai
        const apptTime = new Date(appointmentDate).getTime();
        const notifyTime = apptTime - (delayMinutes * 60 * 1000); // Retrait du délai (15 ou 60 min)
        const now = new Date().getTime();
        const delay = notifyTime - now;

        if (delay > 0) {
            // Si le délai est raisonnable (ex: moins de 24h et navigateur ouvert), on utilise setTimeout
            // Note: Pour une "vraie" planification robuste web, il faudrait un Service Worker.
            // Ici on simule une planification "session" comme demandé pour le web standard.

            // Sauvegarder dans le localStorage pour persistance (si l'onglet est rouvert)
            // On stocke : ID -> { title, body, time }
            const scheduled = JSON.parse(localStorage.getItem('mali_facture_notifications') || '{}');
            scheduled[id] = { title, body, notifyTime };
            localStorage.setItem('mali_facture_notifications', JSON.stringify(scheduled));

            console.log(`Notification planifiée pour dans ${(delay / 60000).toFixed(0)} minutes`);

            setTimeout(() => {
                // Double check si toujours valide (pas annulé)
                const currentScheduled = JSON.parse(localStorage.getItem('mali_facture_notifications') || '{}');
                if (currentScheduled[id]) {
                    new Notification(title, {
                        body: body,
                        icon: '/icon.png', // Fallback icon path
                        requireInteraction: true
                    });
                    // Nettoyer après envoi
                    delete currentScheduled[id];
                    localStorage.setItem('mali_facture_notifications', JSON.stringify(currentScheduled));
                }
            }, delay);
        }
    },

    // Annuler une notification
    cancelNotification: (id: string) => {
        const scheduled = JSON.parse(localStorage.getItem('mali_facture_notifications') || '{}');
        if (scheduled[id]) {
            delete scheduled[id];
            localStorage.setItem('mali_facture_notifications', JSON.stringify(scheduled));
            console.log(`Notification ${id} annulée`);
        }
    },

    // Restaurer les notifications au chargement (Nettoyage du Login Trigger "Check Logic", 
    // mais maintien de la persistance technique des timeouts)
    restoreSchedules: () => {
        const scheduled = JSON.parse(localStorage.getItem('mali_facture_notifications') || '{}');
        const now = new Date().getTime();

        Object.keys(scheduled).forEach(id => {
            const { title, body, notifyTime } = scheduled[id];
            const delay = notifyTime - now;

            if (delay > 0) {
                setTimeout(() => {
                    const current = JSON.parse(localStorage.getItem('mali_facture_notifications') || '{}');
                    if (current[id]) {
                        new Notification(title, { body, requireInteraction: true });
                        delete current[id];
                        localStorage.setItem('mali_facture_notifications', JSON.stringify(current));
                    }
                }, delay);
            } else {
                // Si l'heure est passée pendant que c'était fermé, on nettoie (ou on notifie immédiatement ?)
                // On nettoie pour éviter le spam au lancement
                delete scheduled[id];
            }
        });
        localStorage.setItem('mali_facture_notifications', JSON.stringify(scheduled));
    }
};
