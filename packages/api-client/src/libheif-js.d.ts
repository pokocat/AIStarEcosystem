declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    has_alpha_channel(): boolean;
    display(data: ImageData, callback: (data: ImageData | null) => void): void;
    free(): void;
  }
  export default function create(): Promise<{ HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] } }>;
}
