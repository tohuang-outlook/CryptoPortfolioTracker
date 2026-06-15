import type { Profile } from "../types/portfolio";

const PROFILES_STORAGE_KEY = "crypto-portfolio-profiles";
const ACTIVE_PROFILE_ID_STORAGE_KEY = "crypto-portfolio-active-profile-id";

type SaveResult = { success: true } | { success: false; error: string };

export function createProfileRepository() {
  return {
    loadProfiles(): Profile[] {
      const raw = readStorageItem(PROFILES_STORAGE_KEY);
      if (raw === null) {
        return [];
      }

      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed.filter(isProfile);
      } catch {
        return [];
      }
    },
    loadActiveProfileId(): string | null {
      const raw = readStorageItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
      return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
    },
    resolveActiveProfileId(profiles: Profile[]) {
      const activeProfileId = this.loadActiveProfileId();

      if (
        activeProfileId &&
        profiles.some((profile) => profile.id === activeProfileId)
      ) {
        return activeProfileId;
      }

      return profiles[0]?.id ?? null;
    },
    saveProfiles(profiles: Profile[]): SaveResult {
      return writeStorageItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    },
    saveActiveProfileId(profileId: string): SaveResult {
      return writeStorageItem(ACTIVE_PROFILE_ID_STORAGE_KEY, profileId);
    }
  };
}

function readStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): SaveResult {
  try {
    window.localStorage.setItem(key, value);
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Unable to save profile. Please try again."
    };
  }
}

function isProfile(value: unknown): value is Profile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.avatarColor === "string" &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
