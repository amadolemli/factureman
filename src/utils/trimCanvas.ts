export const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const context = canvas.getContext('2d');
    if (!context) return canvas; // Should not happen

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const length = pixels.data.length;
    let i;
    let bound = {
        top: -1,
        left: -1,
        right: -1,
        bottom: -1
    };

    // Iterate over every pixel to find the bounding box
    for (i = 0; i < length; i += 4) {
        if (pixels.data[i + 3] !== 0) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);

            if (bound.top === -1) {
                bound.top = y;
            }

            if (bound.left === -1) {
                bound.left = x;
            } else if (x < bound.left) {
                bound.left = x;
            }

            if (bound.right === -1) {
                bound.right = x;
            } else if (bound.right < x) {
                bound.right = x;
            }

            if (bound.bottom === -1) {
                bound.bottom = y;
            } else if (bound.bottom < y) {
                bound.bottom = y;
            }
        }
    }

    // If the canvas is empty, return the original canvas
    if (bound.top === -1) {
        return canvas;
    }

    const trimHeight = bound.bottom - bound.top + 1;
    const trimWidth = bound.right - bound.left + 1;
    const trimmed = context.getImageData(bound.left, bound.top, trimWidth, trimHeight);

    const copy = document.createElement('canvas');
    copy.width = trimWidth;
    copy.height = trimHeight;
    const copyContext = copy.getContext('2d');

    if (copyContext) {
        copyContext.putImageData(trimmed, 0, 0);
        return copy;
    }

    return canvas;
};
