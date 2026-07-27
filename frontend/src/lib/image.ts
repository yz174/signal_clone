export interface Dimensions {
  width: number;
  height: number;
}

export function measureImage(url: string): Promise<Dimensions | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}
