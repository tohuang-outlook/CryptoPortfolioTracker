import { useState } from "react";
import {
  DEFAULT_PROFILE_COLOR,
  PROFILE_COLOR_OPTIONS
} from "../constants/profileColors";
import type { Profile } from "../types/portfolio";

type MutationResult =
  | { success: true }
  | { success: false; error: string };

export function ProfileSwitcher({
  profiles,
  activeProfile,
  onSwitchProfile,
  onCreateProfile
}: {
  profiles: Profile[];
  activeProfile: Profile | null;
  onSwitchProfile: (profileId: string) => MutationResult;
  onCreateProfile: (input: {
    name: string;
    avatarColor: string;
  }) => MutationResult;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PROFILE_COLOR);
  const [error, setError] = useState<string | null>(null);

  if (!activeProfile) {
    return null;
  }

  function handleSwitch(profileId: string) {
    const result = onSwitchProfile(profileId);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setError(null);
    setIsOpen(false);
    setIsCreating(false);
  }

  function handleCreate() {
    const result = onCreateProfile({
      name,
      avatarColor: selectedColor
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    setError(null);
    setName("");
    setSelectedColor(DEFAULT_PROFILE_COLOR);
    setIsCreating(false);
    setIsOpen(false);
  }

  return (
    <div className="profile-switcher">
      <button
        type="button"
        className="profile-switcher__trigger"
        onClick={() => {
          setIsOpen((open) => !open);
          setError(null);
        }}
        aria-expanded={isOpen}
      >
        <span
          className="profile-switcher__avatar"
          style={{ backgroundColor: activeProfile.avatarColor }}
          aria-hidden="true"
        />
        <span className="profile-switcher__copy">
          <span className="profile-switcher__name">{activeProfile.name}</span>
          <span className="profile-switcher__meta">Active portfolio</span>
        </span>
      </button>

      {isOpen ? (
        <div className="profile-switcher__menu">
          <div className="profile-switcher__list">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={
                  profile.id === activeProfile.id
                    ? "profile-switcher__option profile-switcher__option--active"
                    : "profile-switcher__option"
                }
                onClick={() => handleSwitch(profile.id)}
              >
                <span
                  className="profile-switcher__avatar"
                  style={{ backgroundColor: profile.avatarColor }}
                  aria-hidden="true"
                />
                <span>{profile.name}</span>
              </button>
            ))}
          </div>

          {isCreating ? (
            <div className="profile-switcher__create">
              <label className="profile-switcher__label">
                <span>Profile Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tony"
                />
              </label>

              <div className="profile-switcher__palette">
                {PROFILE_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      option.value === selectedColor
                        ? "profile-switcher__color profile-switcher__color--selected"
                        : "profile-switcher__color"
                    }
                    style={{ backgroundColor: option.value }}
                    aria-label={`${option.label} avatar`}
                    onClick={() => setSelectedColor(option.value)}
                  />
                ))}
              </div>

              {error ? <p className="profile-switcher__error">{error}</p> : null}

              <div className="profile-switcher__actions">
                <button type="button" onClick={handleCreate}>
                  Create Profile
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="profile-switcher__create-trigger"
              onClick={() => {
                setIsCreating(true);
                setError(null);
              }}
            >
              Create New Profile
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
