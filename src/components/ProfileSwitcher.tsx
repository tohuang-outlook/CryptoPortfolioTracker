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
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile
}: {
  profiles: Profile[];
  activeProfile: Profile | null;
  onSwitchProfile: (profileId: string) => MutationResult;
  onCreateProfile: (input: {
    name: string;
    avatarColor: string;
  }) => MutationResult;
  onRenameProfile: (input: { id: string; name: string }) => MutationResult;
  onDeleteProfile: (profileId: string) => MutationResult;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PROFILE_COLOR);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmProfileId, setDeleteConfirmProfileId] = useState<string | null>(
    null
  );
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
    setEditingProfileId(null);
    setDeleteConfirmProfileId(null);
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

  function startRename(profile: Profile) {
    setIsCreating(false);
    setEditingProfileId(profile.id);
    setEditingName(profile.name);
    setDeleteConfirmProfileId(null);
    setError(null);
  }

  function handleRenameSave(profileId: string) {
    const result = onRenameProfile({
      id: profileId,
      name: editingName
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    setError(null);
    setEditingProfileId(null);
    setEditingName("");
    setDeleteConfirmProfileId(null);
    setIsOpen(false);
  }

  function handleRenameCancel() {
    setEditingProfileId(null);
    setEditingName("");
    setError(null);
  }

  function startDelete(profileId: string) {
    setIsCreating(false);
    setEditingProfileId(null);
    setEditingName("");
    setDeleteConfirmProfileId(profileId);
    setError(null);
  }

  function handleDeleteConfirm(profileId: string) {
    const result = onDeleteProfile(profileId);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setError(null);
    setDeleteConfirmProfileId(null);
    setEditingProfileId(null);
    setEditingName("");
    setIsOpen(false);
  }

  function handleDeleteCancel() {
    setDeleteConfirmProfileId(null);
    setError(null);
  }

  return (
    <div className="profile-switcher">
      <button
        type="button"
        className="profile-switcher__trigger"
        onClick={() => {
          setIsOpen((open) => !open);
          setError(null);
          setEditingProfileId(null);
          setDeleteConfirmProfileId(null);
          setIsCreating(false);
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
            {profiles.map((profile) => {
              const optionClassName =
                profile.id === activeProfile.id
                  ? "profile-switcher__option profile-switcher__option--active"
                  : "profile-switcher__option";

              if (editingProfileId === profile.id) {
                return (
                  <div key={profile.id} className={optionClassName}>
                    <div className="profile-switcher__row-editor">
                      <label className="profile-switcher__label">
                        <span className="sr-only">Rename profile name</span>
                        <input
                          aria-label="Rename profile name"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                      </label>
                      <div className="profile-switcher__row-actions">
                        <button
                          type="button"
                          onClick={() => handleRenameSave(profile.id)}
                        >
                          Save Profile Rename
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={handleRenameCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (deleteConfirmProfileId === profile.id) {
                return (
                  <div key={profile.id} className={optionClassName}>
                    <div className="profile-switcher__row-delete">
                      <p>Delete this profile and all of its transactions?</p>
                      <div className="profile-switcher__row-actions">
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => handleDeleteConfirm(profile.id)}
                        >
                          Confirm Delete {profile.name}
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={handleDeleteCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={profile.id} className={optionClassName}>
                  <div className="profile-switcher__row-meta">
                    <button
                      type="button"
                      className="profile-switcher__row-link"
                      onClick={() => handleSwitch(profile.id)}
                    >
                      <span
                        className="profile-switcher__avatar"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      />
                      <span>{profile.name}</span>
                    </button>
                    <div className="profile-switcher__row-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        aria-label={`Rename ${profile.name}`}
                        onClick={() => startRename(profile)}
                      >
                        Rename
                      </button>
                      {profiles.length > 1 ? (
                        <button
                          type="button"
                          className="button-secondary button-danger-soft"
                          aria-label={`Delete ${profile.name}`}
                          onClick={() => startDelete(profile.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
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
            <>
              {error ? <p className="profile-switcher__error">{error}</p> : null}
              <button
                type="button"
                className="profile-switcher__create-trigger"
                onClick={() => {
                  setIsCreating(true);
                  setEditingProfileId(null);
                  setDeleteConfirmProfileId(null);
                  setError(null);
                }}
              >
                Create New Profile
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
