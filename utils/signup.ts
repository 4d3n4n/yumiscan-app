export interface SignupMetadataInput {
  firstName: string
  lastName: string
  preferences: string[]
  acceptedCguVersion?: string
  acceptedCguAt: string
  acceptedHealthDisclaimer: boolean
}

const DEFAULT_CGU_VERSION = 'v1.0'
const MAX_PREFERENCES = 5

function normalizePreference(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildSignupMetadata(input: SignupMetadataInput) {
  const preferences = Array.from(
    new Set(
      input.preferences
        .map(normalizePreference)
        .filter((value): value is string => value !== null)
    )
  ).slice(0, MAX_PREFERENCES)

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const acceptedCguVersion = input.acceptedCguVersion?.trim() || DEFAULT_CGU_VERSION

  return {
    first_name: firstName,
    last_name: lastName,
    preferences,
    accepted_cgu_version: acceptedCguVersion,
    accepted_cgu_at: input.acceptedCguAt,
    accepted_health_disclaimer: input.acceptedHealthDisclaimer,
  }
}
