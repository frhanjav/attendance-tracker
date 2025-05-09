import { create } from 'zustand';

// Define the state structure
interface UIState {
  isCreateStreamModalOpen: boolean;
  isJoinStreamModalOpen: boolean;
}

// Define the actions to modify the state
interface UIActions {
  openCreateStreamModal: () => void;
  closeCreateStreamModal: () => void;
  openJoinStreamModal: () => void;
  closeJoinStreamModal: () => void;
}

// Create the Zustand store
const useUIStore = create<UIState & UIActions>((set) => ({
  // Initial state
  isCreateStreamModalOpen: false,
  isJoinStreamModalOpen: false,

  // Actions using set to update state immutably
  openCreateStreamModal: () => set({ isCreateStreamModalOpen: true }),
  closeCreateStreamModal: () => set({ isCreateStreamModalOpen: false }),
  openJoinStreamModal: () => set({ isJoinStreamModalOpen: true }),
  closeJoinStreamModal: () => set({ isJoinStreamModalOpen: false }),
}));

export default useUIStore;