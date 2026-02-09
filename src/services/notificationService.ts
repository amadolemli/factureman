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

    // Planifier une notification (SAFE MODE)
    scheduleNotification: async (id: string, title: string, body: string, appointmentDate: string, delayMinutes: number = 60) => {
        try {
            // Safety Check 1: API Presence
            if (!("Notification" in window)) {
                console.warn("Notifications non supportées sur cet appareil");
                return;
            }

            // Safety Check 2: Permission (Async)
            if (Notification.permission !== "granted") {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted") return;
                } catch (e) {
                    console.warn("Notification permission request failed", e);
                    return;
                }
            }

            // Calculer le délai
            const apptTime = new Date(appointmentDate).getTime();
            if (isNaN(apptTime)) return; // Invalid date safety

            const notifyTime = apptTime - (delayMinutes * 60 * 1000);
            const now = new Date().getTime();
            const delay = notifyTime - now;

            if (delay > 0) {
                // Sauvegarder dans localStorage (Safe Parse)
                try {
                    const stored = localStorage.getItem('mali_facture_notifications');
                    const scheduled = stored ? JSON.parse(stored) : {};
                    scheduled[id] = { title, body, notifyTime };
                    localStorage.setItem('mali_facture_notifications', JSON.stringify(scheduled));
                } catch (storageError) {
                    console.error("Storage error for notification", storageError);
                }

                console.log(`Notification planifiée pour dans ${(delay / 60000).toFixed(0)} minutes`);

                setTimeout(() => {
                    try {
                        const stored = localStorage.getItem('mali_facture_notifications');
                        const currentScheduled = stored ? JSON.parse(stored) : {};

                        if (currentScheduled[id]) {
                            // 1. Play Sound (Safe)
                            try {
                                if (typeof Audio !== "undefined") {
                                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                                    audio.volume = 0.5;
                                    audio.play().catch(e => console.warn("Audio play blocked", e));
                                }
                            } catch (e) {
                                console.warn("Audio error", e);
                            }

                            // 2. Show Notification (Safe)
                            try {
                                // Service Worker fallback check for mobile could go here
                                new Notification(title, {
                                    body: body,
                                    icon: '/pwa-192x192.png',
                                    requireInteraction: true
                                });
                            } catch (notifError) {
                                console.error("Notification display error", notifError);
                            }

                            // Nettoyer
                            delete currentScheduled[id];
                            localStorage.setItem('mali_facture_notifications', JSON.stringify(currentScheduled));
                        }
                    } catch (timeoutError) {
                        console.error("Timeout execution error", timeoutError);
                    }
                }, delay);
            }
        } catch (globalError) {
            console.error("Critical Notification Error", globalError);
            // Prevent app crash by catching top level
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
