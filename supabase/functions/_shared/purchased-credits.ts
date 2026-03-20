export async function getPurchasedCreditsTotal(
  supabase: { from: (table: string) => any },
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("user_purchases")
    .select("credits_added")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`user_purchases lookup failed: ${error.message}`);
  }

  return (data ?? []).reduce((total: number, purchase: { credits_added?: number | null }) => {
    return total + Number(purchase.credits_added ?? 0);
  }, 0);
}

export function getPaidCreditsRemaining(
  paidCreditsPurchased: number,
  paidScansUsed: number,
): number {
  return Math.max(0, paidCreditsPurchased - Math.max(0, paidScansUsed));
}
