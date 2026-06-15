import { useState } from "react";
import { DEFAULT_PROFILE_COLOR } from "../constants/profileColors";
import { createProfileRepository } from "../data/profileRepository";
import { createTransactionRepository } from "../data/transactionRepository";
import type {
  Profile,
  Transaction,
  TransactionsByProfileId
} from "../types/portfolio";

const profileRepository = createProfileRepository();
const transactionRepository = createTransactionRepository();

type MutationResult =
  | { success: true }
  | { success: false; error: string };

interface CreateProfileInput {
  name: string;
  avatarColor: string;
}

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string | null;
  transactionsByProfileId: TransactionsByProfileId;
}

export function useProfiles() {
  const [state, setState] = useState<ProfileState>(() => bootstrapProfileState());

  const activeProfile =
    state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
  const activeTransactions = state.activeProfileId
    ? state.transactionsByProfileId[state.activeProfileId] ?? []
    : [];

  function createProfile(input: CreateProfileInput): MutationResult {
    const name = input.name.trim();

    if (name.length === 0) {
      return {
        success: false,
        error: "Please enter a profile name."
      };
    }

    const nextProfile: Profile = {
      id: createProfileId(),
      name,
      avatarColor: input.avatarColor,
      createdAt: new Date().toISOString()
    };

    const nextProfiles = [...state.profiles, nextProfile];
    const nextTransactionsByProfileId = {
      ...state.transactionsByProfileId,
      [nextProfile.id]: []
    };

    const saveProfilesResult = profileRepository.saveProfiles(nextProfiles);
    if (!saveProfilesResult.success) {
      return saveProfilesResult;
    }

    const saveTransactionsResult = transactionRepository.saveTransactionsByProfileId(
      nextTransactionsByProfileId
    );
    if (!saveTransactionsResult.success) {
      return saveTransactionsResult;
    }

    const saveActiveResult = profileRepository.saveActiveProfileId(nextProfile.id);
    if (!saveActiveResult.success) {
      return saveActiveResult;
    }

    setState({
      profiles: nextProfiles,
      activeProfileId: nextProfile.id,
      transactionsByProfileId: nextTransactionsByProfileId
    });

    return { success: true };
  }

  function switchProfile(profileId: string): MutationResult {
    if (!state.profiles.some((profile) => profile.id === profileId)) {
      return {
        success: false,
        error: "Unable to find that profile."
      };
    }

    const saveResult = profileRepository.saveActiveProfileId(profileId);
    if (!saveResult.success) {
      return saveResult;
    }

    setState((currentState) => ({
      ...currentState,
      activeProfileId: profileId
    }));

    return { success: true };
  }

  function saveActiveTransactions(updatedTransactions: Transaction[]): MutationResult {
    if (!state.activeProfileId) {
      return {
        success: false,
        error: "Please choose a profile first."
      };
    }

    const nextTransactionsByProfileId = {
      ...state.transactionsByProfileId,
      [state.activeProfileId]: updatedTransactions
    };

    const saveResult = transactionRepository.saveTransactionsByProfileId(
      nextTransactionsByProfileId
    );
    if (!saveResult.success) {
      return saveResult;
    }

    setState((currentState) => ({
      ...currentState,
      transactionsByProfileId: nextTransactionsByProfileId
    }));

    return { success: true };
  }

  return {
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    activeProfile,
    activeTransactions,
    createProfile,
    switchProfile,
    saveActiveTransactions
  };
}

function bootstrapProfileState(): ProfileState {
  let profiles = profileRepository.loadProfiles();
  let activeProfileId = profileRepository.resolveActiveProfileId(profiles);
  let transactionsByProfileId = transactionRepository.loadTransactionsByProfileId();

  if (profiles.length === 0) {
    const defaultProfile = createDefaultProfile();
    profiles = [defaultProfile];
    activeProfileId = defaultProfile.id;
    profileRepository.saveProfiles(profiles);
    profileRepository.saveActiveProfileId(defaultProfile.id);
  }

  if (
    !transactionRepository.hasTransactionsByProfileIdStorage() &&
    Object.keys(transactionsByProfileId).length === 0
  ) {
    const legacyTransactions = transactionRepository.loadLegacyTransactions();
    if (legacyTransactions.length > 0 && activeProfileId) {
      transactionsByProfileId =
        transactionRepository.migrateLegacyTransactionsToProfileMap({
          legacyTransactions,
          defaultProfileId: activeProfileId
        });
      transactionRepository.saveTransactionsByProfileId(transactionsByProfileId);
    }
  }

  return {
    profiles,
    activeProfileId,
    transactionsByProfileId
  };
}

function createDefaultProfile(): Profile {
  return {
    id: createProfileId(),
    name: "My Portfolio",
    avatarColor: DEFAULT_PROFILE_COLOR,
    createdAt: new Date().toISOString()
  };
}

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `profile-${Date.now()}`;
}
