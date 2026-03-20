/**
 * Déclarations minimales pour l'environnement Deno (Supabase Edge Functions).
 * Permet à TypeScript de reconnaître l'API Deno sans l'extension Deno.
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
