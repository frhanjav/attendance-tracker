import { create } from 'zustand';

interface UIState {
  isCreateStreamModalOpen: boolean;
  isJoinStreamModalOpen: boolean;
}

interface UIActions {
  openCreateStreamModal: () => void;
  closeCreateStreamModal: () => void;
  openJoinStreamModal: () => void;
  closeJoinStreamModal: () => void;
}

const useUIStore = create<UIState & UIActions>((set) => ({
  isCreateStreamModalOpen: false,
  isJoinStreamModalOpen: false,

  openCreateStreamModal: () => set({ isCreateStreamModalOpen: true }),
  closeCreateStreamModal: () => set({ isCreateStreamModalOpen: false }),
  openJoinStreamModal: () => set({ isJoinStreamModalOpen: true }),
  closeJoinStreamModal: () => set({ isJoinStreamModalOpen: false }),
}));

export default useUIStore;