import { PaddleOCR } from '@paddleocr/paddleocr-js';

type OcrLine = { text: string; score: number; poly: Array<[number, number]> };
type WorkerApi = {
  ready: Promise<void>;
  recognize: (images: string[]) => Promise<Array<{ lines: OcrLine[]; width: number; height: number; metrics: unknown }>>;
};

declare global {
  interface Window {
    cardtellOcrWorker?: WorkerApi;
  }
}

const status = document.querySelector<HTMLElement>('#status');
const ready = (async () => {
  const engine = await PaddleOCR.create({
    lang: 'en',
    ocrVersion: 'PP-OCRv5',
    worker: false,
    ortOptions: {
      backend: 'wasm',
      wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
      simd: true,
    },
  });

  window.cardtellOcrWorker = {
    ready: Promise.resolve(),
    async recognize(images) {
      const blobs = images.map((image) => {
        const binary = atob(image);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return new Blob([bytes], { type: 'image/jpeg' });
      });
      const results = await engine.predict(blobs);
      return results.map((result) => ({
        width: result.image.width,
        height: result.image.height,
        metrics: result.metrics,
        lines: result.items.map((item) => ({ text: item.text, score: item.score, poly: item.poly })),
      }));
    },
  };
})();

window.cardtellOcrWorker = {
  ready,
  async recognize(images) {
    await ready;
    if (!window.cardtellOcrWorker) throw new Error('OCR worker did not initialize.');
    return window.cardtellOcrWorker.recognize(images);
  },
};

void ready.then(() => {
  if (status) status.textContent = 'OCR ready';
}).catch((error: unknown) => {
  if (status) status.textContent = error instanceof Error ? error.message : 'OCR could not start.';
});
