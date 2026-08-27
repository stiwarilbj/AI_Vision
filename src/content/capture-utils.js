(function(global) {
    'use strict';

    function calculateSourceCrop(cropX, cropY, cropWidth, cropHeight, imageWidth, imageHeight, viewportWidth, viewportHeight) {
        const safeImageWidth = Math.max(1, Number(imageWidth) || 1);
        const safeImageHeight = Math.max(1, Number(imageHeight) || 1);
        const scaleX = safeImageWidth / Math.max(1, Number(viewportWidth) || 1);
        const scaleY = safeImageHeight / Math.max(1, Number(viewportHeight) || 1);
        const sourceX = Math.max(0, Math.min(safeImageWidth - 1, Math.round(Math.max(0, Number(cropX) || 0) * scaleX)));
        const sourceY = Math.max(0, Math.min(safeImageHeight - 1, Math.round(Math.max(0, Number(cropY) || 0) * scaleY)));
        const sourceWidth = Math.max(1, Math.min(safeImageWidth - sourceX, Math.round(Math.max(1, Number(cropWidth) || 1) * scaleX)));
        const sourceHeight = Math.max(1, Math.min(safeImageHeight - sourceY, Math.round(Math.max(1, Number(cropHeight) || 1) * scaleY)));
        const outputScale = Math.min(2, Math.max(1, Math.min(1600 / sourceWidth, 1200 / sourceHeight)));
        return {
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            canvasWidth: Math.max(1, Math.round(sourceWidth * outputScale)),
            canvasHeight: Math.max(1, Math.round(sourceHeight * outputScale))
        };
    }

    global.aiVisionCaptureUtils = { calculateSourceCrop };
    if (typeof module !== 'undefined' && module.exports) module.exports = { calculateSourceCrop };
})(typeof globalThis !== 'undefined' ? globalThis : window);
