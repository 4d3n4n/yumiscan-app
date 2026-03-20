#!/usr/bin/env bash
# Supabase Auth — consulter ou mettre à jour les rate limits (anti brute-force)
# Doc: https://supabase.com/docs/guides/auth/rate-limits
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN="your-access-token"  # https://supabase.com/dashboard/account/tokens
#   export PROJECT_REF="your-project-ref"             # ex: abcdefgh si URL = https://abcdefgh.supabase.co
#
#   ./scripts/supabase-auth-rate-limits.sh get        # afficher les rate limits actuels
#   ./scripts/supabase-auth-rate-limits.sh set        # appliquer des valeurs (éditer le JSON ci‑dessous)

set -e
BASE_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

if [[ -z "$SUPABASE_ACCESS_TOKEN" || -z "$PROJECT_REF" ]]; then
  echo "Erreur: définis SUPABASE_ACCESS_TOKEN et PROJECT_REF (voir en-tête du script)."
  exit 1
fi

case "${1:-get}" in
  get)
    echo "Rate limits actuels (auth) :"
    curl -sS -X GET "$BASE_URL" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      | jq 'to_entries | map(select(.key | startswith("rate_limit_"))) | from_entries'
    ;;
  set)
    echo "Mise à jour des rate limits..."
    curl -sS -X PATCH "$BASE_URL" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "rate_limit_anonymous_users": 30,
        "rate_limit_email_sent": 10,
        "rate_limit_sms_sent": 30,
        "rate_limit_verify": 30,
        "rate_limit_token_refresh": 150,
        "rate_limit_otp": 30,
        "rate_limit_web3": 30
      }' | jq '.'
    echo "Done."
    ;;
  *)
    echo "Usage: $0 get|set"
    exit 1
    ;;
esac
