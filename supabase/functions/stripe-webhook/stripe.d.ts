/** Déclaration pour l'import URL Deno (esm.sh) — résolu à l'exécution par le runtime Deno. */
declare module "https://esm.sh/stripe@14?target=denonext" {
  const Stripe: {
    createSubtleCryptoProvider(): unknown;
    new (key: string, config?: { apiVersion?: string }): {
      checkout: { sessions: { retrieve: (id: string, opts?: { expand?: string[] }) => Promise<unknown> } };
      webhooks: { constructEventAsync(payload: string | Buffer, sig: string, secret: string, tolerance?: number, cryptoProvider?: unknown): Promise<unknown> };
    };
  };
  export default Stripe;
}
