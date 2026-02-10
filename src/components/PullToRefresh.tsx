import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export const PullToRefresh = () => {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        // Only active on touch devices
        if (!('ontouchstart' in window)) return;

        const handleTouchStart = (e: TouchEvent) => {
            // Only start if we are at the top of the page
            if (window.scrollY <= 0) {
                setStartY(e.touches[0].clientY);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            const y = e.touches[0].clientY;
            // If we started at top and are pulling down
            if (startY > 0 && y > startY && window.scrollY <= 0) {
                // Prevent default only if we are significantly pulling to avoid interfering with native bounce too early?
                // Actually, preventing default disables native scroll, which is good for custom pull-to-refresh visual.
                // But we want to allow normal scroll up if not at top. 
                // Here we are at top.

                // We set currentY to update UI
                setCurrentY(y);
            }
        };

        const handleTouchEnd = () => {
            if (startY > 0) {
                const distance = currentY - startY;
                if (distance > 150 && window.scrollY <= 0) { // Threshold to trigger refresh
                    setIsRefreshing(true);
                    // Vibrate if available
                    if (navigator.vibrate) navigator.vibrate(50);

                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                } else {
                    // Reset
                    setStartY(0);
                    setCurrentY(0);
                }
            }
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true }); // Passive true for better scroll performance, but we can't preventDefault. 
        // If we want to prevent native scroll, we need passive: false.
        // However, iOS overscroll is hard to prevent. 
        // Let's just create a visual overlay safely.

        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [startY, currentY]);

    const distance = Math.max(0, currentY - startY);
    const threshold = 150;
    const rotation = Math.min(distance, 360);

    if (distance === 0 && !isRefreshing) return null;

    return (
        <div
            className="fixed left-0 right-0 z-[9999] pointer-events-none flex justify-center transition-all duration-200 ease-out"
            style={{
                top: isRefreshing ? '40px' : `${Math.min(distance * 0.4, 80) - 60}px`,
                opacity: Math.min(distance / 100, 1)
            }}
        >
            <div className={`bg-white p-3 rounded-full shadow-xl border border-gray-100 transform ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw
                    size={24}
                    className={`${distance > threshold ? 'text-blue-600' : 'text-gray-400'}`}
                    style={{ transform: `rotate(${rotation}deg)` }}
                />
            </div>
        </div>
    );
};
