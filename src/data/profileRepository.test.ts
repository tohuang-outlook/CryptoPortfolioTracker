import { beforeEach, describe, expect, it } from "vitest";
import { createProfileRepository } from "./profileRepository";

const defaultProfile = {
  id: "profile-1",
  name: "My Portfolio",
  avatarColor: "#1f6f78",
  createdAt: "2026-06-13T00:00:00.000Z"
};

describe("profileRepository", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true
    });
  });

  it("returns an empty profile list when no profiles are stored", () => {
    const repo = createProfileRepository();

    expect(repo.loadProfiles()).toEqual([]);
    expect(repo.loadActiveProfileId()).toBeNull();
  });

  it("persists and loads profiles and the active profile id", () => {
    const repo = createProfileRepository();

    expect(repo.saveProfiles([defaultProfile])).toEqual({ success: true });
    expect(repo.saveActiveProfileId(defaultProfile.id)).toEqual({ success: true });

    expect(repo.loadProfiles()).toEqual([defaultProfile]);
    expect(repo.loadActiveProfileId()).toBe(defaultProfile.id);
  });

  it("filters malformed stored profiles safely", () => {
    window.localStorage.setItem(
      "crypto-portfolio-profiles",
      JSON.stringify([
        defaultProfile,
        { id: 123, name: "Bad Profile" }
      ])
    );

    const repo = createProfileRepository();

    expect(repo.loadProfiles()).toEqual([defaultProfile]);
  });

  it("returns an empty array for unreadable profile storage", () => {
    window.localStorage.setItem("crypto-portfolio-profiles", "not-json");

    const repo = createProfileRepository();

    expect(repo.loadProfiles()).toEqual([]);
  });

  it("falls back to the first profile when the active profile id is missing", () => {
    window.localStorage.setItem(
      "crypto-portfolio-profiles",
      JSON.stringify([defaultProfile])
    );

    const repo = createProfileRepository();

    expect(repo.resolveActiveProfileId([defaultProfile])).toBe(defaultProfile.id);
  });
});

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
}
