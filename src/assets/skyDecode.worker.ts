/// <reference lib="webworker" />
// Decodes a sky photo to raw RGBA rows, bottom row first (WebGL's order), off the main thread. Uploading raw bytes is a
// plain copy; uploading an ImageBitmap to WebGL2 made Chrome convert it on the main thread first (s05: 25–53 ms vs 9 ms
// per 2048 px sky at 6x slowdown, the hitch at every arrival). Flipping here also avoids createImageBitmap's
// imageOrientation option, which Safari < 17 and Firefox < 98 ignore.

export interface SkyDecodeRequest {
  id: number;
  url: string;
}

export type SkyDecodeReply =
  | { id: number; width: number; height: number; data: Uint8Array }
  | { id: number; error: string };

import { paintHorizon } from './skyHorizon';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<SkyDecodeRequest>) => {
  const { id, url } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const bitmap = await createImageBitmap(await response.blob());
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no 2d context in the worker');
    context.setTransform(1, 0, 0, -1, 0, height);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = new Uint8Array(context.getImageData(0, 0, width, height).data.buffer);
    paintHorizon({ width, height, data });
    scope.postMessage({ id, width, height, data } satisfies SkyDecodeReply, [data.buffer]);
  } catch (error) {
    scope.postMessage({ id, error: String(error) } satisfies SkyDecodeReply);
  }
};
